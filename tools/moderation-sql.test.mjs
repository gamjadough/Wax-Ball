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
      create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
      grant usage on schema auth to anon,authenticated;
      create table players(user_id uuid primary key,nickname text unique,role text,updated_at timestamptz default now());
      create table game_states(user_id uuid primary key references players,gold bigint default 10000,rebirths smallint default 0,
        unlocked_ball_ids jsonb default '["yellow"]',discovered_ball_ids jsonb default '["yellow"]',selected_ball_id text default 'yellow',
        honey_expires_at timestamptz,updated_at timestamptz default now());
      create table moderation_cases(user_id uuid primary key references players,status text not null default 'active' check(status in ('active','suspended','banned')),
        suspicion_score integer not null default 0,strikes integer not null default 0,suspended_until timestamptz,last_reason text,updated_at timestamptz default now());
      create table admin_audit_logs(id bigint generated always as identity primary key,admin_user_id uuid,target_user_id uuid,
        action text,reason text,details jsonb,created_at timestamptz default now());
      insert into players values('${admin}','관리자','admin',now()),('${player}','플레이어','player',now());
      insert into game_states(user_id) values('${admin}'),('${player}');
    `);
    for(const name of ['20261004_accounts_and_rankings.sql','20261004_admin_exact_gold.sql','20261005_clear_announcement.sql','20261005_ranking_visibility_bans.sql'])
      await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
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
  } finally { await db.close(); }
});
