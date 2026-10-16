import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const context={window:{}};
vm.runInNewContext(readFileSync(new URL('../wakppuball/js/halloween-effects.js',import.meta.url),'utf8'),context);
test('exact 30% threshold and all three uniformly selected images',()=>{
 const choose=context.window.WakppuHalloweenEffects.chooseScare;
 let count=0;
 for(let i=0;i<100;i++){let calls=0;const result=choose(()=>calls++?0:i/100);if(result!==null)count++;}
 assert.equal(count,30);
 for(const [roll,expected] of [[0,0],[.33334,1],[.66667,2],[.99999,2]]){let calls=0;assert.equal(choose(()=>calls++?roll:.29999),expected);}
 assert.equal(choose(()=>.3),null);assert.equal(choose(()=>1),null);
});
