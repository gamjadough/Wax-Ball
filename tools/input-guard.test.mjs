import {test} from 'node:test';import assert from 'node:assert/strict';
import {createStore} from './admin-service.mjs';import {execute,analyze,guardState} from './input-guard-service.mjs';import {itemState} from './items-service.mjs';
const samples=(start=0,dt=100,n=180,jitter=0)=>Array.from({length:n},(_,i)=>[start+i*dt+(i%2?jitter:0),500,500]);
const fixture=()=>{const store=createStore();store.sleep_now_ms=Date.parse('2026-10-20T03:00:00Z');store.input_now_ms=Date.now();const player=store.players[1];return {store,player,send:(action,extra={})=>execute(store,player,{action,request_id:crypto.randomUUID(),item_revision:itemState(player).revision,...extra})};};
test('metrics: fixed mobile taps, jitter, slow regular clicks, short bursts and invalid reports',()=>{
 assert.equal(analyze(samples(0,200)).suspect,false);assert.equal(analyze(samples(0,60,240,17)).suspect,false);assert.equal(analyze(samples(0,5,100)).suspect,false);
 const m=analyze(samples());assert.equal(m.suspect,true);assert.equal(m.fixed,1);assert.equal(m.cps,10);
 for(const s of [null,[[1,500,500],[0,500,500]],[[0,-1,500]],[[0,500.5,500]],Array(513).fill([0,0,0])])assert.throws(()=>analyze(s));
});
test('server bucket: accepted inputs only, replay does not charge, throttle has no reward, refill and slow traffic',()=>{
 const {store,player,send}=fixture();const first={action:'item_hit',request_id:crypto.randomUUID(),item_revision:0};const r=execute(store,player,first);const g=guardState(player,store.input_now_ms);assert.deepEqual(execute(store,player,first),r);assert.equal(g.hits.length,1);
 for(let i=1;i<80;i++)send('item_hit');const before=structuredClone(player.state);assert.throws(()=>send('item_hit'),e=>e.status===429);assert.deepEqual(player.state,before);assert.equal(player.moderation.status,'active');
 store.input_now_ms+=1000;for(let i=0;i<40;i++)send('item_hit');assert.throws(()=>send('item_hit'),e=>e.status===429);
 for(let i=0;i<100;i++){store.input_now_ms+=250;send('item_hit');}assert.equal(player.moderation.status,'active');
});
test('only 3 corroborated independent reports restrict; no client-only penalty; pages and administrator authorization',()=>{
 const {store,player,send}=fixture(),session=crypto.randomUUID();const g=guardState(player,store.input_now_ms);
 store.input_now_ms+=18000;const first=send('input_report',{session_id:session,samples:samples()});assert.equal(first.input_guard.score,0);assert.equal(player.moderation.status,'active');
 for(let step=1;step<=3;step++){
  for(let i=0;i<36;i++){store.input_now_ms+=500;send('item_hit');}
  const req={action:'input_report',request_id:crypto.randomUUID(),session_id:session,samples:samples(step*20000)};
  const r=execute(store,player,req);assert.equal(r.input_guard.score,Math.min(100,step*40));
  if(step<3){assert.deepEqual(execute(store,player,req),r);assert.throws(()=>send('input_report',{session_id:session,samples:samples(step*20000)}));}
 }
 assert.equal(player.moderation.status,'suspended');assert.equal(player.moderation.strikes,1);assert.ok(Date.parse(player.moderation.suspended_until)-store.input_now_ms===120000);assert.throws(()=>send('item_hit'),e=>e.status===403);
 const admin=store.players[0];const rows=execute(store,admin,{action:'admin_input_guard',page:0});assert.equal(rows.rows.length,4);assert.ok(rows.rows.at(0).reasons.includes('같은 상대 좌표 반복'));
 assert.throws(()=>execute(store,{...admin,is_anonymous:true},{action:'admin_input_guard'}));
 player.moderation.suspended_until=new Date(Date.now()-1).toISOString();assert.doesNotThrow(()=>send('item_hit'));
 execute(store,admin,{action:'admin_unban',user_id:player.id});assert.equal(g.score,0);assert.equal(player.moderation.status,'active');
 assert.throws(()=>send('input_report',{session_id:session,user_id:admin.id,samples:samples(200000)}));
});
test('normal fast irregular touches and slow fixed-coordinate runs never accumulate restriction',()=>{
 const {store,player,send}=fixture(),session=crypto.randomUUID();guardState(player,store.input_now_ms);
 for(let j=0;j<10;j++){
  for(let i=0;i<36;i++){store.input_now_ms+=500;send('item_hit');}
  const r=send('input_report',{session_id:session,samples:j%2?samples(j*40000,200,140):samples(j*40000,60,240,17)});assert.equal(r.input_guard.score,0);
 }
 assert.equal(player.moderation.status,'active');
});
test('delayed network batches and server-side bursts alone do not become macro evidence',()=>{
 const {store,player,send}=fixture(),session=crypto.randomUUID();guardState(player,store.input_now_ms);
 for(let j=0;j<4;j++){
  store.input_now_ms+=18000;
  for(let i=0;i<40;i++)send('item_hit');
  const r=send('input_report',{session_id:session,samples:samples(j*40000,75,240,25)});
  assert.equal(r.input_guard.score,0);assert.equal(player.moderation.status,'active');
 }
});
