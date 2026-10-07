import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStore,execute} from './admin-service.mjs';
import {itemAction,itemState,itemData} from './items-service.mjs';
test('catalog probability boundaries, prices, multi-pull pity and retry',()=>{
 const s=createStore(),p=s.players[1];p.state.gold='100000000000000000001';
 assert.equal(itemData.ranks.reduce((n,r)=>n+r.weight,0),10000);assert.equal(itemData.list.length,16);
 for(const [roll,rank] of [[0,'common'],[.5999,'common'],[.6,'rare'],[.85,'hero'],[.95,'legendary'],[.995,'transcendent']]){
  const actor={state:{gold:'5000000000000000000'}};const result=itemAction(actor,{action:'item_draw',count:1,item_revision:0,request_id:crypto.randomUUID()},{rng:()=>roll});
  assert.equal(itemData.list.find(d=>d.id===result.results[0]).rank,rank);
 }
 itemState(p).pity=98;const req={action:'item_draw',count:5,item_revision:0,request_id:crypto.randomUUID()};
 const r=itemAction(p,req,{rng:()=>0});assert.equal(r.results[1],'transcendent_wax_heart');assert.equal(r.pity,3);assert.equal(r.gold,'78000000000000000001');
 assert.deepEqual(itemAction(p,req),r);assert.equal(itemState(p).total,5);
 assert.throws(()=>execute(s,p,{action:'save_progress',gold:'100000000000000000001',item_revision:0}),/상태/);
 assert.throws(()=>itemAction(p,{action:'item_draw',count:2,item_revision:1,request_id:crypto.randomUUID()}));
});
test('strongest channels, rational rounding and counted item/event consumption',()=>{
 const s=createStore(),p=s.players[1],inv=itemState(p),now=Date.now();
 inv.effects={common_honey_small:{expires_at:now+100000},hero_golden_honey:{expires_at:now+100000},common_crack_piece:{remaining:30},rare_iron_hammer:{remaining:50},legendary_golden_coating:{remaining:20}};
 let e=itemData.effective(inv.effects,now+10000,now+10000,now);
 assert.equal(e.honey.value,200);assert.equal(e.reward.value,400);assert.equal(e.add.value,10);
 assert.equal(itemData.reward(1,0,1,e),8n);
 const req=()=>({action:'item_hit',item_revision:itemState(p).revision,request_id:crypto.randomUUID()});
 const hit=execute(s,p,req());assert.equal(hit.reward,'8');assert.equal(inv.effects.common_crack_piece.remaining,30);assert.equal(inv.effects.rare_iron_hammer.remaining,49);assert.equal(inv.effects.legendary_golden_coating.remaining,19);
 assert.equal(itemData.damage(1,{...e,add:{value:0},damage:{value:150}}),1);
 execute(s,s.players[0],{action:'admin_ball_event',mode:'start',delay_seconds:0,duration_seconds:60});
 const result=execute(s,p,{...req(),event_id:s.admin_ball_event.id});assert.equal(result.clicks,11);
 assert.throws(()=>execute(s,null,{action:'items'}));
 p.moderation.status='banned';assert.throws(()=>execute(s,p,{action:'item_draw',count:1}),/제한/);
});
test('duration extension, time expiry, rebirth retention',()=>{
 const s=createStore(),p=s.players[1],inv=itemState(p);inv.inventory.hero_golden_honey=2;
 const use=()=>itemAction(p,{action:'item_use',item_id:'hero_golden_honey',request_id:crypto.randomUUID(),item_revision:inv.revision},{now:1000});
 assert.equal(use().effects.hero_golden_honey.expires_at,901000);assert.equal(use().effects.hero_golden_honey.expires_at,1801000);
 assert.equal(itemData.effective(inv.effects,0,0,1801001).honey.value,100);
 execute(s,p,{action:'save_progress',item_revision:inv.revision,rebirths:1,gold:'0'});assert.deepEqual(inv.effects,{});assert.equal(inv.inventory.hero_golden_honey,0);
});
