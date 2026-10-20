import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {bankFixture} from './manual-bank-fixture.mjs';
const admin='00000000-0000-0000-0000-000000000001',buyer='00000000-0000-0000-0000-000000000002',other='00000000-0000-0000-0000-000000000003',guest='00000000-0000-0000-0000-000000000004';
test('first steps: exact atomic grant, no auto-use, admin-only confirmation, once ever, refund guards and rollback',async()=>{
 const {db,add,rpc}=await bankFixture();try{
 await add(admin,'admin');await add(buyer);await add(other);await add(guest,'player',true);
 const catalog=await rpc(buyer,{action:'purchase_catalog'}),p=catalog.products.find(p=>p.id==='first_steps_pack');assert.equal(p.amount,1100);assert.ok(p.description.includes('계정당 1회'));
 await rpc(admin,{action:'admin_purchase_config',mode:'set',revision:0,enabled:true,bank_name:'테스트은행',account_number:'000-00000',account_holder:'테스트',support_contact:'실제 입금 금지'});
 const request=()=>({action:'purchase_order',product_id:'first_steps_pack',depositor:'성장테스트',request_id:crypto.randomUUID()});
 await assert.rejects(rpc(guest,request()),{code:'PT403'});await assert.rejects(rpc(buyer,{...request(),amount:1}),{code:'PT400'});
 const effects={common_candle:{expires_at:9999999999999}};
 await db.query('insert into wakppu_items(user_id,inventory,effects,pity,total) values($1,$2,$3,7,18)',[buyer,JSON.stringify({rare_honey:4}),JSON.stringify(effects)]);await db.query('update game_states set item_revision=9 where user_id=$1',[buyer]);
 const state=async who=>(await db.query('select gold::text,item_revision from game_states where user_id=$1',[who])).rows[0];
 const inventory=async who=>(await db.query('select * from wakppu_items where user_id=$1',[who])).rows[0];
 const initial=await state(buyer),created=await rpc(buyer,request()),id=created.order.id;
 assert.equal((await rpc(buyer,request())).order.id,id);
 await rpc(buyer,{action:'purchase_claim',order_id:id});assert.deepEqual(await state(buyer),initial);
 const approve={action:'admin_purchase_approve',order_id:id,confirmed_amount:1100,deposit_reference:'first-steps-bank-01'};
 await assert.rejects(rpc(buyer,approve),{code:'PT403'});await assert.rejects(rpc(admin,{...approve,confirmed_amount:3300}),{code:'PT400'});
 await rpc(admin,approve);const after=await state(buyer),items=await inventory(buyer);
 assert.equal(after.gold,String(BigInt(initial.gold)+3000n));assert.equal(Number(after.item_revision),10);
 assert.deepEqual(items.inventory,{rare_honey:6,rare_crack_booster:3,common_wax_feather:2});assert.deepEqual(items.effects,effects);assert.equal(items.pity,7);assert.equal(Number(items.total),18);
 const granted=await rpc(buyer,{action:'purchase_catalog'});assert.equal(granted.starter_grant.order_id,id);assert.equal(granted.starter_grant.reclaimed_at,null);
 await rpc(admin,approve);assert.deepEqual(await state(buyer),after);assert.deepEqual((await inventory(buyer)).inventory,items.inventory);
 await assert.rejects(rpc(admin,{...approve,deposit_reference:'different-record'}),{code:'PT409'});await assert.rejects(rpc(buyer,request()),{code:'PT409'});
 const migration=await readFile(new URL('../supabase/migrations/20261020110000_first_steps_pack.sql',import.meta.url),'utf8');await db.exec(migration);assert.deepEqual(await state(buyer),after);
 assert.equal((await rpc(admin,{action:'admin_purchase_orders'})).orders.find(o=>o.id===id).starter_refundable,true);
 const refund={action:'admin_purchase_refund',order_id:id,refund_reference:'first-steps-refund'};
 await db.query('update game_states set gold=2999 where user_id=$1',[buyer]);await assert.rejects(rpc(admin,refund),{code:'PT409'});
 assert.equal((await rpc(admin,{action:'admin_purchase_orders'})).orders.find(o=>o.id===id).status,'approved');
 await db.query('update game_states set gold=$2 where user_id=$1',[buyer,after.gold]);
 await db.query("update wakppu_items set inventory=jsonb_set(inventory,'{rare_crack_booster}','2') where user_id=$1",[buyer]);await assert.rejects(rpc(admin,refund),{code:'PT409'});
 await db.query('update wakppu_items set inventory=$2 where user_id=$1',[buyer,JSON.stringify(items.inventory)]);
 await rpc(admin,refund);const reclaimed=await state(buyer);assert.equal(reclaimed.gold,initial.gold);assert.equal(Number(reclaimed.item_revision),11);assert.equal((await inventory(buyer)).inventory.rare_honey,4);
 assert.ok((await rpc(buyer,{action:'purchase_catalog'})).starter_grant.reclaimed_at);await rpc(admin,refund);assert.deepEqual(await state(buyer),reclaimed);await assert.rejects(rpc(buyer,request()),{code:'PT409'});
 // A failed grant must not approve the order or leave any partial stock/ledger.
 const otherOrder=(await rpc(other,request())).order;await db.exec('alter table game_states add constraint fixture_gold_cap check(gold<=20000)');await db.query('update game_states set gold=19999 where user_id=$1',[other]);
 await assert.rejects(rpc(admin,{...approve,order_id:otherOrder.id,deposit_reference:'first-steps-bank-02'}),{code:'23514'});
 assert.equal((await rpc(other,{action:'purchase_catalog'})).starter_grant,null);assert.equal((await rpc(admin,{action:'admin_purchase_orders'})).orders.find(o=>o.id===otherOrder.id).status,'pending');
 await db.query('update game_states set gold=0 where user_id=$1',[other]);await rpc(admin,{...approve,order_id:otherOrder.id,deposit_reference:'first-steps-bank-02'});assert.equal((await state(other)).gold,'3000');
 await db.exec('set role authenticated');await assert.rejects(db.exec('select * from wakppu_first_steps_grants'),{code:'42501'});await assert.rejects(db.query('select wakppu_first_steps_refundable($1)',[buyer]),{code:'42501'});await db.exec('reset role');
 }finally{await db.close();}
});
