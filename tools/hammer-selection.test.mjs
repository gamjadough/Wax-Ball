import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';
import {createStore,execute} from './admin-service.mjs';import {itemState} from './items-service.mjs';import {hammerDamage} from './hammer-catalog.mjs';import {limitedState,limitedData} from './limited-service.mjs';
test('selected level preserves purchased maximum, exact damage in all three paths, auto and idempotency',()=>{
 const store=createStore(),p=store.players[1];store.sleep_now_ms=Date.parse('2026-10-16T03:00:00Z');store.limited_preview='ended';
 const send=(action,extra={})=>execute(store,p,{action,request_id:crypto.randomUUID(),item_revision:itemState(p).revision,...extra});
 assert.throws(()=>send('hammer_select',{level:1}));p.state.hammer_owned=true;p.state.hammer_level=30;p.state.unlocked_ball_ids=['yellow','blackhole'];p.state.selected_ball_id='blackhole';
 for(const level of [31,-1,1.5,'1'])assert.throws(()=>send('hammer_select',{level}));
 const req={action:'hammer_select',level:1,request_id:crypto.randomUUID(),item_revision:0};const r=execute(store,p,req);assert.deepEqual(execute(store,p,req),r);assert.equal(itemState(p).revision,1);assert.equal(p.state.hammer_level,30);
 assert.equal(send('item_hit').clicks,3);
 store.admin_ball_event={id:'test',starts_at:new Date(Date.now()-1000).toISOString(),ends_at:new Date(Date.now()+60000).toISOString()};assert.equal(send('event_ball_hit',{event_id:'test'}).clicks,3);
 const l=limitedState(p);l.owned[limitedData.ball.id]={reward:'1500000000'};send('limited_select',{ball_id:limitedData.ball.id});assert.equal(send('limited_hit').clicks,3);
 send('hammer_select',{level:0});assert.equal(send('item_hit').clicks,4);assert.equal(send('event_ball_hit',{event_id:'test'}).clicks,4);assert.equal(send('limited_hit').clicks,4);assert.equal(p.state.hammer_level,30);assert.equal(hammerDamage(true,30,0),1);
 send('hammer_select',{level:3});assert.equal(hammerDamage(true,30,p.state.hammer_selected_level),8);send('hammer_select',{level:null});assert.equal(p.state.hammer_selected_level,null);assert.equal(hammerDamage(true,30),hammerDamage(true,30,null));
 store.maintenance=true;assert.throws(()=>send('hammer_select',{level:1}),e=>e.status===503);
});
test('SQL: owned-level validation, replay, stale requests and selected damage for normal/limited/event balls',async()=>{
 const require=createRequire(process.env.WAKPPU_TEST_NODE_PACKAGE||new URL('./test-results/sql-check/package.json',import.meta.url));const {PGlite}=require('@electric-sql/pglite'),db=new PGlite();const admin='00000000-0000-0000-0000-000000000001',player='00000000-0000-0000-0000-000000000002';
 try{
  const fixture=await readFile(new URL('./items-sql.test.mjs',import.meta.url),'utf8');await db.exec(fixture.match(/await db\.exec\(`([\s\S]*?)`\);/)[1].replaceAll('${admin}',admin).replaceAll('${player}',player));
  for(const name of ['20261004_accounts_and_rankings.sql','20261004_admin_exact_gold.sql','20261005_ranking_visibility_bans.sql','20261005_z_gold_event.sql','20261006_rebirth_100_big_gold.sql','20261007_hammer_level_30.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  await db.exec("create or replace function public.wakppu_api(b jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$begin if b->>'action'='mark_first_play' then return '{}'::jsonb;end if;return public.wakppu_api_before_events(b);end$$;");
  for(const name of ['20261007_admin_ball_event.sql','20261006_z_whitehole.sql','20261009_transcendent_balls.sql','20261008_gem_coating.sql','20261012_items_inventory.sql','20261015_items_30.sql','20261016_halloween_reward.sql','20261017_halloween_admin_access.sql','20261019_items_remake.sql','20261016083414_admin_content_access.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  const sql=await readFile(new URL('../supabase/migrations/20261016090507_hammer_level_selection.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);const zeroSql=await readFile(new URL('../supabase/migrations/20261016091945_hammer_level_zero.sql',import.meta.url),'utf8');await db.exec(zeroSql);await db.exec(zeroSql);
  async function rpc(action,extra={},user=admin){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(user?{sub:user,is_anonymous:false}:{})]);return (await db.query('select wakppu_api($1::jsonb) as data',[JSON.stringify({action,...extra})])).rows[0].data;}
  const read=()=>rpc('items'),send=async(action,extra={})=>rpc(action,{request_id:crypto.randomUUID(),item_revision:(await read()).revision,...extra});
  await assert.rejects(send('hammer_select',{level:1}));await rpc('bootstrap');
  await db.exec(`update game_states set hammer_owned=true,hammer_level=30,selected_ball_id='blackhole' where user_id='${admin}'`);
  for(const level of [31,-1,1.5,'1'])await assert.rejects(send('hammer_select',{level}));await assert.rejects(send('hammer_select'));
  const req={request_id:crypto.randomUUID(),item_revision:(await read()).revision,level:1};const selected=await rpc('hammer_select',req);assert.deepEqual(await rpc('hammer_select',req),selected);
  await assert.rejects(rpc('hammer_select',{...req,request_id:crypto.randomUUID(),level:2}),e=>e.code==='PT409');
  const boot=await rpc('bootstrap');assert.equal(boot.state.hammer_level,30);assert.equal(boot.state.hammer_selected_level,1);
  assert.equal((await send('item_hit')).clicks,3);await db.exec("update server_settings set admin_ball_event=jsonb_build_object('id','test','starts_at',now()-interval '1 minute','ends_at',now()+interval '1 hour')");assert.equal((await send('event_ball_hit',{event_id:'test'})).clicks,3);
  await send('limited_select',{ball_id:limitedData.ball.id});assert.equal((await send('limited_hit')).clicks,3);
  const zeroReq={level:0,request_id:crypto.randomUUID(),item_revision:(await read()).revision};const zero=await rpc('hammer_select',zeroReq);assert.deepEqual(await rpc('hammer_select',zeroReq),zero);assert.equal(zero.hammer_selected_level,0);assert.equal((await rpc('bootstrap')).state.hammer_level,30);assert.equal((await rpc('bootstrap')).state.hammer_selected_level,0);assert.equal((await send('item_hit')).clicks,4);assert.equal((await send('event_ball_hit',{event_id:'test'})).clicks,4);assert.equal((await send('limited_hit')).clicks,4);
  await send('hammer_select',{level:3});assert.equal((await send('limited_hit')).clicks,12);
  await send('hammer_select',{level:null});assert.equal((await read()).hammer_selected_level,null);assert.equal((await send('limited_hit')).reward,'1500000000');
  await assert.rejects(rpc('hammer_select',{level:1,request_id:crypto.randomUUID(),item_revision:0},null));
  await db.exec('update server_settings set maintenance=true');await assert.rejects(rpc('hammer_select',{level:1,request_id:crypto.randomUUID(),item_revision:0},player),e=>e.code==='PT503');
  await db.exec('set role authenticated');await assert.rejects(db.exec('select wakppu_api_before_hammer_selection(\'{"action":"items"}\')'));await db.exec('reset role');
 }finally{await db.close();}
});
