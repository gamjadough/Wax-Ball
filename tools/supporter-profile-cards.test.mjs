import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {bankFixture} from './manual-bank-fixture.mjs';
import {installSupporterProfiles,supporterProfileMigration} from './supporter-profile-fixture.mjs';
const admin='00000000-0000-0000-0000-000000000001',regular='00000000-0000-0000-0000-000000000002',premium='00000000-0000-0000-0000-000000000003',plain='00000000-0000-0000-0000-000000000004';
test('paid profile cards: old buyers, real approval/upgrade/refund/revoke, ownership, titles, no new bonuses or auto-equip',async()=>{
 const {db,add,rpc}=await bankFixture();try{
  for(const id of [admin,regular,premium,plain])await add(id,id===admin?'admin':'player');
  await rpc(admin,{action:'admin_purchase_config',mode:'set',revision:0,enabled:true,bank_name:'테스트',account_number:'000-00000',account_holder:'테스트',support_contact:'실제 입금 금지'});
  const buy=async(id,product)=>{const o=(await rpc(id,{action:'purchase_order',product_id:product,depositor:'카드 검증',request_id:crypto.randomUUID()})).order;await rpc(admin,{action:'admin_purchase_approve',order_id:o.id,confirmed_amount:o.amount,deposit_reference:'fixture-'+o.id});return o;};
  // These purchases predate the new cards: no extra order is needed after installation.
  const regularOrder=await buy(regular,'supporter_pack'),premiumOrder=await buy(premium,'premium_supporter_pack');
  await installSupporterProfiles(db,{cards:false});
  const ordersBefore=(await db.query('select id,amount,status from wakppu_purchase_orders order by id')).rows;
  await db.exec(await readFile(supporterProfileMigration,'utf8'));
  const status=id=>rpc(id,{action:'profile_status'}),equip=(id,card_id)=>rpc(id,{action:'profile_equip',card_id});
  const r=await status(regular),p=await status(premium);
  assert.ok(r.owned.includes('supporter_glow'));assert.ok(!r.owned.includes('premium_celestial'));
  assert.ok(p.owned.includes('supporter_glow')&&p.owned.includes('premium_celestial'));
  assert.equal(r.equipped,'wax_beginning');assert.equal(p.equipped,'wax_beginning');
  assert.deepEqual((await db.query('select id,amount,status from wakppu_purchase_orders order by id')).rows,ordersBefore);
  const progressBefore=(await db.query('select * from game_states order by user_id')).rows,itemsBefore=(await db.query('select * from wakppu_items order by user_id')).rows;
  await equip(regular,'supporter_glow');await equip(premium,'premium_celestial');
  assert.equal((await rpc(plain,{action:'player_profile',nickname:'유저03'})).card.id,'premium_celestial');
  await rpc(premium,{action:'profile_title',title_id:'none'});assert.equal((await status(premium)).equipped,'premium_celestial');
  for(const id of [regular,premium]){await equip(id,null);await equip(id,'supporter_glow');}
  assert.deepEqual((await db.query('select * from game_states order by user_id')).rows,progressBefore);
  assert.deepEqual((await db.query('select * from wakppu_items order by user_id')).rows,itemsBefore);
  assert.equal((await db.query('select wakppu_supporter_percent($1) as n',[regular])).rows[0].n,5);assert.equal((await db.query('select wakppu_supporter_percent($1) as n',[premium])).rows[0].n,30);
  await assert.rejects(equip(regular,'premium_celestial'),{code:'PT400'});await assert.rejects(equip(plain,'supporter_glow'),{code:'PT400'});
  await assert.rejects(rpc(plain,{action:'profile_equip',card_id:'premium_celestial',user_id:premium}),{code:'PT403'});
  const catalog=await rpc(regular,{action:'purchase_catalog'});
  assert.ok(catalog.products.find(x=>x.id==='supporter_pack').description.includes('따뜻한 응원'));
  assert.ok(catalog.products.find(x=>x.id==='premium_supporter_pack').description.includes('찬란한 성좌'));
  const upgrade=await buy(regular,'premium_supporter_pack');assert.equal(upgrade.amount,8900);assert.ok((await status(regular)).owned.includes('premium_celestial'));
  await equip(regular,'premium_celestial');await rpc(admin,{action:'admin_purchase_refund',order_id:upgrade.id,refund_reference:'upgrade-refund'});
  assert.equal((await db.query('select equipped from wakppu_profile_cards where user_id=$1',[regular])).rows[0].equipped,'wax_beginning');
  assert.equal((await status(regular)).equipped,'wax_beginning');assert.ok((await status(regular)).owned.includes('supporter_glow'));await equip(regular,'supporter_glow');
  await rpc(admin,{action:'admin_purchase_refund',order_id:regularOrder.id,refund_reference:'regular-refund'});
  assert.equal((await status(regular)).equipped,'wax_beginning');await assert.rejects(equip(regular,'supporter_glow'),{code:'PT400'});
  await equip(premium,'premium_celestial');await rpc(admin,{action:'admin_purchase_refund',order_id:premiumOrder.id,refund_reference:'premium-refund'});
  assert.ok(!(await status(premium)).owned.includes('supporter_glow'));assert.equal((await rpc(plain,{action:'player_profile',nickname:'유저03'})).card.id,'wax_beginning');
  const gift=await rpc(admin,{action:'admin_paid_grant',user_id:plain,product_id:'premium_supporter_pack',request_id:crypto.randomUUID(),reason:'프로필 카드 검증'});
  const giftOrder=(await db.query("select order_id from wakppu_purchase_entitlements where user_id=$1 and product_id='premium_supporter_pack'",[plain])).rows[0].order_id;
  await equip(plain,'premium_celestial');await rpc(admin,{action:'admin_paid_revoke',user_id:plain,order_id:giftOrder,reason:'검증 회수'});assert.equal((await status(plain)).equipped,'wax_beginning');
  await equip(admin,'premium_celestial');await add(admin,'admin',true);await assert.rejects(equip(admin,'premium_celestial'),{code:'PT400'});assert.equal((await status(admin)).equipped,'wax_beginning');
  await add(admin,'player',false);await assert.rejects(equip(admin,'supporter_glow'),{code:'PT400'});
  await db.query("insert into wakppu_profile_card_grants(user_id,card_id) values($1,'golden_champion') on conflict do nothing",[regular]);
  await equip(regular,'golden_champion');assert.equal((await status(regular)).equipped,'golden_champion');
  await db.exec('update test_settings set maintenance=true');await assert.rejects(status(regular),{code:'PT503'});await db.exec('update test_settings set maintenance=false');
  await db.query('update players set banned=true where user_id=$1',[regular]);await assert.rejects(status(regular),{code:'PT403'});
  await db.exec('set role authenticated');await assert.rejects(db.exec("select wakppu_profile_card_available('"+plain+"','supporter_glow')"),{code:'42501'});
 }finally{await db.close();}
});
