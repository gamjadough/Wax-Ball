import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
function setup(){
 const game={account:'a',revision:0,gold:'100',ready:true},ctx={WakppuItemData:{ranks:[],list:[]},WakppuGold:{compact:String},document:{addEventListener(){},querySelector(){return null;}},window:{addEventListener(){}}};
 ctx.window.WakppuItemGame={read:()=>game,accept:(s,gold)=>{game.revision=s.revision;if(gold)game.gold=s.gold;}};
 ctx.WakppuItemGame=ctx.window.WakppuItemGame;ctx.WakppuAuth={invoke:async()=>({})};
 vm.runInNewContext(readFileSync(new URL('../wakppuball/js/items-ui.js',import.meta.url),'utf8'),ctx);
 return {items:ctx.window.WakppuItems,game,ctx};
}
const snap=(revision,count=1,effects={},gold='100')=>({revision,inventory:{hero_golden_honey:count},effects,pity:8,total:10,gold});
test('old snapshots cannot refund stock or roll back revision/Gold; fresh draws still increase stock',()=>{
 const {items,game}=setup();items.accept(snap(0,3));items.accept(snap(1,2,{},'90'));items.accept(snap(2,1,{},'80'));
 assert.equal(items.accept(snap(1,2,{},'90')),false);assert.equal(items.data.inventory.hero_golden_honey,1);assert.equal(game.revision,2);assert.equal(game.gold,'80');
 assert.equal(items.accept(snap(3,2,{},'70')),true);assert.equal(items.data.inventory.hero_golden_honey,2);
});
test('rebirth rejects equal-revision prior transactions, permits current reads and new-account inventory',()=>{
 const {items,game}=setup();items.accept(snap(2,1,{hero_golden_honey:{expires_at:9999999999999}}));items.clearEffects();game.gold='0';
 assert.equal(items.accept(snap(2,1,{hero_golden_honey:{expires_at:9999999999999}})),false);assert.equal(Object.keys(items.data.effects).length,0);assert.equal(game.gold,'0');
 assert.equal(items.accept(snap(2,1,{hero_golden_honey:{expires_at:9999999999999}}),false),false);
 assert.equal(items.accept(snap(2,1,{},'0'),false),true);assert.equal(items.accept(snap(3,0,{hero_golden_honey:{expires_at:9999999999999}},'0')),true);
 game.account='b';game.revision=0;assert.equal(items.accept(snap(0,5)),true);assert.equal(items.data.inventory.hero_golden_honey,5);
});
test('in-flight inventory read from before rebirth is invalidated when effects clear',async()=>{
 const {items,ctx}=setup();items.accept(snap(2,1,{hero_golden_honey:{expires_at:9999999999999}}));let release;
 ctx.WakppuAuth.invoke=()=>new Promise(resolve=>release=resolve);
 const pending=items.refresh();items.clearEffects();release(snap(2,1,{hero_golden_honey:{expires_at:9999999999999}}));await pending;
 assert.equal(Object.keys(items.data.effects).length,0);assert.equal(items.data.inventory.hero_golden_honey,1);
});
