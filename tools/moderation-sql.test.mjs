// Runs the real migrations in an isolated PostgreSQL engine with a schema fixture.
// Install @electric-sql/pglite in tools/test-results/sql-check before running.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(new URL('./test-results/sql-check/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
const admin='00000000-0000-0000-0000-000000000001';
const player='00000000-0000-0000-0000-000000000002';

test('PostgreSQL migrations: visibility, bans, expiry, permissions and audit',async()=>{
  const db=new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key,is_anonymous boolean default false,email text,raw_user_meta_data jsonb default '{}',created_at timestamptz default now());
      create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
      grant usage on schema auth to anon,authenticated;
      create table players(user_id uuid primary key references auth.users on delete cascade,nickname text unique,role text,updated_at timestamptz default now());
      create table game_states(user_id uuid primary key references players on delete cascade,gold bigint default 10000,rebirths smallint default 0,
        unlocked_ball_ids jsonb default '["yellow"]',discovered_ball_ids jsonb default '["yellow"]',selected_ball_id text default 'yellow',
        honey_expires_at timestamptz,updated_at timestamptz default now());
      create table moderation_cases(user_id uuid primary key references players on delete cascade,status text not null default 'active' check(status in ('active','review','suspended')),
        suspicion_score integer not null default 0,strikes integer not null default 0,suspended_until timestamptz,last_reason text,updated_at timestamptz default now());
      create table admin_audit_logs(id bigint generated always as identity primary key,admin_user_id uuid references players,target_user_id uuid references players,
        action text,reason text,details jsonb,created_at timestamptz default now());
      insert into auth.users(id) values('${admin}'),('${player}');
      insert into players values('${admin}','관리자','admin',now()),('${player}','플레이어','player',now());
      insert into game_states(user_id) values('${admin}'),('${player}');
    `);
    for(const name of ['20261004_accounts_and_rankings.sql','20261004_admin_exact_gold.sql','20261005_clear_announcement.sql','20261005_ranking_visibility_bans.sql'])
      await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/20261005_ban_status_constraint.sql',import.meta.url),'utf8'));
    async function rpc(user,body,anonymous=false){
      await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(user?{sub:user,is_anonymous:anonymous}:{})]);
      const result=await db.query('select public.wakppu_api($1::jsonb) as data',[JSON.stringify(body)]);
      return result.rows[0].data;
    }
    const hidden={action:'admin_ranking_visibility',user_id:player,hidden:true,reason:'테스트 숨김'};
    await assert.rejects(rpc(player,hidden),{code:'PT403'});
    await assert.rejects(rpc(null,hidden),{code:'PT401'});
    await assert.rejects(rpc(admin,hidden,true),{code:'PT403'});
    await assert.rejects(rpc(admin,{...hidden,hidden:'true'}));
    await rpc(admin,hidden);
    assert.equal((await rpc(admin,{action:'rankings'})).length,1);
    assert.equal((await rpc(player,{action:'bootstrap'})).state.gold,'10000');
    const body={action:'save_progress',gold:'10001',admin_revision:1,rebirths:0,unlocked_ball_ids:['yellow'],selected_ball_id:'yellow',hammer_level:0};
    await rpc(player,body);
    const ban={action:'admin_ban',user_id:player,mode:'temporary',duration_hours:24,reason:'테스트 밴'};
    await assert.rejects(rpc(admin,{...ban,reason:''}));
    await assert.rejects(rpc(admin,{...ban,duration_hours:0}));
    await assert.rejects(rpc(admin,{...ban,duration_hours:1.5}));
    await assert.rejects(rpc(admin,{...ban,user_id:admin}));
    await rpc(admin,ban);
    const status=await rpc(player,{action:'status'});
    assert.equal(status.moderation.blocked,true);
    assert.equal(status.moderation.last_reason,'테스트 밴');
    for(const action of ['bootstrap','save_progress','rankings','set_nickname'])await assert.rejects(rpc(player,{...body,action}),{code:'PT403'});
    await rpc(admin,{...hidden,hidden:false});
    assert.equal((await rpc(admin,{action:'rankings'})).length,1);
    await db.query("update moderation_cases set suspended_until=now()-interval '1 second' where user_id=$1",[player]);
    assert.equal((await rpc(player,{action:'status'})).moderation.blocked,false);
    assert.equal((await rpc(admin,{action:'rankings'})).length,2);
    await rpc(admin,{...ban,mode:'permanent'});
    assert.equal((await rpc(player,{action:'status'})).moderation.status,'banned');
    await rpc(admin,hidden);
    await rpc(admin,{action:'admin_unban',user_id:player});
    assert.equal((await rpc(player,{action:'status'})).moderation.blocked,false);
    assert.equal((await rpc(admin,{action:'rankings'})).length,1);
    await rpc(admin,{...hidden,hidden:false});
    assert.equal((await rpc(admin,{action:'rankings'})).length,2);
    const search=await rpc(admin,{action:'admin_search',query:'플레이어'});
    assert.equal(search[0].ranking_hidden,false);assert.equal(search[0].state.gold,'10001');
    const logs=await rpc(admin,{action:'admin_logs'});
    assert.equal(logs.length,7);
    assert.equal(logs.find(log=>log.action==='ADMIN_BAN').reason,'테스트 밴');
    await rpc(admin,{action:'admin_announcement',message:'기존 기능'});
    await rpc(admin,{action:'admin_announcement',clear:true});
    assert.equal((await rpc(player,{action:'status'})).announcement,null);
    // Test actual function execute grants and prevent anonymous bypass.
    await db.exec('set role authenticated');
    await assert.rejects(rpc(player,hidden),{code:'PT403'});
    await db.exec('reset role; set role anon');
    await assert.rejects(rpc(null,ban),{code:'PT401'});
    await db.exec('reset role');
    const productionCheck=await readFile(new URL('./moderation-production-check.sql',import.meta.url),'utf8');
    const beforeCheck=await db.query('select (select jsonb_agg(to_jsonb(p)) from players p) as players,(select jsonb_agg(to_jsonb(g)) from game_states g) as progress,(select count(*)::integer from admin_audit_logs) as logs');
    await db.exec(productionCheck);
    assert.deepEqual(await db.query('select (select jsonb_agg(to_jsonb(p)) from players p) as players,(select jsonb_agg(to_jsonb(g)) from game_states g) as progress,(select count(*)::integer from admin_audit_logs) as logs'),beforeCheck);
    // An existing event wrapper must survive a moderation upgrade as well.
    await db.exec(`
      alter function public.wakppu_api(jsonb) rename to wakppu_api_before_events;
      revoke all on function public.wakppu_api_before_events(jsonb) from public,anon,authenticated;
      create function public.wakppu_api(b jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
      declare result jsonb; begin
        result:=public.wakppu_api_before_events(b);
        if b->>'action'='status' then return result||jsonb_build_object('gold_event',jsonb_build_object('multiplier',10)); end if;
        return result;
      end $$;
      revoke all on function public.wakppu_api(jsonb) from public;
      grant execute on function public.wakppu_api(jsonb) to anon,authenticated;
    `);
    await db.exec(await readFile(new URL('../supabase/migrations/20261005_ranking_visibility_bans.sql',import.meta.url),'utf8'));
    assert.equal((await rpc(player,{action:'status'})).gold_event.multiplier,10);
    await rpc(admin,hidden);
    assert.equal((await rpc(admin,{action:'rankings'})).length,1);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select public.wakppu_api_before_events($1::jsonb)',[JSON.stringify({action:'status'})]),{code:'42501'});
    await db.exec('reset role');
    await db.exec(await readFile(new URL('../supabase/migrations/20261006_guest_lifecycle.sql',import.meta.url),'utf8'));
    // Reapplication preserves the wrapped event/moderation API and doesn't backfill legacy users.
    await db.exec(await readFile(new URL('../supabase/migrations/20261006_guest_lifecycle.sql',import.meta.url),'utf8'));
    assert.equal((await rpc(player,{action:'status'})).gold_event.multiplier,10);
    assert.equal((await db.query('select count(*)::int as n from guest_lifecycle')).rows[0].n,0);
    await db.exec(await readFile(new URL('../supabase/migrations/20261006_rebirth_100_big_gold.sql',import.meta.url),'utf8'));
    const hugeGold='3541774862152233910272000000000000000';
    const currentRevision=(await rpc(player,{action:'bootstrap'})).state.admin_revision;
    await rpc(player,{...body,gold:hugeGold,rebirths:100,admin_revision:currentRevision});
    assert.equal((await rpc(player,{action:'bootstrap'})).state.gold,hugeGold);
    assert.equal((await rpc(player,{action:'bootstrap'})).state.rebirths,100);
    await rpc(admin,{action:'admin_gold',user_id:player,mode:'set',value:hugeGold});
    await rpc(admin,{action:'admin_rebirths',user_id:player,mode:'set',value:100});
    const updatedRevision=(await rpc(player,{action:'bootstrap'})).state.admin_revision;
    await assert.rejects(rpc(player,{...body,gold:hugeGold,rebirths:101,admin_revision:updatedRevision}));
    const guestIds=Array.from({length:6},(_,i)=>`00000000-0000-0000-0000-${String(i+10).padStart(12,'0')}`);
    for(let i=0;i<guestIds.length;i++){
      await db.query(`insert into auth.users(id,is_anonymous,created_at) values($1,true,now()-$2::interval)`,[guestIds[i],i===0?'10 minutes':i===1?'31 minutes':'4 days']);
      await db.query("insert into players(user_id,nickname,role) values($1,$2,'player')",[guestIds[i],'새계정'+i]);
      await db.query('insert into game_states(user_id,gold) values($1,0)',[guestIds[i]]);
    }
    await db.query("update auth.users set email='linked@example.test',is_anonymous=false where id=$1",[guestIds[3]]);
    await db.query("update auth.users set raw_user_meta_data='{"+ '"wakppu_email_link_pending":true' +"}' where id=$1",[guestIds[4]]);
    await db.query("update players set role='admin' where user_id=$1",[guestIds[5]]);
    await assert.rejects(rpc(guestIds[0],{action:'admin_guest_accounts'}),{code:'PT403'});
    await assert.rejects(rpc(null,{action:'admin_guest_accounts'}),{code:'PT401'});
    await assert.rejects(rpc(admin,{action:'admin_guest_accounts'},true),{code:'PT403'});
    const initial=await rpc(admin,{action:'admin_guest_accounts',filter:'all'});
    assert.equal(initial.total,6);
    assert.equal((await rpc(admin,{action:'admin_guest_accounts',filter:'hidden'})).total,2);
    assert.equal((await rpc(admin,{action:'admin_guest_accounts',filter:'due'})).total,1);
    assert.equal((await rpc(admin,{action:'admin_guest_accounts',query:'새계정1'})).total,1);
    await assert.rejects(rpc(admin,{action:'admin_guest_accounts',filter:'invalid'}));
    // Initial auto-save and status/bootstrap/nickname queries don't count as play.
    await rpc(guestIds[0],{...body,gold:'0',admin_revision:0,current_clicks:0});
    await rpc(guestIds[0],{action:'status'});
    await rpc(guestIds[0],{action:'set_nickname',nickname:'무플레이'});
    assert.equal((await db.query('select first_play_at from guest_lifecycle where user_id=$1',[guestIds[0]])).rows[0].first_play_at,null);
    assert.equal((await rpc(admin,{action:'rankings'})).some(p=>p.nickname==='새계정1'),false);
    await rpc(guestIds[1],{action:'mark_first_play',user_id:guestIds[2]});
    const first=(await db.query('select first_play_at from guest_lifecycle where user_id=$1',[guestIds[1]])).rows[0].first_play_at;
    await rpc(guestIds[1],{action:'mark_first_play'});
    assert.deepEqual((await db.query('select first_play_at from guest_lifecycle where user_id=$1',[guestIds[1]])).rows[0].first_play_at,first);
    assert.equal((await rpc(admin,{action:'rankings'})).some(p=>p.nickname==='새계정1'),true);
    await rpc(admin,{action:'admin_ranking_visibility',user_id:guestIds[1],hidden:true});
    assert.equal((await rpc(admin,{action:'rankings'})).some(p=>p.nickname==='새계정1'),false);
    await rpc(admin,{action:'admin_ban',user_id:guestIds[0],mode:'permanent',reason:'test'});
    await assert.rejects(rpc(guestIds[0],{action:'mark_first_play'}),{code:'PT403'});
    assert.equal((await db.query('select first_play_at from guest_lifecycle where user_id=$1',[guestIds[0]])).rows[0].first_play_at,null);
    await rpc(admin,{action:'admin_ranking_visibility',user_id:guestIds[2],hidden:true});
    const auditBefore=(await db.query('select count(*)::int as n from admin_audit_logs')).rows[0].n;
    assert.equal((await db.query('select wakppu_cleanup_unplayed_guests() as n')).rows[0].n,1);
    assert.equal((await db.query('select count(*)::int as n from auth.users where id=$1',[guestIds[2]])).rows[0].n,0);
    assert.equal((await db.query('select count(*)::int as n from game_states where user_id=$1',[guestIds[2]])).rows[0].n,0);
    assert.equal((await db.query('select count(*)::int as n from admin_audit_logs')).rows[0].n,auditBefore);
    assert.equal((await db.query("select count(*)::int as n from admin_audit_logs where target_user_id is null and details->>'deleted_target_user_id'=$1",[guestIds[2]])).rows[0].n,1);
    assert.equal((await db.query('select wakppu_cleanup_unplayed_guests() as n')).rows[0].n,0);
    // Any new play data also protects old cached clients and progress imports.
    await rpc(admin,{action:'admin_unban',user_id:guestIds[0]});
    await rpc(guestIds[0],{...body,gold:'1',admin_revision:2,current_clicks:0});
    assert.ok((await db.query('select first_play_at from guest_lifecycle where user_id=$1',[guestIds[0]])).rows[0].first_play_at);
    await db.exec('set role authenticated');
    for(const fn of ['wakppu_cleanup_unplayed_guests()','wakppu_guest_accounts()','wakppu_api_before_guest_lifecycle(\'{}\'::jsonb)'])await assert.rejects(db.query('select public.'+fn),{code:'42501'});
    await assert.rejects(db.query('select * from guest_lifecycle'),{code:'42501'});
    await db.exec('reset role');
    await db.exec(await readFile(new URL('../supabase/migrations/20261006_rebirth_100_big_gold.sql',import.meta.url),'utf8'));
    const whiteholeMigration=await readFile(new URL('../supabase/migrations/20261006_z_whitehole.sql',import.meta.url),'utf8');
    await db.exec(whiteholeMigration);await db.exec(whiteholeMigration);
    await assert.rejects(rpc(player,{action:'admin_test',ball_id:'whitehole'}),{code:'PT403'});
    assert.equal((await rpc(admin,{action:'admin_test',ball_id:'whitehole'})).authorized,true);
    await rpc(admin,{action:'admin_unlock',user_id:player,mode:'one',ball_id:'whitehole'});
    const whiteholeState=(await rpc(player,{action:'bootstrap'})).state;
    assert.equal(whiteholeState.unlocked_ball_ids.includes('whitehole'),true);
    const savedGold='10000000015000000';
    await rpc(player,{action:'save_progress',gold:savedGold,admin_revision:whiteholeState.admin_revision,rebirths:0,unlocked_ball_ids:whiteholeState.unlocked_ball_ids,discovered_ball_ids:['whitehole'],selected_ball_id:'whitehole',hammer_level:0});
    assert.equal((await rpc(player,{action:'bootstrap'})).state.gold,savedGold);
    assert.equal((await rpc(player,{action:'bootstrap'})).state.selected_ball_id,'whitehole');
    assert.equal((await rpc(player,{action:'status'})).gold_event.multiplier,10);
    assert.equal((await rpc(admin,{action:'admin_guest_accounts',filter:'all'})).total,5);
    await assert.rejects(rpc(player,{action:'save_progress',gold:'0',admin_revision:whiteholeState.admin_revision,rebirths:0,unlocked_ball_ids:['yellow','fakehole'],selected_ball_id:'fakehole'}));
    await db.exec('alter table server_settings add column gold_event jsonb');
    await db.exec(await readFile(new URL('../supabase/migrations/20261006_zz_custom_gold_event.sql',import.meta.url),'utf8'));
    const eventMigration=await readFile(new URL('../supabase/migrations/20261007_admin_ball_event.sql',import.meta.url),'utf8');
    await db.exec(eventMigration);await db.exec(eventMigration);
    await db.exec(await readFile(new URL('../supabase/migrations/20261007_hammer_level_30.sql',import.meta.url),'utf8'));
    // Upgrade an already installed wrapper, preserving subsequent hammer changes.
    const oldDefinition=(await db.query("select pg_get_functiondef('public.wakppu_api(jsonb)'::regprocedure) as definition")).rows[0].definition.replace("delete from wakppu_event_ball_progress where event_id is distinct from e->>'id';",'delete from wakppu_event_ball_progress;');
    await db.exec(oldDefinition);
    const cleanupMigration=await readFile(new URL('../supabase/migrations/20261007_admin_ball_cleanup_where.sql',import.meta.url),'utf8');
    await db.exec(cleanupMigration);await db.exec(cleanupMigration);
    const patchedDefinition=(await db.query("select pg_get_functiondef('public.wakppu_api(jsonb)'::regprocedure) as definition")).rows[0].definition;
    assert.equal(patchedDefinition,oldDefinition.replace('delete from wakppu_event_ball_progress;',"delete from wakppu_event_ball_progress where event_id is distinct from e->>'id';"));
    const eventStart={action:'admin_ball_event',mode:'start',delay_seconds:0,duration_seconds:300};
    await assert.rejects(rpc(player,eventStart),{code:'PT403'});
    await assert.rejects(rpc(admin,eventStart,true),{code:'PT403'});
    await assert.rejects(rpc(null,eventStart),{code:'PT401'});
    await assert.rejects(rpc(admin,{...eventStart,duration_seconds:0}),{code:'PT400'});
    await assert.rejects(rpc(admin,{...eventStart,delay_seconds:1.5}),{code:'PT400'});
    const event=(await rpc(admin,eventStart)).admin_ball_event;
    await assert.rejects(rpc(admin,eventStart),{code:'PT409'});
    assert.equal((await rpc(player,{action:'status'})).admin_ball_event.id,event.id);
    await db.query("update game_states set gold=0,rebirths=2,hammer_owned=true,hammer_level=10,honey_expires_at=clock_timestamp()+interval '10 minutes' where user_id=$1",[player]);
    await db.query("update server_settings set gold_event=jsonb_build_object('id','boost','multiplier',10,'starts_at',clock_timestamp()-interval '1 second','ends_at',clock_timestamp()+interval '10 minutes')");
    const hit=()=>({action:'event_ball_hit',event_id:event.id,request_id:crypto.randomUUID()});
    await assert.rejects(rpc(player,{...hit(),event_id:'fake'}),{code:'PT409'});
    for(let i=1;i<=4;i++)assert.equal((await rpc(player,hit())).clicks,i*135);
    assert.equal((await rpc(player,{action:'bootstrap'})).state.gold,'0');
    const final=hit(),payout=await rpc(player,final);
    assert.equal(payout.reward,'12000000000');
    assert.equal(payout.gold,'12000000000');
    assert.deepEqual(await rpc(player,final),payout);
    assert.equal(Number((await rpc(player,{action:'bootstrap'})).state.gold),12000000000);
    for(let i=1;i<=5;i++)await rpc(player,hit());
    assert.equal(Number((await rpc(player,{action:'bootstrap'})).state.gold),24000000000);
    // New catalog entries are automatically considered by the server, without changing payout code.
    await db.exec("insert into wakppu_ball_rewards values('future-ball',20000000)");
    await db.query("update game_states set unlocked_ball_ids=unlocked_ball_ids||'\"future-ball\"'::jsonb where user_id=$1",[player]);
    let future;for(let i=1;i<=5;i++)future=await rpc(player,hit());
    assert.equal(Number(future.reward),16000000000);
    await db.query("update server_settings set admin_ball_event=jsonb_set(admin_ball_event,'{ends_at}',to_jsonb(clock_timestamp()-interval '1 second'))");
    await assert.rejects(rpc(player,hit()),{code:'PT409'});
    await rpc(admin,{action:'admin_ball_event',mode:'stop'});
    assert.equal((await db.query('select count(*)::int as n from wakppu_event_ball_progress')).rows[0].n,0);
    assert.equal((await rpc(player,{action:'status'})).admin_ball_event,null);
    assert.ok((await rpc(admin,{action:'admin_logs'})).some(x=>x.action==='ADMIN_BALL_EVENT_STOP'));
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from wakppu_event_ball_progress'),{code:'42501'});
    await assert.rejects(db.query("select wakppu_api_before_admin_ball('{}')"),{code:'42501'});
    await db.exec('reset role');
    const alwaysMigration=await readFile(new URL('../supabase/migrations/20261010_admin_ball_always.sql',import.meta.url),'utf8');
    await db.exec(alwaysMigration);await db.exec(alwaysMigration);
    assert.equal((await rpc(admin,{action:'status'})).admin_ball_always,true);
    assert.equal((await rpc(player,{action:'status'})).admin_ball_always,false);
    assert.equal((await rpc(admin,{action:'status'},true)).admin_ball_always,false);
    const alwaysHit={action:'event_ball_hit',event_id:'admin-always',request_id:crypto.randomUUID()};
    await assert.rejects(rpc(player,alwaysHit),{code:'PT409'});
    await assert.rejects(rpc(admin,alwaysHit,true),{code:'PT409'});
    await assert.rejects(rpc(null,alwaysHit),{code:'PT401'});
    await db.query('update game_states set gold=0,hammer_owned=true,hammer_level=30 where user_id=$1',[admin]);
    await db.exec('update server_settings set gold_event=null where id=true');
    const alwaysPayout=await rpc(admin,alwaysHit);
    assert.equal(alwaysPayout.reward,'10');assert.equal(alwaysPayout.gold,'10');
    assert.deepEqual(await rpc(admin,alwaysHit),alwaysPayout);
    const second=await rpc(admin,{...alwaysHit,request_id:crypto.randomUUID()});
    assert.equal(second.gold,'20');
    await rpc(admin,{action:'admin_ball_event',mode:'start',duration_seconds:300,delay_seconds:0});
    await rpc(admin,{action:'admin_ball_event',mode:'stop'});
    assert.equal((await db.query("select count(*)::int as n from wakppu_event_ball_progress where event_id='admin-always'")).rows[0].n,1);
    await rpc(admin,{action:'admin_maintenance',enabled:true});
    assert.equal((await rpc(admin,{...alwaysHit,request_id:crypto.randomUUID()})).gold,'30');
    await rpc(admin,{action:'admin_maintenance',enabled:false});
    await db.query("update game_states set rebirths=2,honey_expires_at=clock_timestamp()+interval '1 minute' where user_id=$1",[admin]);
    await rpc(admin,{action:'admin_gold_event',mode:'start',multiplier:7,duration_seconds:60,delay_seconds:0});
    assert.equal((await rpc(admin,{...alwaysHit,request_id:crypto.randomUUID()})).reward,'560');
  } finally { await db.close(); }
});
