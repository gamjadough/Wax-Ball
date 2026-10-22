import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';import {analyze} from './input-guard-service.mjs';
import {vectors} from './input-guard-vectors.mjs';
test('real SQL: replay-safe rate limiting, metrics parity, corroboration, temporary suspension, admin-only audit and private tables',async()=>{
 const require=createRequire(process.env.WAKPPU_TEST_NODE_PACKAGE||new URL('./test-results/sql-check/package.json',import.meta.url));const {PGlite}=require('@electric-sql/pglite'),db=new PGlite();const admin='00000000-0000-0000-0000-000000000001',player='00000000-0000-0000-0000-000000000002';
 const samples=(start=0,dt=100,n=180,jitter=0)=>Array.from({length:n},(_,i)=>[start+i*dt+(i%2?jitter:0),500,500]);
 try{
  const fixture=await readFile(new URL('./items-sql.test.mjs',import.meta.url),'utf8');await db.exec(fixture.match(/await db\.exec\(`([\s\S]*?)`\);/)[1].replaceAll('${admin}',admin).replaceAll('${player}',player));
  for(const name of ['20261004_accounts_and_rankings.sql','20261004_admin_exact_gold.sql','20261005_ranking_visibility_bans.sql','20261005_z_gold_event.sql','20261006_rebirth_100_big_gold.sql','20261007_hammer_level_30.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  await db.exec("create or replace function public.wakppu_api(b jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$begin if b->>'action'='mark_first_play' then return '{}'::jsonb;end if;return public.wakppu_api_before_events(b);end$$;");
  for(const name of ['20261007_admin_ball_event.sql','20261006_z_whitehole.sql','20261009_transcendent_balls.sql','20261008_gem_coating.sql','20261012_items_inventory.sql','20261015_items_30.sql','20261016_halloween_reward.sql','20261017_halloween_admin_access.sql','20261019_items_remake.sql','20261016083414_admin_content_access.sql','20261016090507_hammer_level_selection.sql','20261016091945_hammer_level_zero.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  await db.exec(`create table auth.users(id uuid primary key,is_anonymous boolean default false,email text,email_confirmed_at timestamptz,created_at timestamptz default now(),raw_user_meta_data jsonb default '{}');`);
  for(const name of ['20261019084353_manual_bank_orders.sql','20261020010000_supporter_gold_bonus.sql','20261020010100_supporter_gold_paths.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  const sql=await readFile(new URL('../supabase/migrations/20261020085313_input_guard.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
  const v2=await readFile(new URL('../supabase/migrations/20261022081610_multi_position_input_guard.sql',import.meta.url),'utf8');await db.exec(v2);await db.exec(v2);
  async function rpc(action,extra={},user=player,anonymous=false){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(user?{sub:user,is_anonymous:anonymous}:{})]);return (await db.query('select wakppu_api($1::jsonb) as data',[JSON.stringify({action,...extra})])).rows[0].data;}
  const read=()=>rpc('items'),send=async(action,extra={})=>rpc(action,{request_id:crypto.randomUUID(),item_revision:(await read()).revision,...extra});
  const cases=[samples(),samples(0,200),samples(0,60,240,17),samples(0,5,100),vectors('cycle',{n:1050}).map((p,i)=>[Math.floor(i/7)*100,p[1],p[2]]),... [3,7,8,12].flatMap(points=>[vectors('cycle',{points}),vectors('cycle',{points,pauses:true})]),...Array.from({length:20},(_,i)=>vectors(i%2?'human-loop':'random-fast',{seed:i+1,n:450}))];
  for(const input of cases){
   const actual=(await db.query('select wakppu_input_metrics($1::jsonb) m',[JSON.stringify(input)])).rows[0].m,expected=analyze(input);
   for(const key of ['count','fast','regular','suspect','cyclic','overspeed','loop_period','clusters','simultaneous'])assert.equal(actual[key],expected[key],key);for(const key of ['cps','active_cps','loop_accuracy','timing_repeat','cycle_cv','batch_ratio'])assert.ok(Math.abs(actual[key]-expected[key])<1e-7,key);assert.deepEqual(actual.reasons,JSON.parse(JSON.stringify(expected.reasons)));
  }
  for(const bad of [null,[[2,500,500],[1,500,500]],[[1,-1,0]],[[1,500.1,0]],Array(2049).fill([1,0,0])])await assert.rejects(db.query('select wakppu_input_metrics($1::jsonb)',[JSON.stringify(bad)]));
  const req={request_id:crypto.randomUUID(),item_revision:(await read()).revision};const hit=await rpc('item_hit',req);assert.deepEqual(await rpc('item_hit',req),hit);assert.equal((await db.query('select cardinality(hits) n from wakppu_input_guard where user_id=$1',[player])).rows[0].n,1);
  const before=(await read()).gold;await db.exec(`update wakppu_input_guard set tokens=0,token_at=clock_timestamp()+interval '1 day' where user_id='${player}'`);
  await assert.rejects(send('item_hit'),e=>e.code==='PT429');assert.equal((await read()).gold,before);
  await db.exec(`update wakppu_input_guard set token_at=clock_timestamp()-interval '1 second' where user_id='${player}'`);await send('item_hit');
  const session=crypto.randomUUID();const first=await send('input_report',{session_id:session,samples:samples()});assert.equal(first.input_guard.score,0);
  for(let j=1;j<=3;j++){
   await db.exec(`update wakppu_input_guard set last_report=clock_timestamp()-interval '18 seconds',first_seen=clock_timestamp()-interval '1 minute',hits=array_fill(clock_timestamp(),array[36]) where user_id='${player}'`);
   const r={request_id:crypto.randomUUID(),session_id:session,samples:samples(j*20000)};const response=await rpc('input_report',r);assert.equal(response.input_guard.score,Math.min(100,j*40));
   if(j<3){assert.deepEqual(await rpc('input_report',r),response);await assert.rejects(rpc('input_report',{...r,request_id:crypto.randomUUID()}),e=>e.code==='PT429');}
  }
  const mod=(await db.query('select * from moderation_cases where user_id=$1',[player])).rows[0];assert.equal(mod.status,'suspended');assert.equal(mod.strikes,1);assert.ok(Date.parse(mod.suspended_until)>Date.now());await assert.rejects(send('item_hit'),e=>e.code==='PT403');
  const events=await rpc('admin_input_guard',{page:0},admin);assert.equal(events.rows.length,4);assert.equal(events.rows[0].corroborated,true);assert.ok(events.rows[0].restricted_until);assert.equal(events.rows[0].metrics.samples,undefined);
  await assert.rejects(rpc('admin_input_guard',{},admin,true),e=>e.code==='PT403');await assert.rejects(rpc('input_report',{},null),e=>e.code==='PT401');
  await db.exec(`update moderation_cases set suspended_until=clock_timestamp()-interval '1 second' where user_id='${player}'`);await send('item_hit');
  await rpc('admin_unban',{user_id:player},admin);assert.equal((await db.query('select score from wakppu_input_guard where user_id=$1',[player])).rows[0].score,0);
  const evidence=async()=>db.exec(`update wakppu_input_guard set last_report=clock_timestamp()-interval '18 seconds',first_seen=clock_timestamp()-interval '1 minute',hits=array_fill(clock_timestamp(),array[36]) where user_id='${player}'`);
  for(let j=0;j<4;j++){await evidence();const r=await rpc('input_report',{request_id:crypto.randomUUID(),session_id:session,samples:vectors('random-fast',{n:450,start:100000+j*40000})});assert.equal(r.input_guard.score,0);assert.ok(r.input_guard.speed_limited_until);assert.equal(r.input_guard.restricted_until,null);}
  await db.exec(`update wakppu_input_guard set tokens=80,speed_limited_until=clock_timestamp()+interval '1 hour' where user_id='${player}'`);
  // Freeze refill for this burst assertion; slow parallel CI must not refill between statements.
  const freezeRefill=()=>db.exec(`update wakppu_input_guard set token_at=clock_timestamp()+interval '1 day' where user_id='${player}'`);
  for(let j=0;j<24;j++){await freezeRefill();await send('item_hit');}const softGold=(await read()).gold;await freezeRefill();await assert.rejects(send('item_hit'),e=>e.code==='PT429');assert.equal((await read()).gold,softGold);
  await db.exec(`update wakppu_input_guard set speed_limited_until=clock_timestamp()-interval '1 second',token_at=clock_timestamp()-interval '1 second',tokens=80 where user_id='${player}'`);for(let j=0;j<40;j++)await send('item_hit');
  await rpc('admin_unban',{user_id:player},admin);assert.equal((await db.query('select speed_limited_until from wakppu_input_guard where user_id=$1',[player])).rows[0].speed_limited_until,null);
  for(let j=0;j<3;j++){await evidence();const r=await rpc('input_report',{request_id:crypto.randomUUID(),session_id:session,samples:vectors('cycle',{start:400000+j*40000,pauses:true})});assert.equal(r.input_guard.score,Math.min(100,(j+1)*35));assert.ok(r.input_guard.speed_limited_until);if(j<2)assert.equal(r.input_guard.restricted_until,null);else assert.ok(r.input_guard.restricted_until);}
  const audit=await rpc('admin_input_guard',{page:0},admin);assert.equal(audit.rows[0].metrics.loop_period,7);assert.ok(audit.rows[0].reasons.includes('다중 위치 순환 반복'));assert.equal(audit.rows[0].metrics.samples,undefined);await rpc('admin_unban',{user_id:player},admin);
  await assert.rejects(send('input_report',{session_id:session,user_id:admin,samples:samples(100000)}));await assert.rejects(rpc('admin_input_guard'),e=>e.code==='PT403');
  await db.exec(`update server_settings set maintenance=true`);await assert.rejects(send('input_report',{session_id:session,samples:[]}),e=>e.code==='PT503');await db.exec('update server_settings set maintenance=false');
  await db.exec('set role authenticated');for(const table of ['wakppu_input_guard','wakppu_input_events','wakppu_input_reports'])await assert.rejects(db.exec('select * from '+table));await assert.rejects(db.exec("select wakppu_input_metrics('[]')"));await assert.rejects(db.exec("select wakppu_api_before_input_guard('{\"action\":\"items\"}')"));await db.exec('reset role');
 }finally{await db.close();}
});
