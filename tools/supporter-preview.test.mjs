import {test} from 'node:test';import assert from 'node:assert/strict';import {createStore,execute} from './admin-service.mjs';import {itemState} from './items-service.mjs';
test('loopback preview: 5% carry and idempotent gameplay match SQL, no bonus for nonowners',()=>{
 const store=createStore(),p=store.players[1];store.sleep_now_ms=Date.parse('2026-10-20T12:00:00+09:00');p.state.gold='0';p.state.hammer_owned=true;p.state.hammer_level=30;p.supporterPack=true;
 let last,total=0n;for(let i=0;i<20;i++){const b={action:'item_hit',request_id:crypto.randomUUID(),item_revision:itemState(p).revision};last=execute(store,p,b);total+=BigInt(last.reward);assert.deepEqual(execute(store,p,b),last);}
 assert.equal(total,21n);assert.equal(p.state.gold,'21');assert.equal(p.supporterGoldRemainder,0);
 p.supporterPack=false;const r=execute(store,p,{action:'item_hit',request_id:crypto.randomUUID(),item_revision:itemState(p).revision});assert.equal(r.reward,'1');
 p.premiumSupporterPack=true;p.supporterPack=true;p.supporterGoldRemainder=0;
 total=0n;for(let i=0;i<10;i++){const b={action:'item_hit',request_id:crypto.randomUUID(),item_revision:itemState(p).revision};const result=execute(store,p,b);total+=BigInt(result.reward);assert.deepEqual(execute(store,p,b),result);}assert.equal(total,13n);
});
