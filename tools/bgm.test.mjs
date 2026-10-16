import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../wakppuball/js/sound.js',import.meta.url),'utf8');
function setup(){
 const players=[];let reject=false;
 class Audio {constructor(src){this.src=src;this.paused=true;this.calls=0;players.push(this);}play(){this.calls++;if(reject)return Promise.reject(new Error('blocked'));this.paused=false;return Promise.resolve();}}
 const ctx={Audio,window:{},document:{body:{append(){}}},SOUND_SETTINGS:{usePlaceholderSound:false}};
 vm.createContext(ctx);vm.runInContext(source+';globalThis.manager=SoundManager;',ctx);
 return {players,manager:ctx.manager,ctx,block:v=>reject=v};
}
test('BGM waits for interaction, loops once and is independent of placeholder effects',async()=>{
 const {players,manager}=setup();assert.equal(players.length,0);
 manager.unlock();manager.unlock();await new Promise(setImmediate);
 assert.equal(players.length,1);assert.equal(players[0].calls,1);
 assert.equal(players[0].loop,true);assert.equal(players[0].volume,.3);
 manager.unlock();assert.equal(players[0].calls,1);
});
test('blocked playback is caught and retried on next gesture without another player',async()=>{
 const {players,manager,block}=setup();block(true);manager.unlock();await new Promise(setImmediate);
 assert.equal(players[0].paused,true);block(false);manager.unlock();await new Promise(setImmediate);
 assert.equal(players.length,1);assert.equal(players[0].calls,2);assert.equal(players[0].paused,false);
});
test('local preview does not create or play BGM',()=>{
 const {players,manager,ctx}=setup();ctx.window.WakppuAuth={local:true};manager.unlock();assert.equal(players.length,0);
});
