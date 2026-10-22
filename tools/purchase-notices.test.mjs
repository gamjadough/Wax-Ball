import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {bankFixture} from './manual-bank-fixture.mjs';
export const noticeMigration=new URL('../supabase/migrations/20261022091944_admin_purchase_inbox.sql',import.meta.url);
test('admin purchase inbox: role, anonymous admin, pending/claim counts, target lookup, terminal states and gifts excluded',async()=>{
 const f=await bankFixture();const {db,add,rpc}=f,admin='00000000-0000-4000-8000-000000000001',user='00000000-0000-4000-8000-000000000002',guest='00000000-0000-4000-8000-000000000003';
 try{
  await db.exec(await readFile(noticeMigration,'utf8'));await add(admin,'admin');await add(user);await add(guest,'admin',true);
  const inbox=(id=admin,more={})=>rpc(id,{action:'admin_purchase_inbox',...more});
  await assert.rejects(inbox(null));await assert.rejects(inbox(user));await assert.rejects(inbox(guest));assert.equal((await inbox()).total,0);
  await db.exec("update wakppu_purchase_config set enabled=true;");
  const order=(await rpc(user,{action:'purchase_order',product_id:'starlight_skin',depositor:'알림 검증',request_id:crypto.randomUUID()})).order;
  let s=await inbox();assert.equal(s.total,1);assert.equal(s.pending,1);assert.equal(s.orders[0].status,'pending');assert.equal(s.orders[0].depositor,null);
  s=await inbox(admin,{order_id:order.id});assert.equal(s.orders.length,1);assert.equal(s.orders[0].depositor,'알림 검증');assert.ok(s.orders[0].bank);
  await rpc(user,{action:'purchase_claim',order_id:order.id});s=await inbox();assert.equal(s.claimed,1);assert.equal(s.pending,0);assert.equal(s.orders[0].status,'claimed');
  await rpc(admin,{action:'admin_purchase_approve',order_id:order.id,confirmed_amount:order.amount,deposit_reference:'bank receipt test'});assert.equal((await inbox()).total,0);assert.deepEqual((await inbox(admin,{order_id:order.id})).orders,[]);
  await rpc(admin,{action:'admin_paid_grant',user_id:user,product_id:'supporter_pack',request_id:crypto.randomUUID(),reason:'지급 알림 제외 검증'});assert.equal((await inbox()).total,0);
  await db.exec('update test_settings set maintenance=true');await assert.rejects(inbox(user));assert.equal((await inbox()).total,0);
  assert.equal((await db.query("select has_function_privilege('authenticated','wakppu_api_before_admin_inbox(jsonb)','EXECUTE') as allowed")).rows[0].allowed,false);
 }finally{await db.close();}
});
