import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {customFixture,customMigration,customPricesMigration} from './custom-sql-fixture.mjs';
test('custom repricing preserves old receipts/entitlements; new single/full/upgrade prices are authoritative and replay-safe',async()=>{
 const {db,add,rpc}=await customFixture();
 const admin='00000000-0000-0000-0000-000000000001',u='00000000-0000-0000-0000-000000000002',v='00000000-0000-0000-0000-000000000003',w='00000000-0000-0000-0000-000000000004',x='00000000-0000-0000-0000-000000000005',y='00000000-0000-0000-0000-000000000006';
 try{
  await add(admin,'admin');for(const id of [u,v,w,x,y])await add(id);
  await db.exec(await readFile(customMigration,'utf8'));
  await rpc(admin,{action:'admin_purchase_config',mode:'set',revision:0,enabled:true,bank_name:'테스트',account_number:'000-00000',account_holder:'테스트',support_contact:'실제 송금 금지'});
  const request=(product_id,extra={})=>({action:'purchase_order',product_id,request_id:crypto.randomUUID(),depositor:'테스트',...extra});
  const approve=o=>rpc(admin,{action:'admin_purchase_approve',order_id:o.id,confirmed_amount:o.amount,deposit_reference:'test-'+o.id});
  const single=(await rpc(u,request('custom_ball_single',{target:'yellow'}))).order;assert.equal(single.amount,30000);await approve(single);
  const upgradeReq=request('custom_ball_all'),upgrade=(await rpc(u,upgradeReq)).order;assert.equal(upgrade.amount,20000);
  const fullReq=request('custom_ball_all'),full=(await rpc(v,fullReq)).order;assert.equal(full.amount,50000);
  const singleReq=request('custom_ball_single',{target:'green'}),pendingSingle=(await rpc(w,singleReq)).order;
  const receiptRows=(await db.query('select * from wakppu_purchase_orders order by id')).rows;
  const rights=(await db.query('select * from wakppu_purchase_entitlements order by user_id,product_id')).rows;
  for(let i=0;i<2;i++)await db.exec(await readFile(customPricesMigration,'utf8'));
  assert.deepEqual((await db.query('select * from wakppu_purchase_orders order by id')).rows,receiptRows);
  assert.deepEqual((await db.query('select * from wakppu_purchase_entitlements order by user_id,product_id')).rows,rights);
  for(const [user,req,old]of [[u,upgradeReq,upgrade],[v,fullReq,full],[w,singleReq,pendingSingle]]){assert.equal((await rpc(user,req)).order.amount,old.amount);await assert.rejects(rpc(admin,{action:'admin_purchase_approve',order_id:old.id,confirmed_amount:1,deposit_reference:'wrong'}));await approve(old);}
  assert.equal((await rpc(u,{action:'custom_status'})).plan,'all');assert.equal((await rpc(w,{action:'custom_status'})).plan,'single');
  const catalog=(await rpc(x,{action:'purchase_catalog'})).products;assert.equal(catalog.find(p=>p.id==='custom_ball_single').amount,9900);assert.equal(catalog.find(p=>p.id==='custom_ball_all').amount,29000);
  await assert.rejects(rpc(x,request('custom_ball_single',{target:'yellow',amount:30000})),{code:'PT400'});
  const newSingle=(await rpc(x,request('custom_ball_single',{target:'yellow',amount:9900}))).order;assert.equal(newSingle.amount,9900);await approve(newSingle);
  assert.equal((await rpc(x,{action:'purchase_catalog'})).products.find(p=>p.id==='custom_ball_all').amount,19100);
  await assert.rejects(rpc(x,request('custom_ball_all',{amount:20000})),{code:'PT400'});
  const newUpgrade=(await rpc(x,request('custom_ball_all',{amount:19100}))).order;assert.equal(newUpgrade.amount,19100);assert.equal(newUpgrade.custom_upgrade_order_id,newSingle.id);
  const newFull=(await rpc(y,request('custom_ball_all',{amount:29000}))).order;assert.equal(newFull.amount,29000);
 }finally{await db.close();}
});
