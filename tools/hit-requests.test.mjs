import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../wakppuball/js/hit-requests.js',import.meta.url),'utf8');
function fixture(invoke=async()=>({ok:true})){const c={AbortController,setTimeout,clearTimeout,Promise,WakppuAuth:{invoke}};vm.runInNewContext(source,c);return c.WakppuHitRequests;}
test('compact queue retains every accepted click with constant storage and explicit lifecycle clear',()=>{const q=fixture().createQueue();for(let i=0;i<100000;i++)q.push([i,i]);assert.equal(q.length,100000);for(let i=0;i<100000;i++)assert.equal(q.shift()[0],99999);assert.equal(q.length,0);assert.equal(q.shift(),undefined);q.push([1,2]);q.clear();assert.equal(q.length,0);});
test('lost response retries the exact request ID; late completion is not applied twice',async()=>{let calls=0,paid=0;const cache=new Map(),ids=[];const api=fixture(async(a,b,{signal})=>{calls++;ids.push(b.request_id);if(!cache.has(b.request_id)){paid++;cache.set(b.request_id,{reward:'10'});}if(calls===1)return new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(new Error('aborted')));});return cache.get(b.request_id);});const r=await api.send('item_hit',{request_id:'same-id'},{timeoutMs:5,retryDelayMs:0});assert.equal(r.reward,'10');assert.equal(paid,1);assert.deepEqual(ids,['same-id','same-id']);});
test('hung operations abort and exhaust bounded attempts; HTTP guards never auto-retry',async()=>{let attempts=0,aborted=0;const api=fixture(async(a,b,{signal})=>{attempts++;signal.addEventListener('abort',()=>aborted++);return new Promise(()=>{});});await assert.rejects(api.send('item_hit',{}, {timeoutMs:3,retryDelayMs:0}),/서버 응답/);assert.equal(attempts,3);assert.equal(aborted,3);let calls=0;const guard=fixture(async()=>{calls++;throw Object.assign(new Error('rate limited'),{status:429});});await assert.rejects(guard.send('item_hit',{}),{status:429});assert.equal(calls,1);});
test('account/ball changes cancel stale responses before they reach the game',async()=>{let valid=true;const api=fixture(async()=>{valid=false;return {reward:'100'};});await assert.rejects(api.send('item_hit',{}, {valid:()=>valid}),{cancelled:true});});

test('breaking a ball discards buffered input; no respawn path preserves or drains the previous queue',()=>{
 const game=readFileSync(new URL('../wakppuball/js/game.js',import.meta.url),'utf8');
 const start=game.indexOf('  function breakBall(data) {'),end=game.indexOf('// WebKit',start);
 const queue=fixture().createQueue();for(let i=0;i<20;i++)queue.push([1,2]);
 const timing={animation:1,respawn:1},context={itemBreakTiming:timing,window:{WakppuHalloweenDecor:{timing:()=>timing}},eventSelected:false,limitedSelected:()=>false,ordinaryClicks:new Map([[0,5]]),state:{selected:0,busy:false},animationEpoch:1,pendingItemHits:queue,rewardReadyEpoch:1};
 vm.runInNewContext(game.slice(start,end)+'}\nbreakBall({});',context);
 assert.equal(queue.length,0);assert.equal(context.state.busy,true);assert.equal(context.rewardReadyEpoch,-1);
 assert.doesNotMatch(game,/preserveHits|spawnBall\(true,true\)/);
 const spawn=game.slice(game.indexOf('  function spawnBall('),game.indexOf('  function spawnBall(')+700);
 assert.match(spawn,/pendingItemHits\.clear\(\)/);
});
