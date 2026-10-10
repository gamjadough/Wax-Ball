import {test} from 'node:test';
import assert from 'node:assert/strict';
import {itemData,itemState} from './items-service.mjs';
import {createStore,execute} from './admin-service.mjs';
test('shop stacks with exactly one strongest draw Gold; heart covers three channels',()=>{
 const now=1000,effects={common_honey_small:{expires_at:10000},hero_gem_honey:{expires_at:10000},legendary_golden_coating:{remaining:20},transcendent_wax_heart:{expires_at:10000}};
 const e=itemData.effective(effects,10000,10000,now);
 assert.equal(e.reward.value,400);assert.equal(itemData.reward(1000,5,2,e),1536000n);
 assert.equal(e.animation.value,200);assert.equal(e.respawn.value,300);
 assert.equal(itemData.damage(451845,e),451845);assert.equal(itemData.required(184320,e,true),368640);
 const heart=itemData.effective({transcendent_wax_heart:{expires_at:10000}},10000,10000,now);
 assert.equal(itemData.reward(1000,0,1,heart),18000n);
 assert.equal(itemData.timing(heart).animation,2);
 assert.equal(itemData.timing(heart).respawn,3);
 for(const d of itemData.list)assert.ok(!['add','damage','difficulty','honey'].includes(d.group));
 assert.equal(itemData.list.length,30);
});
test('counted respawn consumes only winning effect on break, preserves weaker inventory',()=>{
 const s=createStore(),p=s.players[1],inv=itemState(p);
 p.state.hammer_owned=true;p.state.hammer_level=30;
 inv.effects={common_crack_piece:{remaining:1},common_mini_hammer:{remaining:1},common_wax_thread:{remaining:1}};
 const r=execute(s,p,{action:'item_hit',item_revision:0,request_id:crypto.randomUUID()});
 assert.equal(r.required_clicks,5);assert.equal(r.reward,'1');
 assert.equal(inv.effects.common_mini_hammer.remaining,0);
 assert.equal(inv.effects.common_crack_piece.remaining,1);assert.equal(inv.effects.common_wax_thread.remaining,1);
 const e=itemData.effective(inv.effects);
 assert.equal(e.respawn.id,'common_crack_piece');
});
