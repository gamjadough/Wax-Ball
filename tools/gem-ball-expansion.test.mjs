import {test} from 'node:test';import assert from 'node:assert/strict';
import {gemBallFixture,a,p} from './gem-ball-fixture.mjs';import {publicFixture} from './public-server-fixture.mjs';
import {createStore} from './admin-service.mjs';import {execute} from './gem-ball-service.mjs';import {gemState} from './blue-gem-data.mjs';import {gemBalls,gemBallState} from './gem-ball-data.mjs';import {itemState} from './items-service.mjs';

test('local catalog: ordered permanent unlocks, exact variable rewards and admin free use',()=>{
 const store=createStore(),user=store.players[1],admin=store.players[0];store.sleep_now_ms=Date.parse('2026-10-29T03:00:00Z');gemState(user).balance=630000n;
 const send=(actor,action,more={})=>execute(store,actor,{action,request_id:crypto.randomUUID(),item_revision:itemState(actor).revision,...more});
 assert.throws(()=>send(user,'gem_ball_buy',{ball_id:gemBalls[3].id}),e=>e.status===403);
 user.state.hammer_owned=true;user.state.hammer_level=30;let balance=630000n;const gold=user.state.gold;
 for(const d of gemBalls){const req={action:'gem_ball_buy',ball_id:d.id,request_id:crypto.randomUUID(),item_revision:itemState(user).revision};const r=execute(store,user,req);assert.deepEqual(execute(store,user,req),r);balance-=BigInt(d.price);send(user,'gem_ball_select',{ball_id:d.id});const hit={action:'item_hit',item_revision:itemState(user).revision,request_id:crypto.randomUUID()};const broken=execute(store,user,hit);balance+=BigInt(d.gem_reward);assert.equal(broken.gem_reward,d.gem_reward);assert.equal(broken.required_clicks,d.clicks);assert.deepEqual(execute(store,user,hit),broken);assert.equal(gemState(user).balance,balance);assert.equal(user.state.gold,gold);send(admin,'gem_ball_select',{ball_id:d.id});assert.equal(gemState(admin).balance,0n);}
 assert.equal(balance,45n);assert.equal(gemBallState(user).owned.length,4);assert.deepEqual(gemBallState(admin).owned,[]);
});

for(const realm of ['friends','public'])test('real SQL '+realm+': four-ball catalog, prerequisite, insufficient balance, CAS/replay, exact rewards, switch/rebirth/admin/RLS',async()=>{
 const playerId=realm==='friends'?p:crypto.randomUUID(),adminId=realm==='friends'?a:crypto.randomUUID();
 const f=realm==='friends'?await gemBallFixture():await publicFixture();const db=f.db;
 const rpc=(action,more={},actor=playerId,anonymous=false)=>realm==='friends'?f.rpc(action,more,actor,anonymous):f.rpc(actor,{action,...more},anonymous);
 const send=async(action,more={},actor=playerId)=>rpc(action,{request_id:crypto.randomUUID(),item_revision:(await rpc('items',{},actor)).revision,...more},actor);
 try{
  if(realm==='public'){await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'gems-player@example.invalid',now()),($2,'gems-admin@example.invalid',now())",[playerId,adminId]);await db.query("update players set role='admin' where user_id=$1",[adminId]);}
  await rpc('bootstrap');const catalog=(await rpc('gem_balls')).catalog;assert.deepEqual(catalog.map(d=>d.id),gemBalls.map(d=>d.id));
  for(let i=0;i<4;i++){assert.equal(catalog[i].price,gemBalls[i].price);assert.equal(catalog[i].clicks,gemBalls[i].clicks);assert.equal(catalog[i].gem_reward,gemBalls[i].gem_reward);assert.equal(catalog[i].requires_ball_id,gemBalls[i].requires_ball_id);}
  await assert.rejects(send('gem_ball_buy',{ball_id:gemBalls[1].id}),e=>e.code==='PT403');
  await assert.rejects(send('gem_ball_select',{ball_id:gemBalls[3].id}),e=>e.code==='PT403');
  await assert.rejects(send('gem_ball_buy',{ball_id:gemBalls[0].id}),e=>e.code==='PT400');
  await db.query('insert into wakppu_blue_gems(user_id,balance) values($1,630000) on conflict(user_id) do update set balance=630000',[playerId]);
  const gold=(await rpc('items')).gold;let balance=630000n;
  for(const d of gemBalls){
   const req={ball_id:d.id,request_id:crypto.randomUUID(),item_revision:(await rpc('items')).revision};const bought=await rpc('gem_ball_buy',req);assert.deepEqual(await rpc('gem_ball_buy',req),bought);balance-=BigInt(d.price);assert.equal(bought.blue_gems.balance,String(balance));
   await assert.rejects(send('gem_ball_buy',{ball_id:d.id}),e=>e.code==='PT409');
   await send('gem_ball_select',{ball_id:d.id});await db.query('update game_states set hammer_owned=false,hammer_level=0,hammer_selected_level=null where user_id=$1',[playerId]);
   let hit=await send('item_hit');assert.equal(hit.clicks,1);assert.equal(hit.required_clicks,d.clicks);assert.equal(hit.gem_reward,'0');assert.equal(hit.gold,gold);
   await db.query('update wakppu_gem_ball_players set clicks=$1 where user_id=$2',[d.clicks-1,playerId]);
   const last={request_id:crypto.randomUUID(),item_revision:(await rpc('items')).revision};hit=await rpc('item_hit',last);balance+=BigInt(d.gem_reward);assert.equal(hit.broken,true);assert.equal(hit.reward,'0');assert.equal(hit.gem_reward,d.gem_reward);assert.equal(hit.blue_gems.balance,String(balance));assert.equal(hit.gold,gold);assert.deepEqual(await rpc('item_hit',last),hit);assert.equal((await rpc('blue_gems')).balance,String(balance));
   const rows=(await db.query('select ball_id from wakppu_blue_gem_exclusions where ball_id=$1',[d.id])).rows;assert.equal(rows.length,1);
  }
  assert.equal(balance,45n);
  await db.query('update game_states set rebirths=1 where user_id=$1',[playerId]);assert.equal((await rpc('gem_balls')).owned.length,4);
  await send('gem_ball_select',{ball_id:null});assert.equal((await rpc('gem_balls')).selected,null);await send('gem_ball_select',{ball_id:gemBalls[3].id});assert.equal((await rpc('gem_balls')).selected,gemBalls[3].id);
  for(const d of gemBalls){await send('gem_ball_select',{ball_id:d.id},adminId);const state=await rpc('gem_balls',{},adminId);assert.equal(state.selected,d.id);assert.deepEqual(state.owned,[]);assert.equal((await rpc('blue_gems',{},adminId)).balance,'0');}
  assert.equal((await rpc('gem_balls',{},adminId,true)).selected,null);await db.query("update players set role='player' where user_id=$1",[adminId]);assert.equal((await rpc('gem_balls',{},adminId)).selected,null);
  await assert.rejects(send('gem_ball_buy',{ball_id:gemBalls[0].id,price:0}),e=>e.code==='PT403');
  await assert.rejects(send('gem_ball_select',{ball_id:gemBalls[0].id,item_revision:-1}),e=>e.code==='PT409');
  const privateAccess=(await db.query("select has_table_privilege('authenticated','public.wakppu_gem_ball_players','SELECT') as exposed,has_function_privilege('anon','public.wakppu_gem_ball_hit(jsonb)','EXECUTE') as callable")).rows[0];assert.deepEqual(privateAccess,{exposed:false,callable:false});
 }finally{await db.close();}
});

test('production rollback probe validates live handler paths and leaves no synthetic users or state',async()=>{
 const {readFile}=await import('node:fs/promises');const {db}=await publicFixture();try{
  const before=(await db.query('select count(*) n from auth.users')).rows[0].n;
  await db.exec(await readFile(new URL('./gem-ball-expansion-production-check.sql',import.meta.url),'utf8'));
  assert.equal((await db.query('select count(*) n from auth.users')).rows[0].n,before);
  await db.exec('update server_settings set maintenance=true');
  await db.exec(await readFile(new URL('./gem-ball-expansion-production-check.sql',import.meta.url),'utf8'));
  assert.equal((await db.query('select maintenance from server_settings')).rows[0].maintenance,true);
  assert.equal((await db.query('select count(*) n from auth.users')).rows[0].n,before);
 }finally{await db.close();}
});
