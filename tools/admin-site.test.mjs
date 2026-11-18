import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {buildAdminSite} from './build-admin-site.mjs';import {publicFixture} from './public-server-fixture.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('standalone admin build has no gameplay, uses current controls and no secrets',async()=>{
 const html=await buildAdminSite();
 assert.match(html,/id="adminLoginForm"/);assert.match(html,/id="serverSelect"/);
 assert.doesNotMatch(html,/src="[^"]*game\.js|src="[^"]*sound\.js|<iframe|service_role|sb_secret_/);
 assert.match(html,/id="admin"[^>]*hidden/);
 const controls=await read('wakppuball/js/admin-panel.js');
 assert.match(controls,/location.href='..\/wakppuball-admin/);
 assert.match(controls,/wakppu-admin-locked/);
 const site=await read('wakppuball-admin/admin-site.js');
 assert.match(site,/account.is_anonymous/);assert.match(site,/status.role!=='admin'/);
 assert.match(site,/adminPassword'\).value=''/);
});
test('administrator privileges, huge gold and account isolation use real server checks',async()=>{
 const {db,rpc}=await publicFixture(),admin=crypto.randomUUID(),player=crypto.randomUUID(),other=crypto.randomUUID();
 try{
 await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'admin@example.invalid',now()),($2,'player@example.invalid',now()),($3,'other@example.invalid',now())",[admin,player,other]);
 await db.query("update players set role='admin' where user_id=$1",[admin]);
 const huge='123'+('0'.repeat(2470));
 const r=await rpc(admin,{action:'admin_gold',user_id:player,mode:'set',value:huge});
 assert.equal(r.target.state.gold,huge);
 await assert.rejects(rpc(player,{action:'admin_gold',user_id:other,mode:'set',value:'100',role:'admin'}),e=>e.code==='PT403');
 await assert.rejects(rpc(admin,{action:'admin_search',query:''},true),e=>e.code==='PT403');
 await db.query("update players set role='player' where user_id=$1",[admin]);
 await assert.rejects(rpc(admin,{action:'admin_search',query:''}),e=>e.code==='PT403');
 assert.equal((await db.query('select gold::text gold from game_states where user_id=$1',[player])).rows[0].gold,huge);
 assert.equal((await db.query('select gold::text gold from game_states where user_id=$1',[other])).rows[0].gold,'0');
 }finally{await db.close();}
});
