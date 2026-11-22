import {test} from 'node:test';import assert from 'node:assert/strict';
import {friendsGateFixture} from './friends-gate-fixture.mjs';
test('friends entry requires a server-issued token, including signed-in administrators',async()=>{
 const {db,rpc,access}=await friendsGateFixture(),admin=crypto.randomUUID(),player=crypto.randomUUID();
 try{
 await db.query('insert into auth.users(id) values($1),($2)',[admin,player]);
 await db.query("update players set role='admin' where user_id=$1",[admin]);
 for(const u of [null,admin,player])for(const action of ['status','rankings','bootstrap','items','admin_search'])
  await assert.rejects(rpc(u,{action}),e=>e.code==='PT403'&&e.hint==='FRIEND_GATE_REQUIRED');
 assert.equal((await access({mode:'check'})).allowed,false);
 assert.equal((await access({mode:'unlock',password:'wrong'})).allowed,false);
 assert.equal((await access({mode:'check'},{'x-wakppu-access':'forged-token'})).allowed,false);
 const granted=await access({mode:'unlock',password:'fixture-entry-only'});
 assert.equal(granted.allowed,true);assert.match(granted.token,/^[0-9a-f]{64}$/);
 const headers={'x-wakppu-access':granted.token};
 assert.equal((await access({mode:'check'},headers)).allowed,true);
 assert.ok(await rpc(admin,{action:'admin_search',query:''},false,headers));
 await assert.rejects(rpc(player,{action:'admin_search',query:''},false,headers),e=>e.code==='PT403');
 const items=await rpc(player,{action:'items'},false,headers);
 const hit=await rpc(player,{action:'item_hit',request_id:crypto.randomUUID(),item_revision:items.revision},false,headers);
 assert.ok(hit.revision>items.revision);
 assert.equal((await db.query("select has_function_privilege('authenticated','public.wakppu_api_before_friend_gate(jsonb)','execute') leaked")).rows[0].leaked,false);
 assert.equal((await db.query("select has_table_privilege('anon','public.wakppu_friend_gate_config','select') leaked")).rows[0].leaked,false);
 await db.exec("update wakppu_friend_gate_sessions set expires_at=now()-interval '1 second'");
 assert.equal((await access({mode:'check'},headers)).allowed,false);
 await assert.rejects(rpc(admin,{action:'status'},false,headers),e=>e.code==='PT403');
 // Direct table reads are gated too, while existing own-row policies remain.
 await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:player})]);
 await db.exec('set role authenticated');
 assert.equal((await db.query('select count(*) n from game_states')).rows[0].n,0);
 await db.exec('reset role');
 }finally{await db.close();}
});
test('wrong-code attempts are persisted and throttled',async()=>{
 const {db,access}=await friendsGateFixture();
 try{
 for(let i=0;i<8;i++)assert.equal((await access({mode:'unlock',password:'bad'})).allowed,false);
 const blocked=await access({mode:'unlock',password:'fixture-entry-only'});assert.equal(blocked.allowed,false);assert.match(blocked.error,/1분/);
 await db.exec("update wakppu_friend_gate_attempts set started_at=now()-interval '2 minutes'");
 assert.equal((await access({mode:'unlock',password:'fixture-entry-only'})).allowed,true);
 }finally{await db.close();}
});
