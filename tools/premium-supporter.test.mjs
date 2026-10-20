import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {bankFixture,premiumMigration} from './manual-bank-fixture.mjs';
const admin='00000000-0000-0000-0000-000000000001',buyer='00000000-0000-0000-0000-000000000002',other='00000000-0000-0000-0000-000000000003';
test('premium: server prices, immutable old orders, upgrades, max bonus, title privacy, refund dependencies and permissions',async()=>{
 const {db,add,rpc}=await bankFixture({premium:false});try{
 await add(admin,'admin');await add(buyer);await add(other);
 await rpc(admin,{action:'admin_purchase_config',mode:'set',revision:0,enabled:true,bank_name:'테스트은행',account_number:'000-00000',account_holder:'테스트',support_contact:'실제 입금 금지'});
 const order=async(u,product,extra={})=>(await rpc(u,{action:'purchase_order',product_id:product,depositor:'테스트',request_id:crypto.randomUUID(),...extra})).order;
 const approve=o=>rpc(admin,{action:'admin_purchase_approve',order_id:o.id,confirmed_amount:o.amount,deposit_reference:'local-'+o.id});
 const refund=o=>rpc(admin,{action:'admin_purchase_refund',order_id:o.id,refund_reference:'local-refund-'+o.id});
 const catalog=u=>rpc(u,{action:'purchase_catalog'});
 const oldSkin=await order(buyer,'starlight_skin');assert.equal(oldSkin.amount,3300);
 const migration=await readFile(premiumMigration,'utf8');await db.exec(migration);
 const initial=(await db.query('select * from game_states order by user_id')).rows;
 const products=(await catalog(buyer)).products;assert.equal(products.find(p=>p.id==='starlight_skin').amount,500);assert.equal(products.find(p=>p.id==='premium_supporter_pack').amount,10000);
 assert.equal((await catalog(buyer)).orders.find(o=>o.id===oldSkin.id).amount,3300);
 const newSkin=await order(other,'starlight_skin');assert.equal(newSkin.amount,500);
 await assert.rejects(rpc(admin,{action:'admin_purchase_approve',order_id:oldSkin.id,confirmed_amount:500,deposit_reference:'wrong-old-price'}),{code:'PT400'});
 await approve(oldSkin);await approve(newSkin);
 await assert.rejects(order(buyer,'premium_supporter_pack',{amount:8900,supporter_upgrade_order_id:oldSkin.id}),{code:'PT400'});
 await assert.rejects(rpc(buyer,{action:'purchase_title',visible:false}),{code:'PT403'});
 const base=await order(buyer,'supporter_pack');await approve(base);
 assert.equal((await catalog(buyer)).supporter_percent,5);assert.equal((await catalog(buyer)).products.find(p=>p.id==='premium_supporter_pack').amount,8900);
 const upgrade=await order(buyer,'premium_supporter_pack');assert.equal(upgrade.amount,8900);assert.equal(upgrade.supporter_upgrade_order_id,base.id);
 await assert.rejects(rpc(buyer,{action:'admin_purchase_approve',order_id:upgrade.id,confirmed_amount:8900,deposit_reference:'spoofed'}),{code:'PT403'});
 await approve(upgrade);await approve(upgrade);
 assert.equal((await catalog(buyer)).supporter_percent,30);await assert.rejects(order(buyer,'premium_supporter_pack'),{code:'PT409'});
 let rows=(await rpc(null,{action:'rankings'})),row=rows.find(r=>r.nickname.endsWith('02'));assert.equal(row.supporter,true);assert.equal(row.premium_supporter,true);assert.equal(row.supporter_title_visible,true);
 await assert.rejects(rpc(buyer,{action:'purchase_title',visible:'false'}),{code:'PT400'});
 await rpc(buyer,{action:'purchase_title',visible:false});await rpc(buyer,{action:'purchase_equip',equipped:true});assert.equal((await catalog(buyer)).title_visible,false);assert.equal((await catalog(buyer)).equipped,true);
 row=(await rpc(null,{action:'rankings'})).find(r=>r.nickname.endsWith('02'));assert.equal(row.premium_supporter,true);assert.equal(row.supporter_title_visible,false);
 assert.equal((await rpc(admin,{action:'admin_purchase_orders'})).orders.find(o=>o.id===base.id).supporter_refund_blocked,true);
 await assert.rejects(refund(base),{code:'PT409'});assert.equal((await catalog(buyer)).supporter_percent,30);
 await db.exec(migration);assert.equal((await catalog(buyer)).supporter_percent,30);assert.equal((await catalog(buyer)).title_visible,false);
 await refund(upgrade);await refund(upgrade);assert.equal((await catalog(buyer)).supporter_percent,5);await refund(base);assert.equal((await catalog(buyer)).supporter_percent,0);
 // Approval rechecks the specific base order; an old discount cannot survive its refund.
 const base2=await order(buyer,'supporter_pack');await approve(base2);const pending=await order(buyer,'premium_supporter_pack');await refund(base2);await assert.rejects(approve(pending),{code:'PT409'});
 assert.equal((await catalog(buyer)).orders.find(o=>o.id===pending.id).status,'pending');await rpc(buyer,{action:'purchase_cancel',order_id:pending.id});
 const direct=await order(other,'premium_supporter_pack');assert.equal(direct.amount,10000);assert.equal(direct.supporter_upgrade_order_id,null);await approve(direct);assert.equal((await catalog(other)).supporter_percent,30);await assert.rejects(order(other,'supporter_pack'),{code:'PT409'});
 assert.deepEqual((await db.query('select * from game_states order by user_id')).rows,initial);
 for(const fn of ['wakppu_supporter_percent(uuid)','wakppu_supporter_reward(uuid,numeric)'])assert.equal((await db.query("select has_function_privilege('authenticated',$1,'execute') allowed",[fn])).rows[0].allowed,false);
 assert.equal((await db.query("select relrowsecurity from pg_class where relname='wakppu_purchase_cosmetics'")).rows[0].relrowsecurity,true);
 }finally{await db.close();}
});

test('premium migration also applies before first-steps migration in filename order',async()=>{
 const {db}=await bankFixture({premium:false});try{
 // Start from the original purchase wrapper, then replay in migration filename order.
 await db.exec(await readFile(new URL('../supabase/migrations/20261019084353_manual_bank_orders.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(premiumMigration,'utf8'));await db.exec(await readFile(new URL('../supabase/migrations/20261020110000_first_steps_pack.sql',import.meta.url),'utf8'));
 const body=(await db.query("select prosrc from pg_proc where proname='wakppu_api'")).rows[0].prosrc;assert.ok(body.includes('starter_once_guard'));assert.ok(body.includes('premium_upgrade_guard'));assert.ok(body.includes('starter_refundable'));
 }finally{await db.close();}
});
