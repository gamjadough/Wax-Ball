import {test} from 'node:test';import assert from 'node:assert/strict';
import {gemBallFixture,a,p} from './gem-ball-fixture.mjs';import {publicFixture} from './public-server-fixture.mjs';
import {createStore} from './admin-service.mjs';import {execute} from './gem-boost-service.mjs';import {gemState,gemReward} from './blue-gem-data.mjs';import {boostState,boostSnapshot} from './gem-boost-data.mjs';import {itemState,itemData} from './items-service.mjs';
import {readFile} from 'node:fs/promises';

test('local consumable: paid stock, duration stacking, expiry, ordinary gems and no draw-pool changes',()=>{
 const store=createStore(),user=store.players[1],admin=store.players[0];store.sleep_now_ms=Date.parse('2026-10-29T03:00:00Z');gemState(user).balance=300n;
 const send=(actor,action,more={})=>execute(store,actor,{action,request_id:crypto.randomUUID(),item_revision:itemState(actor).revision,...more});
 const req={action:'blue_gem_boost_buy',request_id:crypto.randomUUID(),item_revision:0,gem_revision:0};
 const r=execute(store,user,req);assert.deepEqual(execute(store,user,req),r);assert.equal(gemState(user).balance,200n);assert.equal(r.inventory.blue_gem_boost,1);assert.equal(r.blue_gems.boost.active_multiplier,1);
 send(user,'blue_gem_boost_buy',{gem_revision:gemState(user).revision});send(user,'item_use',{item_id:'blue_gem_boost'});const expiry=boostState(user).expires;send(user,'item_use',{item_id:'blue_gem_boost'});assert.equal(boostState(user).expires-expiry,600000);assert.equal(boostSnapshot(user).active_multiplier,2);assert.equal(boostState(user).stock,0);
 const before=gemState(user).balance;assert.equal(gemReward(user,10n),10n);assert.equal(gemState(user).balance-before,2n);assert.equal(boostSnapshot(user,boostState(user).expires).active_multiplier,1);
 boostState(admin).stock=3;send(admin,'item_use',{item_id:'blue_gem_boost'});assert.equal(boostState(admin).stock,3);assert.equal(boostState(admin).expires,0);assert.equal(boostSnapshot(admin).active_multiplier,2);admin.is_anonymous=true;assert.equal(boostSnapshot(admin).active_multiplier,1);
 assert.equal(itemData.list.length,30);assert.ok(!itemData.list.some(d=>d.id==='blue_gem_boost'));assert.equal(itemData.effective({blue_gem_boost:{expires_at:Date.now()+10000}}).gem.value,200);
});

test('deployment probe rolls back all synthetic writes and preserves both maintenance states',async()=>{
 const {db}=await publicFixture();try{const before=(await db.query('select count(*) n from auth.users')).rows[0].n;const probe=await readFile(new URL('./gem-boost-production-check.sql',import.meta.url),'utf8');for(const paused of [false,true]){await db.query('update server_settings set maintenance=$1',[paused]);await db.exec(probe);assert.equal((await db.query('select count(*) n from auth.users')).rows[0].n,before);assert.equal((await db.query('select maintenance from server_settings')).rows[0].maintenance,paused);}}finally{await db.close();}
});

for(const realm of ['friends','public'])test('SQL '+realm+': purchase/use replay, CAS, all rewards, expiry, rebirth, admin and private access',async()=>{
 const f=realm==='friends'?await gemBallFixture():await publicFixture(),db=f.db,uid=realm==='friends'?p:crypto.randomUUID(),aid=realm==='friends'?a:crypto.randomUUID();
 const rpc=(action,more={},actor=uid,anon=false)=>realm==='friends'?f.rpc(action,more,actor,anon):f.rpc(actor,{action,...more},anon);
 const send=async(action,more={},actor=uid)=>rpc(action,{request_id:crypto.randomUUID(),item_revision:(await rpc('items',{},actor)).revision,...more},actor);
 try{
  if(realm==='public'){await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'boost-player@example.invalid',now()),($2,'boost-admin@example.invalid',now())",[uid,aid]);await db.query("update players set role='admin' where user_id=$1",[aid]);}
  await rpc('bootstrap');await db.query('insert into wakppu_blue_gems(user_id,balance) values($1,300) on conflict(user_id) do update set balance=300',[uid]);
  const buy=async()=>send('blue_gem_boost_buy',{gem_revision:(await rpc('blue_gems')).revision});
  const request={request_id:crypto.randomUUID(),item_revision:(await rpc('items')).revision,gem_revision:(await rpc('blue_gems')).revision};let r=await rpc('blue_gem_boost_buy',request);
  assert.equal(r.blue_gems.balance,'200');assert.equal(r.inventory.blue_gem_boost,1);assert.equal(r.blue_gems.boost.active_multiplier,1);assert.deepEqual(await rpc('blue_gem_boost_buy',request),r);
  await assert.rejects(rpc('blue_gem_boost_buy',{...request,gem_revision:999}),{code:'PT409'});
  await assert.rejects(send('blue_gem_boost_buy',{gem_revision:-1}),{code:'PT409'});await assert.rejects(send('blue_gem_boost_buy',{gem_revision:1,price:0}),{code:'PT403'});
  await buy();await buy();await assert.rejects(buy(),{code:'PT400'});
  const use={request_id:crypto.randomUUID(),item_revision:(await rpc('items')).revision,item_id:'blue_gem_boost'};r=await rpc('item_use',use);assert.deepEqual(await rpc('item_use',use),r);assert.equal(r.inventory.blue_gem_boost,2);assert.equal(r.blue_gems.boost.active_multiplier,2);const expiry=r.effects.blue_gem_boost.expires_at;
  r=await send('item_use',{item_id:'blue_gem_boost'});assert.equal(r.effects.blue_gem_boost.expires_at-expiry,600000);assert.equal(r.blue_gems.boost.active_multiplier,2);
  await db.query('update game_states set hammer_owned=true,hammer_level=30,hammer_selected_level=30 where user_id=$1',[uid]);
  const gold=(await rpc('items')).gold;r=await send('item_hit');assert.equal(r.blue_gems.balance,'2');assert.equal(BigInt(r.gold)-BigInt(gold),1n);
  await db.query("insert into wakppu_gem_ball_players(user_id,owned) values($1,'[\"blue-crystal-wax\",\"deepsea-crystal-wax\",\"aurora-crystal-wax\",\"stellar-crystal-core\"]') on conflict(user_id) do update set owned=excluded.owned",[uid]);
  let balance=2;for(const [id,n] of [['blue-crystal-wax',10],['deepsea-crystal-wax',16],['aurora-crystal-wax',24],['stellar-crystal-core',40]]){await send('gem_ball_select',{ball_id:id});const hit={request_id:crypto.randomUUID(),item_revision:(await rpc('items')).revision};r=await rpc('item_hit',hit);balance+=n;assert.equal(r.gem_reward,String(n));assert.equal(r.blue_gems.balance,String(balance));assert.deepEqual(await rpc('item_hit',hit),r);}
  // Existing rebirth API must preserve both the separately stored timer and stock.
  await send('gem_ball_select',{ball_id:null});await db.query('update game_states set gold=1e100 where user_id=$1',[uid]);
  const boostBefore=(await rpc('blue_gems')).boost;const state=(await rpc('bootstrap')).state;await rpc('save_progress',{...state,gold:'0',rebirths:state.rebirths+1,unlocked_ball_ids:['yellow'],selected_ball_id:'yellow',current_clicks:0,honey_expires_at:null,coating_expires_at:null,item_revision:(await rpc('items')).revision});const boostAfter=(await rpc('blue_gems')).boost;assert.equal(boostAfter.stock,boostBefore.stock);assert.equal(boostAfter.expires_at,boostBefore.expires_at);
  await db.query("update wakppu_blue_gem_boosts set expires_at=clock_timestamp()-interval '1 second' where user_id=$1",[uid]);assert.equal((await rpc('blue_gems')).boost.active_multiplier,1);assert.equal((await rpc('items')).effects.blue_gem_boost,undefined);
  await send('gem_ball_select',{ball_id:'blue-crystal-wax'});r=await send('item_hit');assert.equal(r.gem_reward,'5');
  await rpc('items',{},aid);await db.query('insert into wakppu_blue_gem_boosts(user_id,stock) values($1,4) on conflict(user_id) do update set stock=4',[aid]);r=await send('item_use',{item_id:'blue_gem_boost'},aid);assert.equal(r.inventory.blue_gem_boost,4);assert.equal(r.blue_gems.boost.active_multiplier,2);
  assert.equal((await rpc('blue_gems',{},aid,true)).boost.active_multiplier,1);await db.query("update players set role='player' where user_id=$1",[aid]);assert.equal((await rpc('blue_gems',{},aid)).boost.active_multiplier,1);assert.equal((await rpc('blue_gems',{},aid)).boost.stock,4);
  await db.query("update wakppu_blue_gem_boosts set expires_at=clock_timestamp()+interval '7 days' where user_id=$1",[uid]);await assert.rejects(send('item_use',{item_id:'blue_gem_boost'}),{code:'PT400'});
  await db.exec('update server_settings set maintenance=true');await assert.rejects(buy(),{code:'PT503'});await db.exec('update server_settings set maintenance=false');
  const acl=(await db.query("select has_table_privilege('authenticated','wakppu_blue_gem_boosts','SELECT') t,has_function_privilege('anon','wakppu_blue_gem_boost_multiplier(uuid)','EXECUTE') f,has_function_privilege('authenticated','wakppu_api_before_gem_boost(jsonb)','EXECUTE') base")).rows[0];assert.deepEqual(acl,{t:false,f:false,base:false});
 }finally{await db.close();}
});
