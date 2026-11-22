import {readFile} from 'node:fs/promises';import {test} from 'node:test';import assert from 'node:assert/strict';import {publicFixture} from './public-server-fixture.mjs';
test('public paid APIs/bonuses are unavailable even for administrators; December starts exactly at KST midnight',async()=>{
 const {db,rpc}=await publicFixture(),admin=crypto.randomUUID(),player=crypto.randomUUID();
 try{
 await db.query('insert into auth.users(id) values($1),($2)',[admin,player]);await db.query("update players set role='admin' where user_id=$1",[admin]);
 for(const who of [admin,player,null])for(const action of ['purchase_catalog','purchase_order','purchase_equip','admin_purchase_config','admin_paid_status','admin_paid_grant','custom_status','custom_prepare','auto_rebirth_status','auto_rebirth_toggle'])await assert.rejects(rpc(who,{action}),e=>e.code==='PT403');
 assert.equal((await db.query('select wakppu_supporter_percent($1) n',[admin])).rows[0].n,0);
 for(const instant of ['2026-11-22T00:00:00+09:00','2026-11-30T23:59:59.999+09:00']){
 await db.exec(`create or replace function wakppu_monthly_now() returns timestamptz language sql as $$select '${instant}'::timestamptz$$`);
 await db.query('select wakppu_monthly_record($1)',[player]);
 const r=await rpc(player,{action:'monthly_rankings'});assert.equal(r.not_started,true);assert.deepEqual(r.seasons,[]);assert.deepEqual(r.rows,[]);
 assert.equal((await db.query('select count(*) n from wakppu_monthly_clicks')).rows[0].n,0);
 }
 await assert.rejects(rpc(player,{action:'monthly_rankings',month:'2026-11'}),e=>e.code==='PT400');
 await db.exec("create or replace function wakppu_monthly_now() returns timestamptz language sql as $$select '2026-12-01T00:00:00+09:00'::timestamptz$$");
 await db.query('select wakppu_monthly_record($1)',[player]);const r=await rpc(player,{action:'monthly_rankings'});assert.equal(r.month,'2026-12');assert.deepEqual(r.seasons,['2026-12']);assert.equal(r.me.clicks,'1');
 const profile=await rpc(admin,{action:'profile_status'});assert.ok(!JSON.stringify(profile).includes('후원자'));assert.ok(!JSON.stringify(profile).includes('supporter_glow'));assert.ok(!JSON.stringify(profile).includes('premium_celestial'));
 await db.exec(await readFile(new URL('./public-server-production-check.sql',import.meta.url),'utf8'));
 }finally{await db.close();}
});
