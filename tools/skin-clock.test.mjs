import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
function setup(){const c={window:{},document:{addEventListener(){}}};vm.createContext(c);vm.runInContext(readFileSync(new URL('../wakppuball/js/skin-clock.js',import.meta.url),'utf8'),c);return c.window.WakppuSkinClock;}
test('KST hand angles include minute/second offsets and midnight rollover',()=>{
 const clock=setup();
 for(const [utc,hour,minute] of [['2026-10-15T18:25:30Z',102.75,153],['2026-10-15T15:00:00Z',0,0],['2026-10-16T00:00:00Z',270,0],['2026-10-16T03:30:00Z',15,180]]){
  const result=clock.angles(Date.parse(utc));assert.equal(result.hour,hour);assert.equal(result.minute,minute);
 }
});
test('both hands update on the same SVG without rebuilding artwork',()=>{
 const clock=setup(),hands=['hour','minute'].map(name=>({dataset:{clockHand:name},setAttribute(k,v){this[k]=v;}})),root={querySelectorAll:()=>hands};
 clock.update(root,Date.parse('2026-10-15T18:25:30Z'));assert.equal(hands[0].transform,'rotate(102.75 100 100)');assert.equal(hands[1].transform,'rotate(153 100 100)');
 clock.update(root,Date.parse('2026-10-15T18:26:30Z'));assert.equal(hands[0].transform,'rotate(103.25 100 100)');assert.equal(hands[1].transform,'rotate(159 100 100)');
});
