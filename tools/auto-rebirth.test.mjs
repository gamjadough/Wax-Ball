import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
import {customFixture} from './custom-sql-fixture.mjs';import {installAutoRebirth} from './auto-rebirth-fixture.mjs';
const admin='00000000-0000-4000-8000-000000000001',user='00000000-0000-4000-8000-000000000002';
test('auto rebirth: exact economy, paid grant, OFF default, server threshold, version, replay, refund and moderation',async()=>{
 const f=await customFixture();const {db,add,rpc}=f;try{
 await installAutoRebirth(db);await add(admin,'admin');await add(user);
 await db.exec(await readFile(new URL('../supabase/migrations/20261023092450_fast_auto_rebirth.sql',import.meta.url),'utf8'));
 const call=(action,body={})=>rpc(user,{action,...body});
 assert.equal((await db.query("select amount from wakppu_purchase_products where id='auto_rebirth'")).rows[0].amount,4000);
 const c=vm.createContext({window:{}});vm.runInContext(await readFile(new URL('../wakppuball/js/balls-data.js',import.meta.url),'utf8')+';window.costs=REBIRTH_COSTS.map(String)',c);
 for(const [n,cost] of c.window.costs.entries())assert.equal((await db.query('select wakppu_rebirth_cost($1)::text as cost',[n])).rows[0].cost,cost,'cost '+n);
 assert.equal((await call('auto_rebirth_status')).owned,false);await assert.rejects(call('auto_rebirth_toggle',{enabled:true}));
 const gift=()=>rpc(admin,{action:'admin_paid_grant',user_id:user,product_id:'auto_rebirth',request_id:crypto.randomUUID(),reason:'자동 환생 검증'});
 await gift();assert.equal((await call('auto_rebirth_status')).enabled,false);
 await db.query("update game_states set gold=2000000,rebirths=0,unlocked_ball_ids='[\"yellow\",\"green\"]',selected_ball_id='green',hammer_owned=true,hammer_level=8,discovered_ball_ids='[\"yellow\",\"green\"]',honey_expires_at=now()+interval '1 hour',coating_expires_at=now()+interval '1 hour' where user_id=$1",[user]);
 await db.query("insert into wakppu_items(user_id,effects) values($1,'{\"test\":{}}') on conflict(user_id) do update set effects=excluded.effects",[user]);
 await db.query("update game_states set current_clicks=2,item_current_clicks=2,current_ball_id='green' where user_id=$1",[user]);
 const run=()=>call('auto_rebirth_run',{rebirths:0,item_revision:0});
 assert.equal((await run()).performed,false);await call('auto_rebirth_toggle',{enabled:true});
 await db.query('update game_states set gold=1999999 where user_id=$1',[user]);assert.equal((await run()).performed,false);
 const progress={...(await db.query('select * from game_states where user_id=$1',[user])).rows[0],gold:'2000000',rebirths:999,action:'admin_gold'};
 assert.equal((await call('auto_rebirth_run',{rebirths:0,item_revision:9,progress})).performed,false);
 assert.equal(String((await db.query('select gold from game_states where user_id=$1',[user])).rows[0].gold),'1999999');
 await assert.rejects(call('auto_rebirth_run',{rebirths:0,item_revision:0,progress:[]}));
 const combined=()=>call('auto_rebirth_run',{rebirths:0,item_revision:0,progress});
 const done=await combined();assert.equal(done.performed,true);assert.equal(done.progress.gold,'0');assert.equal(done.progress.rebirths,1);assert.equal(done.items.revision,1);assert.deepEqual(done.items.effects,{});assert.equal((await combined()).performed,false);
 let s=(await db.query('select * from game_states where user_id=$1',[user])).rows[0];assert.equal(s.rebirths,1);assert.equal(String(s.gold),'0');assert.equal(s.item_revision,1);assert.deepEqual(s.unlocked_ball_ids,['yellow']);assert.equal(s.honey_expires_at,null);assert.equal(s.coating_expires_at,null);assert.equal(s.hammer_level,8);assert.deepEqual(s.discovered_ball_ids,['yellow','green']);assert.deepEqual((await db.query('select effects from wakppu_items where user_id=$1',[user])).rows[0].effects,{});
 assert.equal(s.current_clicks,0);assert.equal(s.item_current_clicks,0);assert.equal(s.current_ball_id,'yellow');
 await db.query('update game_states set rebirths=1000,gold=1e500 where user_id=$1',[user]);const max=await call('auto_rebirth_run',{rebirths:1000,item_revision:1});assert.equal(max.performed,false);assert.equal(max.progress.gold,'1'+'0'.repeat(500));
 await db.exec('update test_settings set maintenance=true');await assert.rejects(call('auto_rebirth_status'));await db.exec('update test_settings set maintenance=false');
 await db.query('update players set banned=true where user_id=$1',[user]);await assert.rejects(run());await db.query('update players set banned=false where user_id=$1',[user]);
 const order=(await db.query("select order_id from wakppu_purchase_entitlements where user_id=$1 and product_id='auto_rebirth'",[user])).rows[0].order_id;
 await rpc(admin,{action:'admin_paid_revoke',user_id:user,order_id:order,reason:'검증 회수'});assert.equal((await call('auto_rebirth_status')).enabled,false);await assert.rejects(run());await gift();assert.equal((await call('auto_rebirth_status')).enabled,false);
 assert.equal((await db.query("select has_table_privilege('authenticated','wakppu_auto_rebirth','SELECT') as allowed")).rows[0].allowed,false);
 }finally{await db.close();}
});
