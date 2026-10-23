import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {customFixture,customMigration,customPricesMigration} from './custom-sql-fixture.mjs';
test('custom SQL: paid scope, exact upgrade price, receipt races, image ownership, replay/revision, refund/revoke and private ACLs',async()=>{
 const {db,add,rpc}=await customFixture(),admin='00000000-0000-0000-0000-000000000001',u='00000000-0000-0000-0000-000000000002',v='00000000-0000-0000-0000-000000000003',guest='00000000-0000-0000-0000-000000000004';
 try{
  await add(admin,'admin');await add(u);await add(v);await add(guest,'player',true);await db.exec(await readFile(customMigration,'utf8'));await db.exec(await readFile(customPricesMigration,'utf8'));await db.exec(await readFile(customPricesMigration,'utf8'));
  const r=async(user,action,more={})=>{await db.exec("select set_config('request.jwt.claims','{}',false)");return rpc(user,{action,...more});};
  await r(admin,'admin_purchase_config',{mode:'set',revision:0,enabled:true,bank_name:'로컬 은행',account_number:'000-00000',account_holder:'테스트',support_contact:'실제 송금 금지'});
  const order=(user,product_id,extra={})=>r(user,'purchase_order',{product_id,depositor:'샘플',request_id:crypto.randomUUID(),...extra});
  const approve=o=>r(admin,'admin_purchase_approve',{order_id:o.id,confirmed_amount:o.amount,deposit_reference:'test-'+o.id});
  const commit=async(user,b)=>{await db.exec("select set_config('test.uid','',false);select set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)");return(await db.query('select wakppu_custom_commit($1,$2) s',[user,JSON.stringify(b)])).rows[0].s;};
  const save=(revision,extra={})=>({mode:'save',target:'yellow',effect:'yellow',sound:'admin-event',revision,request_id:crypto.randomUUID(),...extra});
  const upload=(user,request)=>({...request,new_image:true,path:user+'/'+request.request_id+'.png',sha256:'a'.repeat(64),bytes:1000});
  assert.equal((await r(admin,'custom_status')).plan,'all');assert.equal((await r(guest,'custom_status')).plan,'none');await assert.rejects(order(guest,'custom_ball_single',{target:'yellow'}),{code:'PT403'});
  await assert.rejects(order(u,'custom_ball_single',{target:'eternity'}),{code:'PT403'});await assert.rejects(order(u,'custom_ball_single',{target:'yellow',amount:1}),{code:'PT400'});
  const single=(await order(u,'custom_ball_single',{target:'yellow'})).order;assert.equal(single.amount,9900);assert.equal((await r(u,'custom_status')).plan,'none');
  await assert.rejects(r(u,'admin_purchase_approve',{order_id:single.id,confirmed_amount:9900,deposit_reference:'forged'}),{code:'PT403'});await approve(single);await approve(single);
  const state=await r(u,'custom_status');assert.equal(state.plan,'single');assert.equal(state.target,'yellow');
  const imageRequest=upload(u,save(0));const first=await commit(u,imageRequest);assert.equal(first.revision,1);assert.equal(first.profiles.yellow.asset_id,imageRequest.request_id);assert.equal((await commit(u,imageRequest)).revision,1);
  await assert.rejects(commit(u,{...imageRequest,sound:'green'}),{code:'PT409'});
  await assert.rejects(commit(u,save(1,{target:'green',asset_id:imageRequest.request_id})),{code:'PT403'});
  await assert.rejects(commit(v,save(0,{asset_id:imageRequest.request_id})),{code:'PT403'});
  await assert.rejects(commit(u,save(1,{asset_id:imageRequest.request_id,effect:'skin:transcendent'})),{code:'PT403'});
  await assert.rejects(commit(u,save(1,{asset_id:imageRequest.request_id,effect:null})),{code:'PT403'});
  await db.query('insert into wakppu_skins values($1,$2)',[u,'{"eternity_transcendent":true}']);const second=await commit(u,save(1,{asset_id:imageRequest.request_id,effect:'skin:transcendent'}));assert.equal(second.revision,2);
  await assert.rejects(commit(u,save(1,{asset_id:imageRequest.request_id})),{code:'PT409'});
  const catalog=await r(u,'purchase_catalog');assert.equal(catalog.products.find(p=>p.id==='custom_ball_all').amount,19100);
  const upgrade=(await order(u,'custom_ball_all')).order;assert.equal(upgrade.amount,19100);assert.equal(upgrade.custom_upgrade_order_id,single.id);await approve(upgrade);
  const all=await commit(u,save(2,{target:'@all',asset_id:imageRequest.request_id}));assert.equal(all.plan,'all');assert.ok(all.global.asset_id);assert.deepEqual(all.profiles,{});
  const orders=await r(admin,'admin_purchase_orders');assert.equal(orders.orders.find(o=>o.id===single.id).custom_refund_blocked,true);
  await assert.rejects(r(admin,'admin_purchase_refund',{order_id:single.id,refund_reference:'test refund'}),{code:'PT409'});
  await r(admin,'admin_purchase_refund',{order_id:upgrade.id,refund_reference:'test refund upgrade'});assert.equal((await r(u,'custom_status')).plan,'single');await r(admin,'admin_purchase_refund',{order_id:single.id,refund_reference:'test refund single'});assert.equal((await r(u,'custom_status')).plan,'none');assert.deepEqual(await r(u,'custom_image_paths'),[]);
  const full=(await order(v,'custom_ball_all')).order;assert.equal(full.amount,29000);await approve(full);
  const req=save(0);await assert.rejects(commit(v,{...req,asset_id:imageRequest.request_id}),{code:'PT403'});
  const own=upload(v,req);await commit(v,own);const own2=upload(v,save(1));await commit(v,own2);assert.equal((await db.query('select count(*) n from wakppu_custom_gc')).rows[0].n,1);
  const cleared=await commit(v,{mode:'restore',target:'@all',revision:2,request_id:crypto.randomUUID()});assert.deepEqual(cleared.profiles,{});assert.equal((await db.query('select count(*) n from wakppu_custom_assets where user_id=$1',[v])).rows[0].n,0);
  const other=(await order(guest,'custom_ball_all').catch(e=>e));assert.equal(other.code,'PT403');
  // A pending upgrade cannot be approved after its required base was refunded.
  const next=(await order(u,'custom_ball_single',{target:'green'})).order;await approve(next);const pending=(await order(u,'custom_ball_all')).order;await r(admin,'admin_purchase_refund',{order_id:next.id,refund_reference:'test pending base'});await assert.rejects(approve(pending),{code:'PT409'});
  await db.exec('set role authenticated');for(const table of ['wakppu_custom_accounts','wakppu_custom_assets','wakppu_custom_profiles','wakppu_custom_requests','wakppu_custom_gc'])await assert.rejects(db.exec('select * from '+table),{code:'42501'});await assert.rejects(db.query('select wakppu_custom_commit($1,$2)',[u,'{}']),{code:'42501'});await db.exec('reset role');
 }finally{await db.close();}
});
