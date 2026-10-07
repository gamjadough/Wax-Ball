import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
const localPackage=new URL('./test-results/sql-check/package.json',import.meta.url);
const require=createRequire(existsSync(localPackage)?localPackage:new URL('../../sql-check/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
test('real PostgreSQL schedule wrapper: authorization, exact timestamps, cancellation, audit and legacy APIs',async()=>{
 const db=new PGlite(),admin='00000000-0000-0000-0000-000000000001',player='00000000-0000-0000-0000-000000000002';
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create table auth.users(id uuid primary key,is_anonymous boolean default false,email text,raw_user_meta_data jsonb default '{}',created_at timestamptz default now());
   create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
   create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
   create table players(user_id uuid primary key,nickname text unique,role text,updated_at timestamptz default now());
   create table game_states(user_id uuid primary key references players,gold bigint default 10000,rebirths smallint default 0,unlocked_ball_ids jsonb default '["yellow"]',discovered_ball_ids jsonb default '["yellow"]',selected_ball_id text default 'yellow',honey_expires_at timestamptz,updated_at timestamptz default now());
   create table moderation_cases(user_id uuid primary key,status text default 'active',suspicion_score integer default 0,strikes integer default 0,suspended_until timestamptz,last_reason text,updated_at timestamptz default now());
   create table admin_audit_logs(id bigint generated always as identity primary key,admin_user_id uuid,target_user_id uuid,action text,reason text,details jsonb,created_at timestamptz default now());
   insert into players values('${admin}','관리자','admin',now()),('${player}','유저','player',now());
   insert into game_states(user_id) values('${admin}'),('${player}');`);
  for(const name of ['20261004_accounts_and_rankings.sql','20261004_admin_exact_gold.sql','20261005_ranking_visibility_bans.sql','20261005_z_gold_event.sql','20261006_guest_lifecycle.sql','20261006_zz_custom_gold_event.sql','20261007_admin_ball_event.sql','20261014_event_schedule.sql','20261014_event_schedule.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  async function rpc(user,body,anonymous=false){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(user?{sub:user,is_anonymous:anonymous}:{})]);return (await db.query('select public.wakppu_api($1::jsonb) as data',[JSON.stringify(body)])).rows[0].data;}
  const starts_at=new Date(Date.now()+7*86400000).toISOString();
  const payload={action:'admin_event_schedule',event_type:'gold',starts_at,multiplier:7,duration_seconds:600};
  await assert.rejects(rpc(null,payload),{code:'PT401'});await assert.rejects(rpc(player,payload),{code:'PT403'});await assert.rejects(rpc(admin,payload,true),{code:'PT403'});
  for(const kind of ['gold','ball']){
   const key=kind==='gold'?'gold_event':'admin_ball_event',event=(await rpc(admin,{...payload,event_type:kind}))[key];
   assert.equal(Date.parse(event.starts_at),Date.parse(starts_at));assert.equal(Date.parse(event.ends_at)-Date.parse(event.starts_at),600000);
   assert.deepEqual((await rpc(player,{action:'status'}))[key],event);
   await assert.rejects(rpc(admin,{...payload,event_type:kind}),{code:'PT409'});
   await assert.rejects(rpc(admin,{action:'admin_event_schedule_cancel',event_type:kind,event_id:'stale'}),{code:'PT409'});
   await rpc(admin,{action:'admin_event_schedule_cancel',event_type:kind,event_id:event.id});
   assert.equal((await rpc(player,{action:'status'}))[key],null);
  }
  for(const change of [{starts_at:'bad'},{starts_at:'2026-02-30T11:00:00.000Z'},{starts_at:new Date(Date.now()-1000).toISOString()},{starts_at:new Date(Date.now()+366*86400000).toISOString()},{multiplier:1001},{duration_seconds:0},{event_type:'bad'}])await assert.rejects(rpc(admin,{...payload,...change}),{code:'PT400'});
  await rpc(admin,{action:'admin_maintenance',enabled:true});await assert.rejects(rpc(admin,payload),{code:'PT409'});await rpc(admin,{action:'admin_maintenance',enabled:false});
  const saved=(await rpc(player,{action:'bootstrap'})).state;assert.equal(saved.gold,'10000');assert.equal((await rpc(player,{action:'rankings'})).length,2);
  const logs=await rpc(admin,{action:'admin_logs'});assert.equal(logs.filter(x=>x.action==='ADMIN_EVENT_SCHEDULE').length,2);
  assert.equal((await db.query("select has_function_privilege('authenticated','public.wakppu_api_before_event_schedule(jsonb)','execute') as allowed")).rows[0].allowed,false);
 }finally{await db.close();}
});
