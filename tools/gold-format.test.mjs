import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../wakppuball/js/gold-format.js';
const {integer,compact}=globalThis.WakppuGold;
test('K/M/B/T and integer-safe boundaries',()=>{
  assert.equal(compact('0'),'0');assert.equal(compact('999'),'999');
  assert.equal(compact('1000'),'1K');assert.equal(compact('1500000'),'1.5M');assert.equal(compact('1000000000'),'1B');
  assert.equal(compact('1000000000000'),'1T');assert.equal(compact('9007199254740993'),'9007.2T');
  assert.equal(integer('9007199254740993')+1n,9007199254740994n);
  assert.equal(integer('9223372036854775807').toString(),'9223372036854775807');
  assert.equal(compact('9223372036854775807'),'9223372T');
  assert.equal(JSON.parse(JSON.stringify({gold:integer('9007199254740993').toString()})).gold,'9007199254740993');
  assert.equal(compact('bad'),'—');
});
