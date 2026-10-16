import {test} from 'node:test';import assert from 'node:assert/strict';import {skinAction,skinState,skinPrice,skinDefs} from './skins-service.mjs';import {itemState} from './items-service.mjs';
const player=()=>({state:{gold:String(skinPrice*1000n),unlocked_ball_ids:['yellow','eternity'],hammer_level:30}});
const send=(p,action,extra={},roll=0)=>skinAction(p,{action,request_id:crypto.randomUUID(),item_revision:itemState(p).revision,skin_revision:skinState(p).revision,...extra},()=>roll);
test('single price equals item 5-pull x10; each duplicate pays approved shards and trades preserve pity',()=>{
 const p=player();let roll=0;for(const d of skinDefs){send(p,'skin_draw',{count:1},roll);const s=send(p,'skin_draw',{count:1},roll);assert.equal(s.result.shards_awarded,d.duplicate);roll+=d.weight;}
 assert.equal(skinState(p).shards,144n);assert.equal(p.state.hammer_level,30);
 assert.throws(()=>send(p,'skin_draw',{count:3}));assert.equal(skinPrice,220000000000000000000n);
 const q=player();skinState(q).shards=1000n;skinState(q).pity=75;const e=send(q,'skin_exchange',{skin_id:'eternity_transcendent'});assert.equal(e.shards,'0');assert.equal(e.pity,75);assert.equal(e.total,'0');
});
test('pity is independent, stale writes/forged equips fail and retries never charge twice',()=>{
 const p=player();skinState(p).pity=99;
 const b={action:'skin_draw',count:1,request_id:crypto.randomUUID(),item_revision:0,skin_revision:0};const s=skinAction(p,b,()=>0);assert.equal(s.result.skin_id,'eternity_transcendent');assert.deepEqual(skinAction(p,b),s);assert.throws(()=>skinAction(p,{...b,count:5}));assert.throws(()=>send(p,'skin_equip',{ball_id:'eternity',skin_id:'eternity_rare'}));
 assert.equal(send(p,'skin_equip',{ball_id:'eternity',skin_id:'eternity_transcendent'}).equipped.eternity,'eternity_transcendent');assert.equal(send(p,'skin_equip',{ball_id:'eternity',skin_id:null}).equipped.eternity,undefined);
});
test('admin virtual skins preserve purchased ownership and disappear for revoked or anonymous roles',()=>{
 const p=player();p.role='admin';p.state.unlocked_ball_ids=['yellow'];
 assert.equal(Object.keys(skinAction(p,{action:'skins'}).owned).length,5);
 const s=send(p,'skin_equip',{ball_id:'eternity',skin_id:'eternity_transcendent'});assert.equal(s.equipped.eternity,'eternity_transcendent');assert.deepEqual(skinState(p).owned,{});assert.equal(s.shards,'0');
 p.is_anonymous=true;assert.deepEqual(skinAction(p,{action:'skins'}).owned,{});assert.throws(()=>send(p,'skin_equip',{ball_id:'eternity',skin_id:'eternity_rare'}));
 p.is_anonymous=false;p.role='player';assert.deepEqual(skinAction(p,{action:'skins'}).owned,{});
});
