import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(new URL('./test-results/sql-check/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
const admin='00000000-0000-0000-0000-000000000001',player='00000000-0000-0000-0000-000000000002';
test('transcendent migration saves exact large prices, all new IDs and event rewards',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
   create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
   create table players(user_id uuid primary key,nickname text,role text,updated_at timestamptz default now());
   create table game_states(user_id uuid primary key references players,gold bigint default 0,rebirths smallint default 0,unlocked_ball_ids jsonb default '["yellow"]',discovered_ball_ids jsonb default '["yellow"]',selected_ball_id text default 'yellow',honey_expires_at timestamptz,updated_at timestamptz default now());
   create table moderation_cases(user_id uuid primary key,status text default 'active',suspicion_score integer default 0,strikes integer default 0,suspended_until timestamptz,last_reason text,updated_at timestamptz default now());
   create table admin_audit_logs(id bigint generated always as identity primary key,admin_user_id uuid,target_user_id uuid,action text,reason text,details jsonb,created_at timestamptz default now());
   insert into players values('${admin}','관리자','admin',now()),('${player}','플레이어','player',now());
   insert into game_states(user_id) values('${admin}'),('${player}');`);
  for(const name of ['20261004_accounts_and_rankings.sql','20261004_admin_exact_gold.sql','20261005_ranking_visibility_bans.sql','20261005_z_gold_event.sql','20261006_rebirth_100_big_gold.sql','20261007_hammer_level_30.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  // Isolate the base save and event wrappers from the unrelated guest cleanup fixture.
  await db.exec("create or replace function public.wakppu_api(b jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$begin if b->>'action'='mark_first_play' then return '{}'::jsonb; end if; return public.wakppu_api_before_events(b); end$$;");
  await db.exec(await readFile(new URL('../supabase/migrations/20261007_admin_ball_event.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261006_z_whitehole.sql',import.meta.url),'utf8'));
  const tierSql=await readFile(new URL('../supabase/migrations/20261009_transcendent_balls.sql',import.meta.url),'utf8');
  await db.exec(tierSql);await db.exec(tierSql);
  const sql=await readFile(new URL('../supabase/migrations/20261008_gem_coating.sql',import.meta.url),'utf8');
  await db.exec(sql);await db.exec(sql);
  async function rpc(user,body){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(user?{sub:user,is_anonymous:false}:{})]);return (await db.query('select wakppu_api($1::jsonb) as data',[JSON.stringify(body)])).rows[0].data;}
  const {ballCatalog}=await import('./event-ball-catalog.mjs');
  const catalog=await ballCatalog();const tiers=catalog.slice(14);
  assert.equal(tiers.length,10);
  for(const b of tiers){
   await rpc(player,{action:'save_progress',gold:'1000000000000000000000001',admin_revision:0,rebirths:0,unlocked_ball_ids:['yellow',b.id],discovered_ball_ids:[b.id],selected_ball_id:b.id});
   const state=(await rpc(player,{action:'bootstrap'})).state;
   assert.equal(state.gold,'1000000000000000000000001');assert.equal(state.selected_ball_id,b.id);
   assert.equal(Number((await db.query('select reward from wakppu_ball_rewards where ball_id=$1',[b.id])).rows[0].reward),b.reward);
  }
  await assert.rejects(rpc(player,{action:'save_progress',gold:'0',rebirths:0,unlocked_ball_ids:['fake-ball'],selected_ball_id:'fake-ball'}));
  const deadline=new Date(Date.now()+900000).toISOString();
  const save={action:'save_progress',gold:'0',admin_revision:0,rebirths:2,hammer_owned:true,hammer_level:10,unlocked_ball_ids:['yellow'],selected_ball_id:'yellow',discovered_ball_ids:['yellow'],honey_expires_at:new Date(Date.now()+600000).toISOString(),coating_expires_at:deadline};
  await rpc(player,save);
  assert.equal(Date.parse((await rpc(player,{action:'bootstrap'})).state.coating_expires_at),Date.parse(deadline));
  await assert.rejects(rpc(null,save));
  await db.query("update server_settings set gold_event=jsonb_build_object('multiplier',10,'starts_at',clock_timestamp()-interval '1 second','ends_at',clock_timestamp()+interval '10 minutes') where id=true");
  const event=(await rpc(admin,{action:'admin_ball_event',mode:'start',duration_seconds:300,delay_seconds:0})).admin_ball_event;
  const hit=()=>rpc(player,{action:'event_ball_hit',event_id:event.id,request_id:crypto.randomUUID()});
  for(let i=1;i<=8;i++){const r=await hit();assert.equal(r.clicks,i*135);assert.equal(r.required_clicks,1200);assert.equal(r.reward,'0');}
  assert.equal((await hit()).reward,'2400');
  await db.query("update game_states set coating_expires_at=clock_timestamp()-interval '1 second' where user_id=$1",[player]);
  for(let i=1;i<=4;i++){const r=await hit();assert.equal(r.required_clicks,600);assert.equal(r.reward,'0');}
  assert.equal((await hit()).reward,'800');
  await rpc(player,{...save,rebirths:3,coating_expires_at:null,honey_expires_at:null});
  assert.equal((await rpc(player,{action:'bootstrap'})).state.coating_expires_at,null);
  assert.equal((await rpc(player,{action:'rankings'})).length,2);
 }finally{await db.close();}
});
