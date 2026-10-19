import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
const pkg=new URL('./test-results/sql-check/package.json',import.meta.url);
const require=createRequire(existsSync(pkg)?pkg:new URL('../../sql-check/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
test('PostgreSQL weekly windows: KST, exact boundaries, rollover, manual precedence, cancel, roles, idempotence and cron',async()=>{
 const db=new PGlite(),admin='00000000-0000-0000-0000-000000000001',player='00000000-0000-0000-0000-000000000002';
 try{
  // Fresh-install order: the new patch predates legacy future-named table creation.
  await db.exec(await readFile(new URL('../supabase/migrations/20261019081000_friday_evening_2130.sql',import.meta.url),'utf8'));
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
  const initial=(await db.query('select * from game_states order by user_id')).rows;
  async function rpc(user,b,anonymous=false){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(user?{sub:user,is_anonymous:anonymous}:{})]);return (await db.query('select public.wakppu_api($1::jsonb) as data',[JSON.stringify(b)])).rows[0].data;}
  for(const [user,anon,code] of [[null,false,'PT401'],[player,false,'PT403'],[admin,true,'PT403']])await assert.rejects(rpc(user,{action:'admin_weekly_events',mode:'enable'},anon),{code});
  await assert.rejects(rpc(admin,{action:'admin_weekly_events',mode:'bad'}),{code:'PT400'});
  const enabled=await rpc(admin,{action:'admin_weekly_events',mode:'enable'});assert.equal(enabled.weekly_events.filter(r=>r.enabled).length,2);
  assert.equal((await db.query('select count(*)::int as n from cron.job')).rows[0].n,1);
  await db.exec(sql);assert.equal((await db.query('select count(*)::int as n from wakppu_weekly_events where enabled')).rows[0].n,2);
  const candidate=async(kind,time)=>(await db.query('select public.wakppu_weekly_candidate($1,$2::timestamptz) as e',[kind,time])).rows[0].e;
  let e=await candidate('gold','2026-10-13T00:00:00+09:00');assert.equal(Date.parse(e.starts_at),Date.parse('2026-10-16T07:00:00+09:00'));assert.equal(e.multiplier,10);
  const first=e.id;assert.equal((await candidate('gold','2026-10-16T07:00:00+09:00')).id,first);
  e=await candidate('gold','2026-10-16T07:10:00+09:00');assert.equal(Date.parse(e.starts_at),Date.parse('2026-10-16T21:30:00+09:00'));assert.equal(e.multiplier,100);
  e=await candidate('ball','2026-10-16T21:40:00+09:00');assert.equal(Date.parse(e.ends_at),Date.parse('2026-10-16T21:45:00+09:00'));
  e=await candidate('gold','2026-10-16T21:40:00+09:00');assert.equal(Date.parse(e.starts_at),Date.parse('2026-10-23T07:00:00+09:00'));
  e=await candidate('ball','2026-10-16T21:45:00+09:00');assert.equal(Date.parse(e.starts_at),Date.parse('2026-10-23T07:00:00+09:00'));
  for(const time of ['2026-12-31T23:59:59+09:00','2027-01-01T07:00:00+09:00']){e=await candidate('gold',time);assert.equal(Date.parse(e.starts_at),Date.parse('2027-01-01T07:00:00+09:00'));}
  // Real settings, independent end times and repeated scheduler calls do not recreate IDs.
  await db.query('select public.wakppu_refresh_weekly_events($1::timestamptz)',['2026-10-16T21:30:00+09:00']);
  let settings=(await db.query('select gold_event,admin_ball_event from server_settings')).rows[0];const eveningId=settings.admin_ball_event.id;
  await db.query('select public.wakppu_refresh_weekly_events($1::timestamptz)',['2026-10-16T21:40:00+09:00']);
  settings=(await db.query('select gold_event,admin_ball_event from server_settings')).rows[0];assert.equal(settings.admin_ball_event.id,eveningId);assert.equal(settings.gold_event.multiplier,10);
  await db.query('select public.wakppu_refresh_weekly_events($1::timestamptz)',['2026-10-16T21:40:00+09:00']);assert.deepEqual((await db.query('select gold_event,admin_ball_event from server_settings')).rows[0],settings);
  // Manual scheduled event overrides only a future weekly window and survives refresh/disable.
  await db.exec("update server_settings set gold_event=null,admin_ball_event=null");await rpc(admin,{action:'admin_weekly_events',mode:'list'});
  const start=new Date(Date.now()+86400000).toISOString();const manual=(await rpc(admin,{action:'admin_event_schedule',event_type:'gold',starts_at:start,multiplier:7,duration_seconds:600})).gold_event;
  assert.equal((await rpc(player,{action:'status'})).gold_event.id,manual.id);
  await rpc(admin,{action:'admin_weekly_events',mode:'disable'});assert.equal((await rpc(player,{action:'status'})).gold_event.id,manual.id);
  await rpc(admin,{action:'admin_event_schedule_cancel',event_type:'gold',event_id:manual.id});
  const again=await rpc(admin,{action:'admin_weekly_events',mode:'enable'});const canceled=again.gold_event;
  await rpc(admin,{action:'admin_event_schedule_cancel',event_type:'gold',event_id:canceled.id});
  assert.notEqual((await rpc(player,{action:'status'})).gold_event.id,canceled.id);
  assert.ok(!(await rpc(player,{action:'status'})).weekly_events);assert.equal((await rpc(admin,{action:'status'})).weekly_events.length,2);
  await rpc(admin,{action:'admin_maintenance',enabled:true});await assert.rejects(rpc(admin,{action:'admin_weekly_events',mode:'enable'}),{code:'PT409'});await rpc(admin,{action:'admin_maintenance',enabled:false});
  await rpc(admin,{action:'admin_weekly_events',mode:'disable'});assert.equal((await rpc(player,{action:'status'})).gold_event,null);
  assert.deepEqual((await db.query('select * from game_states order by user_id')).rows,initial);
  // A real weekly ball break receives Gold x100 and retry cannot pay twice.
  await db.exec("update wakppu_weekly_events set enabled=(id='friday-morning'),weekday=extract(isodow from clock_timestamp() at time zone 'Asia/Seoul'),local_time=((clock_timestamp() at time zone 'Asia/Seoul')-interval '5 seconds')::time,multiplier=100;update server_settings set gold_event=null,admin_ball_event=null;");
  const live=await rpc(player,{action:'status'});assert.equal(live.gold_event.multiplier,100);
  let hit,lastRequest;for(let i=0;i<600;i++){lastRequest={action:'event_ball_hit',event_id:live.admin_ball_event.id,request_id:crypto.randomUUID()};hit=await rpc(player,lastRequest);}
  assert.equal(hit.reward,'1000');assert.deepEqual(await rpc(player,lastRequest),hit);
  assert.equal((await db.query('select gold from game_states where user_id=$1',[player])).rows[0].gold,11000);
  for(const fn of ['wakppu_api_before_weekly_events(jsonb)','wakppu_weekly_candidate(text,timestamptz)','wakppu_refresh_weekly_events(timestamptz)'])assert.equal((await db.query("select has_function_privilege('authenticated',$1,'execute') as allowed",['public.'+fn])).rows[0].allowed,false);
  await db.exec('set role authenticated');await assert.rejects(db.exec('select * from wakppu_weekly_events'));await assert.rejects(db.exec('update wakppu_weekly_events set enabled=true'));await db.exec('reset role');
 }finally{await db.close();}
});
