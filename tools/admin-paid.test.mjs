import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {bankFixture,adminPaidMigration} from './manual-bank-fixture.mjs';
const admin='00000000-0000-0000-0000-000000000001',guest='00000000-0000-0000-0000-000000000002',other='00000000-0000-0000-0000-000000000003';
test('admin paid gifts: anonymous recipient, authorization, atomic grants, source separation, idempotency, revoke and audit',async()=>{
 const {db,add,rpc}=await bankFixture();try{
 await add(admin,'admin');await add(guest,'player',true);await add(other);
 const status=()=>rpc(admin,{action:'admin_paid_status',user_id:guest});
 const grant=product=>({action:'admin_paid_grant',user_id:guest,product_id:product,reason:'이메일 인증 오류 지원',request_id:crypto.randomUUID()});
 const revoke=id=>rpc(admin,{action:'admin_paid_revoke',user_id:guest,order_id:id,reason:'로컬 지급 회수 검증'});
 const req=grant('starlight_skin');await assert.rejects(rpc(null,req),{code:'PT401'});await assert.rejects(rpc(guest,{...req,role:'admin'}),{code:'PT403'});await assert.rejects(rpc(admin,{...req,reason:''}),{code:'PT400'});await assert.rejects(rpc(admin,{...req,user_id:crypto.randomUUID()}),{code:'PT404'});
 assert.equal((await rpc(guest,{action:'purchase_catalog'})).eligible,false);
 await rpc(admin,req);const s=await status(),skin=s.owned.starlight_skin.order_id;assert.equal(s.owned.starlight_skin.source,'admin_grant');await rpc(admin,req);assert.equal((await status()).history.length,1);
 const order=(await db.query('select * from wakppu_purchase_orders where id=$1',[skin])).rows[0];assert.equal(order.amount,0);assert.equal(order.bank.constructor,Object);assert.equal(order.deposit_reference,null);assert.equal(order.source,'admin_grant');
 await assert.rejects(rpc(admin,grant('starlight_skin')),{code:'PT409'});await assert.rejects(rpc(admin,{...req,product_id:'supporter_pack'}),{code:'PT409'});
 assert.equal((await rpc(guest,{action:'purchase_equip',equipped:true})).equipped,true);
 await assert.rejects(rpc(admin,{action:'admin_purchase_refund',order_id:skin,refund_reference:'not-a-refund'}),{code:'PT409'});
 await assert.rejects(rpc(admin,{action:'admin_paid_revoke',user_id:other,order_id:skin,reason:'다른 대상 오류'}),{code:'PT404'});
 await revoke(skin);await revoke(skin);assert.equal((await rpc(guest,{action:'purchase_catalog'})).equipped,false);assert.equal((await status()).history[0].status,'revoked');await rpc(admin,req);assert.equal((await status()).owned.starlight_skin,undefined);
 await rpc(admin,grant('supporter_pack'));await rpc(admin,grant('premium_supporter_pack'));assert.equal((await rpc(guest,{action:'purchase_catalog'})).supporter_percent,30);
 const before=(await db.query('select gold::text,item_revision from game_states where user_id=$1',[guest])).rows[0];const starter=grant('first_steps_pack');await rpc(admin,starter);await rpc(admin,starter);
 const after=(await db.query('select gold::text,item_revision from game_states where user_id=$1',[guest])).rows[0];assert.equal(BigInt(after.gold),BigInt(before.gold)+3000n);assert.equal(Number(after.item_revision),Number(before.item_revision)+1);
 assert.deepEqual((await db.query('select inventory,effects from wakppu_items where user_id=$1',[guest])).rows[0],{inventory:{rare_honey:2,rare_crack_booster:3,common_wax_feather:2},effects:{}});
 const starterId=(await status()).owned.first_steps_pack.order_id;await db.query("update wakppu_items set inventory=jsonb_set(inventory,'{rare_honey}','1') where user_id=$1",[guest]);await assert.rejects(revoke(starterId),{code:'PT409'});assert.ok((await status()).owned.first_steps_pack);
 await db.query("update wakppu_items set inventory=jsonb_set(inventory,'{rare_honey}','2') where user_id=$1",[guest]);await revoke(starterId);await assert.rejects(rpc(admin,grant('first_steps_pack')),{code:'PT409'});
 const audits=(await db.query("select * from admin_audit_logs where action in ('admin_paid_grant','admin_paid_revoke')")).rows;assert.equal(audits.length,6);assert.ok(audits.every(r=>r.admin_user_id===admin&&r.target_user_id===guest&&r.reason.length>=3));
 await db.exec(await readFile(adminPaidMigration,'utf8'));assert.equal((await status()).owned.premium_supporter_pack.source,'admin_grant');
 assert.equal((await db.query("select has_function_privilege('authenticated','wakppu_admin_paid_snapshot(uuid)','execute') allowed")).rows[0].allowed,false);
 await db.query('update auth.users set is_anonymous=true where id=$1',[admin]);await assert.rejects(status(),{code:'PT403'});
 }finally{await db.close();}
});
test('gift base cannot be revoked underneath a paid discounted upgrade; pending bank orders prevent gifts',async()=>{
 const {db,add,rpc}=await bankFixture();try{
 await add(admin,'admin');await add(other);
 await rpc(admin,{action:'admin_purchase_config',mode:'set',revision:0,enabled:true,bank_name:'테스트은행',account_number:'000-00000',account_holder:'테스트',support_contact:'실제 입금 금지'});
 const gift=product=>rpc(admin,{action:'admin_paid_grant',user_id:other,product_id:product,reason:'샘플 지급 검증',request_id:crypto.randomUUID()});
 const s=await gift('supporter_pack'),base=s.owned.supporter_pack.order_id;
 const order=async product=>(await rpc(other,{action:'purchase_order',product_id:product,depositor:'테스트',request_id:crypto.randomUUID()})).order;
 const premium=await order('premium_supporter_pack');assert.equal(premium.amount,8900);await assert.rejects(gift('premium_supporter_pack'),{code:'PT409'});
 await rpc(admin,{action:'admin_purchase_approve',order_id:premium.id,confirmed_amount:8900,deposit_reference:'local-upgrade-001'});
 await assert.rejects(rpc(admin,{action:'admin_paid_revoke',user_id:other,order_id:base,reason:'회수 차단 검사'}),{code:'PT409'});
 assert.equal((await rpc(admin,{action:'admin_paid_status',user_id:other})).owned.supporter_pack.revoke_blocked,true);
 await assert.rejects(rpc(admin,{action:'admin_paid_revoke',user_id:other,order_id:premium.id,reason:'유료 구매 회수 검사'}),{code:'PT404'});
 }finally{await db.close();}
});
