import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
const pkg=new URL('./test-results/sql-check/package.json',import.meta.url);
const require=createRequire(existsSync(pkg)?pkg:new URL('../../sql-check/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
test('independent weekly/manual events: reservation, overlap rewards, resume, persistence and permissions',async()=>{
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
   insert into game_states(user_id) values('${admin}'),('${player}');
   create schema cron;create table cron.job(jobname text primary key,schedule text,command text);
   create function cron.schedule(text,text,text) returns bigint language plpgsql as $$begin insert into cron.job values($1,$2,$3);return 1;end$$;`);
  for(const name of ['20261004_accounts_and_rankings.sql','20261004_admin_exact_gold.sql','20261005_ranking_visibility_bans.sql','20261005_z_gold_event.sql','20261006_guest_lifecycle.sql','20261006_zz_custom_gold_event.sql','20261007_admin_ball_event.sql','20261014_event_schedule.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261007_hammer_level_30.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261014_sleep_hours.sql',import.meta.url),'utf8'));
  assert.equal((await db.query("select public.wakppu_sleep_hours('2026-10-16T07:00:00+09:00') as h")).rows[0].h.active,false);
  const sql=await readFile(new URL('../supabase/migrations/20261020_weekly_events.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);

  const separation=await readFile(new URL('../supabase/migrations/20261021084436_separate_weekly_manual_events.sql',import.meta.url),'utf8');await db.exec(separation);await db.exec(separation);
  async function rpc(user,b,anonymous=false){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(user?{sub:user,is_anonymous:anonymous}:{})]);return (await db.query('select public.wakppu_api($1::jsonb) as data',[JSON.stringify(b)])).rows[0].data;}
  for(const [user,anon,code] of [[null,false,'PT401'],[player,false,'PT403'],[admin,true,'PT403']])await assert.rejects(rpc(user,{action:'admin_gold_event',mode:'start'},anon),{code});
  await rpc(admin,{action:'admin_weekly_events',mode:'enable'});
  for(const action of ['admin_gold_event','admin_ball_event']){
   const start=await rpc(admin,{action,mode:'start',delay_seconds:0,duration_seconds:60,multiplier:7});
   assert.ok(action==='admin_gold_event'?start.manual_gold_event:start.manual_ball_event);
   await rpc(admin,{action,mode:'stop'});
  }
  await db.exec("update wakppu_weekly_events set enabled=(id='friday-morning'),weekday=extract(isodow from clock_timestamp() at time zone 'Asia/Seoul'),local_time=((clock_timestamp() at time zone 'Asia/Seoul')-interval '5 seconds')::time,multiplier=100;");
  const weekly=await rpc(player,{action:'status'});assert.equal(weekly.gold_event.multiplier,100);assert.equal(weekly.manual_gold_event,null);
  await db.query('update game_states set gold=0,hammer_owned=true,hammer_level=30 where user_id=$1',[player]);
  const req={action:'event_ball_hit',event_id:weekly.admin_ball_event.id,request_id:crypto.randomUUID()};
  const reward=await rpc(player,req);assert.equal(reward.reward,'1000');assert.deepEqual(await rpc(player,req),reward);
  await db.query('update wakppu_event_ball_progress set clicks=37 where user_id=$1 and event_id=$2',[player,weekly.admin_ball_event.id]);
  await rpc(admin,{action:'admin_gold_event',mode:'start',delay_seconds:0,duration_seconds:60,multiplier:7});
  const manual=await rpc(admin,{action:'admin_ball_event',mode:'start',delay_seconds:0,duration_seconds:60});
  assert.equal(manual.gold_event.multiplier,7);assert.notEqual(manual.admin_ball_event.id,weekly.admin_ball_event.id);
  assert.equal((await db.query('select clicks from wakppu_event_ball_progress where user_id=$1 and event_id=$2',[player,weekly.admin_ball_event.id])).rows[0].clicks,37);
  const manualReward=await rpc(player,{...req,event_id:manual.admin_ball_event.id,request_id:crypto.randomUUID()});assert.equal(manualReward.reward,'70');
  await rpc(admin,{action:'admin_ball_event',mode:'stop'});const resumed=await rpc(admin,{action:'admin_gold_event',mode:'stop'});
  assert.equal(resumed.gold_event.multiplier,100);assert.equal(resumed.admin_ball_event.id,weekly.admin_ball_event.id);assert.equal(resumed.manual_ball_event,null);
  const future=new Date(Date.now()+3600000).toISOString();
  const scheduled=await rpc(admin,{action:'admin_event_schedule',event_type:'gold',starts_at:future,duration_seconds:600,multiplier:9});
  assert.equal(Date.parse(scheduled.manual_gold_event.starts_at),Date.parse(future));
  assert.equal(scheduled.gold_event.source,'weekly');
  const id=scheduled.manual_gold_event.id;
  await rpc(admin,{action:'admin_weekly_events',mode:'disable'});
  const after=await rpc(player,{action:'status'});assert.equal(after.manual_gold_event.id,id);assert.equal(after.gold_event.id,id);
  await db.exec(separation);assert.equal((await rpc(player,{action:'status'})).manual_gold_event.id,id);
  await rpc(admin,{action:'admin_event_schedule_cancel',event_type:'gold',event_id:id});assert.equal((await rpc(player,{action:'status'})).manual_gold_event,null);
  for(const fn of ['wakppu_separate_event(jsonb,jsonb,timestamptz)','wakppu_separate_weekly_api(jsonb)'])assert.equal((await db.query("select has_function_privilege('authenticated',$1,'execute') as allowed",['public.'+fn])).rows[0].allowed,false);
 }finally{await db.close();}
});
