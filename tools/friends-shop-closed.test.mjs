import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {friendsGateFixture} from './friends-gate-fixture.mjs';

test('friends paid shop rejects orders, claims and reopening; keeps purchases, receipts, gameplay and entry gate',async()=>{
 const {db,rpc,access}=await friendsGateFixture();
 const player=crypto.randomUUID(),admin=crypto.randomUUID(),paid=crypto.randomUUID(),pending=crypto.randomUUID();
 try{
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'player@fixture.test',now()),($2,'admin@fixture.test',now())",[player,admin]);
  await db.query("update players set role='admin' where user_id=$1",[admin]);
  const grant=await access({mode:'unlock',password:'fixture-entry-only'}),headers={'x-wakppu-access':grant.token};
  const call=(u,b)=>rpc(u,b,false,headers);
  await db.query(`insert into wakppu_purchase_orders(id,user_id,request_id,product_id,product_name,amount,depositor,bank,status)
   values($1,$3,$4,'starlight_skin','기존 별빛 스킨',500,'테스트','{"support_contact":"fixture"}','approved'),
         ($2,$3,$5,'supporter_pack','기존 대기 주문',1100,'테스트','{"support_contact":"fixture"}','pending')`,[paid,pending,player,crypto.randomUUID(),crypto.randomUUID()]);
  await db.query("insert into wakppu_purchase_entitlements values($1,'starlight_skin',$2)",[player,paid]);
  const before=(await db.query('select * from wakppu_purchase_orders order by id')).rows;
  const migration=await readFile(new URL('../supabase/migrations/20261122110326_friends_paid_shop_closed.sql',import.meta.url),'utf8');
  await db.exec(migration);await db.exec(migration);
  assert.deepEqual((await db.query('select * from wakppu_purchase_orders order by id')).rows,before);
  assert.equal((await db.query('select enabled from wakppu_purchase_config')).rows[0].enabled,false);
  for(const user of [player,admin,null])for(const body of [
   {action:'purchase_order',product_id:'supporter_pack',request_id:crypto.randomUUID(),depositor:'테스트'},
   {action:'purchase_claim',order_id:pending},
   {action:'admin_purchase_config',mode:'set',enabled:true}
  ])await assert.rejects(call(user,body),e=>e.code==='PT403'&&e.hint==='FRIENDS_PAID_SHOP_CLOSED');
  // Even a stale/manual enabled flag cannot reopen the protected API.
  await db.exec('update wakppu_purchase_config set enabled=true');
  await assert.rejects(call(player,{action:'purchase_order'}),e=>e.hint==='FRIENDS_PAID_SHOP_CLOSED');
  const catalog=await call(player,{action:'purchase_catalog'});
  assert.equal(catalog.enabled,false);assert.equal(catalog.shop_closed,true);
  assert.deepEqual(catalog.products,[]);assert.deepEqual(catalog.bank,{});
  assert.ok(catalog.owned.starlight_skin);assert.equal(catalog.orders.length,2);
  assert.equal((await call(player,{action:'purchase_equip',equipped:true})).equipped,true);
  assert.equal((await call(admin,{action:'admin_purchase_config'})).shop_closed,true);
  assert.equal((await call(admin,{action:'admin_purchase_orders'})).orders.length,2);
  await call(player,{action:'purchase_cancel',order_id:pending});
  assert.equal((await db.query('select status from wakppu_purchase_orders where id=$1',[pending])).rows[0].status,'cancelled');
  const items=await call(player,{action:'items'});
  assert.ok((await call(player,{action:'item_hit',request_id:crypto.randomUUID(),item_revision:items.revision})).revision>items.revision);
  // Old RPC layers remain private, and reading player state still requires entry.
  assert.equal((await db.query("select has_function_privilege('authenticated','public.wakppu_api_before_friends_shop_closed(jsonb)','execute') leaked")).rows[0].leaked,false);
  await assert.rejects(rpc(null,{action:'purchase_catalog'}),e=>e.hint==='FRIEND_GATE_REQUIRED');
 }finally{await db.close();}
});
