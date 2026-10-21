import {test} from 'node:test';import assert from 'node:assert/strict';
import {bankFixture} from './manual-bank-fixture.mjs';import {itemAction,itemData} from './items-service.mjs';
const admin='00000000-0000-0000-0000-000000000001',guest='00000000-0000-0000-0000-000000000002',other='00000000-0000-0000-0000-000000000003';
test('permanent developer keepsake: permission, anonymous recipient, idempotency, pure use and protected receipts',async()=>{
 const {db,add,rpc}=await bankFixture();try{
 await add(admin,'admin');await add(guest,'player',true);await add(other);
 const req={action:'admin_keepsake_grant',user_id:guest,item_id:'developer_piercing_fragment',reason:'개발자 소장품 테스트',request_id:crypto.randomUUID()};
 await assert.rejects(rpc(null,req),{code:'PT401'});await assert.rejects(rpc(guest,req),{code:'PT403'});
 await add(other,'admin',true);await assert.rejects(rpc(other,req),{code:'PT403'});await add(other);
 await assert.rejects(rpc(admin,{...req,reason:''}),{code:'PT400'});await assert.rejects(rpc(admin,{...req,item_id:'fake'}),{code:'PT400'});
 await assert.rejects(rpc(admin,{...req,user_id:crypto.randomUUID()}),{code:'PT404'});
 assert.equal((await rpc(admin,{action:'admin_keepsake_status',user_id:guest})).owned,false);
 const before=(await db.query('select * from game_states where user_id=$1',[guest])).rows;
 await rpc(admin,req);await rpc(admin,req);await rpc(admin,{...req,request_id:crypto.randomUUID()});
 await assert.rejects(rpc(admin,{...req,user_id:other}),{code:'PT409'});
 assert.equal((await db.query("select count(*)::int n from admin_audit_logs where action='admin_keepsake_grant'")).rows[0].n,1);
 assert.equal((await rpc(admin,{action:'admin_keepsake_status',user_id:guest})).owned,true);
 const use={action:'item_use',item_id:req.item_id,request_id:crypto.randomUUID(),item_revision:0};
 for(let i=0;i<3;i++)assert.equal((await rpc(guest,use)).inventory.developer_piercing_fragment,1);
 await assert.rejects(rpc(other,use),{code:'PT403'});await assert.rejects(rpc(guest,{...use,item_revision:1}),{code:'PT409'});
 assert.deepEqual((await db.query('select * from game_states where user_id=$1',[guest])).rows,before);
 assert.equal((await db.query('select count(*)::int n from wakppu_items')).rows[0].n,0);
 await db.exec('set role authenticated');await assert.rejects(db.query('select * from wakppu_developer_keepsakes'),{code:'42501'});await db.exec('reset role');
 await db.query('update players set banned=true where user_id=$1',[guest]);await assert.rejects(rpc(guest,use),{code:'PT403'});
 }finally{await db.close();}
});
test('local inventory keepsake has no effects, never consumes, never enters draw pool',()=>{
 const d=itemData.collectibles[0];assert.equal(d.name,'누군가의 엉덩이 피어싱 조각');assert.equal(itemData.description(d),'더럽다');assert.equal(itemData.channels(d).length,0);
 assert.equal(itemData.list.length,30);assert.ok(!itemData.list.some(x=>x.id===d.id));
 const actor={state:{gold:'99'},developerKeepsake:true},before=itemAction(actor,{action:'items'});
 for(let i=0;i<3;i++)assert.deepEqual(itemAction(actor,{action:'item_use',item_id:d.id,item_revision:0,request_id:crypto.randomUUID()}),{...before,results:[]});
 assert.equal(actor.state.gold,'99');assert.deepEqual(actor.items.effects,{});
});
