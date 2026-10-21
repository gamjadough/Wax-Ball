import {test} from 'node:test';import assert from 'node:assert/strict';
import {createStore,execute} from './admin-service.mjs';import {limitedState} from './limited-service.mjs';import {skinState} from './skins-service.mjs';
test('local pumpkin exchange mirrors prices, revisions, permanent cosmetics and role revocation',()=>{
 const store=createStore(),p=store.players[1],admin=store.players[0];store.limited_preview='active';store.sleep_now_ms=Date.parse('2026-10-20T10:00:00Z');
 const l=limitedState(p);l.tokens=350;const read=a=>execute(store,a,{action:'pumpkin_skins'});
 const send=(a,action,more={})=>{const s=read(a);return execute(store,a,{action,request_id:crypto.randomUUID(),item_revision:s.revision,skin_revision:s.skin_revision,...more});};
 const gold=p.state.gold;const pre=read(p),optout={action:'pumpkin_scare_disable_buy',request_id:crypto.randomUUID(),item_revision:pre.revision,skin_revision:pre.skin_revision};const off=execute(store,p,optout);assert.equal(off.tokens,'250');assert.equal(off.scare_disabled,true);assert.deepEqual(execute(store,p,optout),off);assert.throws(()=>send(p,'pumpkin_scare_disable_buy'));const balance=read(p).tokens;assert.equal(send(p,'pumpkin_scare_disable_equip',{enabled:false}).scare_disabled,false);assert.equal(read(p).tokens,balance);assert.throws(()=>send(p,'pumpkin_scare_disable_buy'));assert.equal(send(p,'pumpkin_scare_disable_equip',{enabled:true}).scare_disabled,true);l.tokens=350;for(const [skin,balance] of [['wisp','300'],['ghost','200'],['eclipse','0']])assert.equal(send(p,'pumpkin_skin_exchange',{skin_id:'pumpkin_'+skin,cost:0}).tokens,balance);
 assert.equal(p.state.gold,gold);assert.throws(()=>send(p,'pumpkin_skin_exchange',{skin_id:'pumpkin_wisp'}));
 assert.throws(()=>send(p,'pumpkin_skin_equip',{ball_id:'halloween-pumpkin-2026',skin_id:'pumpkin_eclipse'}));l.owned['halloween-pumpkin-2026']={reward:'1500000000'};
 const s=read(p),req={action:'pumpkin_skin_equip',request_id:crypto.randomUUID(),item_revision:s.revision,skin_revision:s.skin_revision,ball_id:'halloween-pumpkin-2026',skin_id:'pumpkin_eclipse'};
 const equip=execute(store,p,req);assert.deepEqual(execute(store,p,req),equip);assert.throws(()=>execute(store,p,{...req,skin_id:'pumpkin_wisp'}));
 store.limited_preview='ended';p.state.rebirths++;assert.equal(read(p).scare_disabled,true);assert.equal(read(p).equipped,'pumpkin_eclipse');
 assert.equal(read(admin).can_equip,true);assert.equal(send(admin,'pumpkin_skin_equip',{ball_id:'halloween-pumpkin-2026',skin_id:'pumpkin_wisp'}).equipped,'pumpkin_wisp');assert.deepEqual(skinState(admin).owned,{});
 admin.is_anonymous=true;assert.equal(read(admin).equipped,null);assert.deepEqual(read(admin).owned,{});admin.is_anonymous=false;admin.role='player';assert.equal(read(admin).equipped,null);
 assert.throws(()=>execute(store,null,{action:'pumpkin_skins'}));
});
