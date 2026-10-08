import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createStore,execute} from './admin-service.mjs';
const context={};vm.createContext(context);
vm.runInContext(readFileSync(new URL('../wakppuball/js/balls-data.js',import.meta.url),'utf8')+';globalThis.costs=REBIRTH_COSTS;globalThis.mult=rebirthMultiplier;',context);
test('preserve 1–500 costs; ×1000 starts at 501; unchanged ×2 reward growth',()=>{
 const {costs,mult}=context;
 assert.equal(costs.length,1000);assert.equal(costs[0],2000000n);
 assert.equal(costs[1],6000000n);assert.equal(costs[24],12000000000000000n);
 let previous=costs[24];
 for(let i=25;i<100;i++){
  if((i-25)%10!==9)previous*=2n;
  assert.equal(costs[i],previous);
 }
 assert.equal(costs[99],3541774862152233910272000000000000000n);
 for(let i=100;i<500;i++)assert.equal(costs[i],costs[i-1]*2n);
 for(let i=500;i<1000;i++)assert.equal(costs[i],costs[i-1]*1000n);
 assert.equal(mult(1000),2n**1000n);
 assert.equal(costs[499].toString().length,157);
 assert.equal(costs[999],costs[499]*1000n**500n);
 assert.equal(costs[999].toString().length,1657);
});
test('local admin edits, saved huge Gold and exact ranking order',()=>{
 const s=createStore(),admin=s.players[0],player=s.players[1],gold=context.costs[999].toString();
 execute(s,admin,{action:'admin_gold',user_id:player.id,mode:'set',value:gold});
 execute(s,admin,{action:'admin_rebirths',user_id:player.id,mode:'set',value:999});
 execute(s,admin,{action:'admin_rebirths',user_id:player.id,mode:'add',value:1});
 assert.equal(player.state.rebirths,1000);
 assert.throws(()=>execute(s,admin,{action:'admin_rebirths',user_id:player.id,mode:'add',value:1}));
 execute(s,admin,{action:'admin_rebirths',user_id:player.id,mode:'subtract',value:1});
 assert.equal(player.state.rebirths,999);assert.equal(BigInt(player.state.gold).toString(),gold);
 const revision=player.state.admin_revision;
 assert.throws(()=>execute(s,player,{action:'save_progress',gold:'0',rebirths:0,admin_revision:revision-1}),{status:409});
 execute(s,player,{action:'save_progress',gold,rebirths:1000,admin_revision:revision});
 assert.equal(execute(s,player,{action:'bootstrap'}).state.gold,gold);
 admin.state.rebirths=1000;admin.state.gold=(BigInt(gold)+1n).toString();
 assert.equal(execute(s,admin,{action:'rankings'})[0].nickname,admin.nickname);
});
