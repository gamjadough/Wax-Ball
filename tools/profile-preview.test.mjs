import {test} from 'node:test';import assert from 'node:assert/strict';import {createStore} from './admin-service.mjs';import {createProfilePreview,basicProfileCard} from './profile-preview-service.mjs';
import {spawn} from 'node:child_process';import {once} from 'node:events';import net from 'node:net';import {fileURLToPath} from 'node:url';
test('profile preview has five ranked samples, exactly 3 online/2 offline and random valid public stats only',()=>{
 const store=createStore(),p=createProfilePreview(store),actor=store.players.find(p=>p.id==='local-player'),rows=p.execute(actor,{action:'rankings'});
 assert.equal(rows.length,5);assert.equal(rows.filter(p=>p.online).length,3);assert.equal(rows.filter(p=>!p.online).length,2);assert.equal(new Set(rows.map(p=>p.nickname)).size,5);
 for(const [i,row]of rows.entries()){
  assert.ok(BigInt(row.gold)>0n);assert.ok(row.rebirths>=0&&row.rebirths<=1000);if(i)assert.ok(rows[i-1].rebirths>=row.rebirths);
  const r=p.execute(actor,{action:'player_profile',nickname:row.nickname});assert.equal(r.rank,i+1);assert.equal(r.online,row.online);assert.equal(r.gold,row.gold);assert.equal(r.card.id,basicProfileCard.id);assert.ok(r.discovered_count>0&&r.discovered_count<=r.discovery_total);
  assert.deepEqual(Object.keys(r).sort(),['nickname','title','rank','gold','rebirths','discovered_count','discovery_total','online','card'].sort());
  assert.ok(!JSON.stringify(r).includes('email'));assert.ok(!JSON.stringify(r).includes('last_seen'));assert.ok(!JSON.stringify(r).includes('moderation'));
 }
});
test('free basic card equips/unequips idempotently for self including admin, never charges Gold or edits inventory; invalid/forged/missing targets fail',()=>{
 const store=createStore(),p=createProfilePreview(store),actor=store.players.find(p=>p.id==='local-player'),other=store.players.find(p=>p.id==='profile-demo-1');
 const before=structuredClone(actor.state),otherBefore=other.profileCard;
 assert.deepEqual(p.execute(actor,{action:'profile_status'}).owned,['wax_beginning']);
 p.execute(actor,{action:'profile_equip',card_id:null});assert.equal(p.execute(actor,{action:'player_profile',nickname:actor.nickname}).card,null);
 for(let i=0;i<2;i++)assert.equal(p.execute(actor,{action:'profile_equip',card_id:'wax_beginning'}).equipped,'wax_beginning');
 assert.deepEqual(actor.state,before);assert.equal(other.profileCard,otherBefore);
 assert.throws(()=>p.execute(actor,{action:'profile_equip',card_id:'paid_fake'}),{status:400});assert.throws(()=>p.execute(actor,{action:'profile_equip',card_id:null,user_id:other.id}),{status:403});
 assert.throws(()=>p.execute(null,{action:'profile_status'}),{status:401});assert.throws(()=>p.execute(actor,{action:'player_profile',nickname:'missing'}),{status:404});
 other.ranking_hidden=true;assert.throws(()=>p.execute(actor,{action:'player_profile',nickname:other.nickname}),{status:404});
 const admin=store.players.find(p=>p.role==='admin');assert.equal(p.execute(admin,{action:'profile_equip',card_id:'wax_beginning'}).equipped,'wax_beginning');
});
test('HTTP preview requires explicit server flag, keeps production HTML unchanged and rejects unauthenticated/cross-origin writes',async()=>{
 for(const enabled of [false,true]){
  const reserve=net.createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening');const port=reserve.address().port;await new Promise(r=>reserve.close(r));
  const proc=spawn(process.execPath,[fileURLToPath(new URL('./local-server.mjs',import.meta.url))],{cwd:fileURLToPath(new URL('../',import.meta.url)),env:{...process.env,WAKPPU_LOCAL_PORT:String(port),WAKPPU_LOCAL_PROFILE_PREVIEW:enabled?'1':'0',WAKPPU_LOCAL_SLEEP_TIME:'2026-10-23T03:00:00Z'},stdio:['ignore','pipe','pipe']});
  try{
   await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Preview server startup timeout')),30000);proc.once('error',reject);proc.stdout.on('data',chunk=>{if(chunk.toString().includes('Local preview:')){clearTimeout(timer);resolve();}});});
   const base='http://127.0.0.1:'+port,plain=await(await fetch(base+'/')).text(),preview=await(await fetch(base+'/?preview=profiles')).text();
   assert.ok(plain.includes('src="js/profile-cards.js?v='));assert.equal(preview.includes('src="js/local-profile-preview.js"'),enabled);
   const post=(path,body,extra={})=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...extra},body:JSON.stringify(body)});
   assert.equal((await post('/local/api',{action:'profile_status'})).status,401);
   const session=await(await post('/local/login',{email:'guest',password:''})).json();const headers={Authorization:'Bearer '+session.token};
   const r=await post('/local/api',{action:'profile_status'},headers);assert.equal(r.ok,true);
   if(enabled){assert.equal((await r.json()).catalog.length,1);const rows=await(await post('/local/api',{action:'rankings'},headers)).json();assert.equal(rows.length,5);assert.equal(rows.filter(p=>p.online).length,3);assert.equal((await post('/local/api',{action:'profile_equip',card_id:null},{...headers,Origin:'https://example.invalid'})).status,403);const asset=await fetch(base+'/images/profile-cards/wax-beginning.png');assert.equal(asset.headers.get('content-type'),'image/png');}
  }finally{proc.kill();if(proc.exitCode===null)await once(proc,'exit');}
 }
});
