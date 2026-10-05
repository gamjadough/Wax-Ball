import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(new URL('./test-results/sql-check/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
const admin='00000000-0000-0000-0000-000000000001',player='00000000-0000-0000-0000-000000000002';
test('real PostgreSQL event permissions, singleton, fixed schedule, expiry, audit and existing APIs',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
   create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
   grant usage on schema auth to anon,authenticated;
   create table players(user_id uuid primary key,nickname text unique,role text,updated_at timestamptz default now());
   create table game_states(user_id uuid primary key references players,gold bigint default 10000,rebirths smallint default 0,unlocked_ball_ids jsonb default '["yellow"]',discovered_ball_ids jsonb default '["yellow"]',selected_ball_id text default 'yellow',honey_expires_at timestamptz,updated_at timestamptz default now());
   create table moderation_cases(user_id uuid primary key,status text default 'active',suspicion_score integer default 0,strikes integer default 0,suspended_until timestamptz,last_reason text,updated_at timestamptz default now());
   create table admin_audit_logs(id bigint generated always as identity primary key,admin_user_id uuid,target_user_id uuid,action text,reason text,details jsonb,created_at timestamptz default now());
   insert into players values('${admin}','관리자','admin',now()),('${player}','유저','player',now());
   insert into game_states(user_id) values('${admin}'),('${player}');`);
  for(const name of ['20261004_accounts_and_rankings.sql','20261004_admin_exact_gold.sql','20261005_clear_announcement.sql','20261005_ranking_visibility_bans.sql','20261005_z_gold_event.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  async function rpc(user,body,anonymous=false){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(user?{sub:user,is_anonymous:anonymous}:{})]);return (await db.query('select wakppu_api($1::jsonb) as data',[JSON.stringify(body)])).rows[0].data;}
  const start={action:'admin_gold_event',mode:'start',multiplier:1000};
  await assert.rejects(rpc(null,start),{code:'PT401'});await assert.rejects(rpc(player,start),{code:'PT403'});await assert.rejects(rpc(admin,start,true),{code:'PT403'});
  const result=await rpc(admin,start),event=result.gold_event;
  assert.equal(event.multiplier,10);assert.equal(Date.parse(event.starts_at)-Date.parse(result.server_time),30000);assert.equal(Date.parse(event.ends_at)-Date.parse(event.starts_at),60000);
  await assert.rejects(rpc(admin,start),{code:'PT409'});
  assert.deepEqual((await rpc(player,{action:'status'})).gold_event,event);
  await rpc(admin,{action:'admin_gold_event',mode:'stop'});assert.equal((await rpc(player,{action:'status'})).gold_event,null);
  await rpc(admin,{action:'admin_maintenance',enabled:true});await assert.rejects(rpc(admin,start),{code:'PT409'});await rpc(admin,{action:'admin_maintenance',enabled:false});
  await db.query("update server_settings set gold_event=jsonb_build_object('id','expired','multiplier',10,'starts_at',clock_timestamp()-interval '61 seconds','ends_at',clock_timestamp()-interval '1 second') where id=true");
  await rpc(admin,start);
  await rpc(admin,{action:'admin_announcement',message:'기존 공지'});assert.equal((await rpc(player,{action:'status'})).announcement.message,'기존 공지');
  assert.equal((await rpc(player,{action:'bootstrap'})).state.gold,'10000');assert.equal((await rpc(player,{action:'rankings'})).length,2);
  const logs=await rpc(admin,{action:'admin_logs'});assert.equal(logs.filter(x=>x.action.startsWith('ADMIN_GOLD_EVENT')).length,3);
  const grants=(await db.query("select has_function_privilege('authenticated','public.wakppu_api_before_events(jsonb)','execute') as core,has_function_privilege('authenticated','public.wakppu_api(jsonb)','execute') as wrapper")).rows[0];assert.equal(grants.core,false);assert.equal(grants.wrapper,true);
  await db.exec('set role authenticated');await assert.rejects(rpc(player,start),{code:'PT403'});await db.exec('reset role');
 }finally{await db.close();}
});
