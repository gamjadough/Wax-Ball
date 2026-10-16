import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createStore,execute,ballIds} from './admin-service.mjs';
import {itemData,itemState,itemAction} from './items-service.mjs';
const migration=new URL('../supabase/migrations/20261016083414_admin_content_access.sql',import.meta.url);
test('local: automatic catalog access, reusable admin items, ordinary stock and revoked/anonymous access',()=>{
 const store=createStore(),admin=store.players[0],player=store.players[1];store.sleep_now_ms=Date.parse('2026-10-16T03:00:00Z');
 assert.equal(execute(store,admin,{action:'bootstrap'}).state.unlocked_ball_ids.length,ballIds.length);
 assert.equal(execute(store,player,{action:'bootstrap'}).state.unlocked_ball_ids.length,1);
 const read=()=>execute(store,admin,{action:'items'}),d=itemData.list[0];
 assert.equal(Object.keys(read().inventory).length,itemData.list.length);assert.equal(read().admin_content_access,true);
 const req={action:'item_use',item_id:d.id,request_id:crypto.randomUUID(),item_revision:read().revision};
 const result=execute(store,admin,req);assert.deepEqual(execute(store,admin,req),result);assert.equal(itemState(admin).inventory[d.id],undefined);
 assert.equal(execute(store,admin,{action:'item_use',item_id:d.id,request_id:crypto.randomUUID(),item_revision:read().revision}).inventory[d.id],1);
 assert.throws(()=>execute(store,admin,{action:'item_use',item_id:'invalid',request_id:crypto.randomUUID(),item_revision:read().revision}));
 itemState(player).inventory[d.id]=1;itemAction(player,{action:'item_use',item_id:d.id,request_id:crypto.randomUUID(),item_revision:0});assert.equal(itemState(player).inventory[d.id],0);
 admin.is_anonymous=true;assert.equal(read().admin_content_access,false);assert.equal(read().inventory[d.id],undefined);
 admin.is_anonymous=false;admin.role='player';assert.equal(read().admin_content_access,false);
 assert.throws(()=>execute(store,admin,{action:'item_use',item_id:d.id,request_id:crypto.randomUUID(),item_revision:read().revision}));
});
test('SQL: catalog additions auto-open; administrator item use preserves purchased stock and wrapper behavior',async()=>{
 const require=createRequire(process.env.WAKPPU_TEST_NODE_PACKAGE||new URL('./test-results/sql-check/package.json',import.meta.url));const {PGlite}=require('@electric-sql/pglite'),db=new PGlite();
 const admin='00000000-0000-0000-0000-000000000001',player='00000000-0000-0000-0000-000000000002';
 try{
  const fixture=await readFile(new URL('./items-sql.test.mjs',import.meta.url),'utf8');await db.exec(fixture.match(/await db\.exec\(`([\s\S]*?)`\);/)[1].replaceAll('${admin}',admin).replaceAll('${player}',player));
  for(const name of ['20261004_accounts_and_rankings.sql','20261004_admin_exact_gold.sql','20261005_ranking_visibility_bans.sql','20261005_z_gold_event.sql','20261006_rebirth_100_big_gold.sql','20261007_hammer_level_30.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  await db.exec("create or replace function public.wakppu_api(b jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$begin if b->>'action'='mark_first_play' then return '{}'::jsonb;end if;return public.wakppu_api_before_events(b);end$$;");
  for(const name of ['20261007_admin_ball_event.sql','20261006_z_whitehole.sql','20261009_transcendent_balls.sql','20261008_gem_coating.sql','20261012_items_inventory.sql','20261015_items_30.sql','20261016_halloween_reward.sql','20261017_halloween_admin_access.sql','20261019_items_remake.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  const sql=await readFile(migration,'utf8');await db.exec(sql);await db.exec(sql);
  async function rpc(action,extra={},user=admin,anonymous=false){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(user?{sub:user,is_anonymous:anonymous}:{})]);return (await db.query('select wakppu_api($1::jsonb) as data',[JSON.stringify({action,...extra})])).rows[0].data;}
  const read=()=>rpc('items'),send=async(action,extra={})=>rpc(action,{request_id:crypto.randomUUID(),item_revision:(await read()).revision,...extra});
  const boot=await rpc('bootstrap');assert.equal(boot.state.unlocked_ball_ids.length,24);assert.equal(boot.state.discovered_ball_ids.length,24);
  assert.equal((await rpc('bootstrap',{},player)).state.unlocked_ball_ids.length,1);
  const items=await read();assert.equal(Object.keys(items.inventory).length,30);assert.equal(items.admin_content_access,true);
  const d='common_honey_small',req={request_id:crypto.randomUUID(),item_revision:items.revision,item_id:d};
  const used=await rpc('item_use',req);assert.deepEqual(await rpc('item_use',req),used);assert.equal(used.inventory[d],1);
  assert.deepEqual((await db.query('select inventory from wakppu_items where user_id=$1',[admin])).rows[0].inventory,{});
  await send('item_use',{item_id:d});await assert.rejects(send('item_use',{item_id:'invalid'}));
  await db.exec(`update wakppu_items set inventory='{"common_honey_small":7}' where user_id='${admin}'`);await send('item_use',{item_id:d});assert.equal((await read()).inventory[d],7);
  await db.exec("insert into wakppu_item_defs values('future_test_item','common',1,'reward',125,0,'break');insert into wakppu_item_balls values('future_test_ball',100,123);");
  assert.equal((await read()).inventory.future_test_item,1);assert.ok((await rpc('bootstrap')).state.unlocked_ball_ids.includes('future_test_ball'));await send('item_use',{item_id:'future_test_item'});
  const normal=await rpc('items',{},player);assert.deepEqual(normal.inventory,{});assert.equal(normal.admin_content_access,undefined);
  assert.equal((await rpc('items',{},admin,true)).admin_content_access,undefined);
  await assert.rejects(rpc('item_use',{request_id:crypto.randomUUID(),item_revision:(await read()).revision,item_id:'future_test_item'},admin,true));
  await db.exec(`update players set role='player' where user_id='${admin}'`);assert.equal((await read()).admin_content_access,undefined);
  await assert.rejects(send('item_use',{item_id:'future_test_item'}));
  await db.exec(`update players set role='admin' where user_id='${admin}';insert into moderation_cases(user_id,status) values('${admin}','banned') on conflict(user_id) do update set status='banned'`);await assert.rejects(read());
  await db.exec('set role authenticated');await assert.rejects(db.exec('select wakppu_admin_content_access()'));await assert.rejects(db.exec('select wakppu_api_before_admin_content(\'{"action":"items"}\')'));await db.exec('reset role');
 }finally{await db.close();}
});
