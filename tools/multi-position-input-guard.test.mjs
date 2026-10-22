import {test} from 'node:test';import assert from 'node:assert/strict';import {vectors} from './input-guard-vectors.mjs';
import {createStore} from './admin-service.mjs';import {execute,analyze,guardState} from './input-guard-service.mjs';import {itemState} from './items-service.mjs';
const fixture=()=>{const store=createStore();store.sleep_now_ms=Date.parse('2026-10-22T03:00:00Z');store.input_now_ms=Date.now();const p=store.players[1],s=crypto.randomUUID();guardState(p,store.input_now_ms);return {store,p,report:(samples)=>{for(let i=0;i<36;i++){store.input_now_ms+=500;execute(store,p,{action:'item_hit',request_id:crypto.randomUUID(),item_revision:itemState(p).revision});}return execute(store,p,{action:'input_report',request_id:crypto.randomUUID(),session_id:s,samples});}};};
test('3-12 point unequal-interval cycles and respawn pauses are detected; position alone is insufficient',()=>{
 for(const points of [3,7,8,12])for(const pauses of [false,true]){const m=analyze(vectors('cycle',{points,pauses}));assert.equal(m.regular,false);assert.equal(m.cyclic,true,JSON.stringify(m));assert.equal(m.loop_period,points);assert.equal(m.suspect,true);assert.ok(m.fixed<.1||points===3);}
 for(const kind of ['human-loop','human-random'])for(let seed=1;seed<=80;seed++){const m=analyze(vectors(kind,{seed}));assert.equal(m.suspect,false,kind+' seed '+seed);}
 const short=analyze(vectors('cycle',{n:60}));assert.equal(short.suspect,false);assert.equal(short.overspeed,false);
 const simultaneous=vectors('cycle',{n:1050}).map((p,i)=>[Math.floor(i/7)*100,p[1],p[2]]),batch=analyze(simultaneous);assert.equal(batch.simultaneous,true);assert.equal(batch.cyclic,false);assert.equal(batch.suspect,false);assert.equal(batch.overspeed,true);
});
test('fully irregular high speed receives a temporary cap but never an account suspension by speed alone',()=>{
 const f=fixture();for(let step=0;step<8;step++){const m=vectors('random-fast',{n:450,start:step*40000});assert.equal(analyze(m).cyclic,false);assert.equal(analyze(m).overspeed,true);const r=f.report(m);assert.equal(r.input_guard.score,0);assert.ok(r.input_guard.speed_limited_until);assert.equal(r.input_guard.restricted_until,null);}
 assert.equal(f.p.moderation.status,'active');const g=guardState(f.p,f.store.input_now_ms);let count=0;
 for(let i=0;i<30;i++)try{execute(f.store,f.p,{action:'item_hit',request_id:crypto.randomUUID(),item_revision:itemState(f.p).revision});count++;}catch(e){assert.equal(e.status,429);}
 assert.ok(count<=24);const gold=String(f.p.state.gold);assert.throws(()=>execute(f.store,f.p,{action:'item_hit',request_id:crypto.randomUUID(),item_revision:itemState(f.p).revision}),{status:429});assert.equal(String(f.p.state.gold),gold);
 f.store.input_now_ms+=31000;for(let i=0;i<40;i++)execute(f.store,f.p,{action:'item_hit',request_id:crypto.randomUUID(),item_revision:itemState(f.p).revision});
 execute(f.store,f.store.players[0],{action:'admin_unban',user_id:f.p.id});assert.equal(g.speedUntil,null);
});
test('cycle warnings escalate only after 3 independent server-corroborated reports; replay and client-only claims do not escalate',()=>{
 const f=fixture();const r=f.report(vectors());assert.equal(r.input_guard.score,35);assert.ok(r.input_guard.speed_limited_until);assert.equal(r.input_guard.restricted_until,null);
 assert.equal(f.report(vectors('cycle',{start:40000})).input_guard.score,70);assert.equal(f.report(vectors('cycle',{start:80000})).input_guard.score,100);assert.equal(f.p.moderation.status,'suspended');
 const other=fixture();other.store.input_now_ms+=15000;const req={action:'input_report',request_id:crypto.randomUUID(),session_id:crypto.randomUUID(),samples:vectors()};const a=execute(other.store,other.p,req);assert.equal(a.input_guard.score,0);assert.equal(a.input_guard.speed_limited_until,null);assert.deepEqual(execute(other.store,other.p,req),a);
});
