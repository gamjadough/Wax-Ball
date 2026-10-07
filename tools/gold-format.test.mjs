import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../wakppuball/js/gold-format.js';
const {integer,compact}=globalThis.WakppuGold;
test('K/M/B/T/Qa/Qi and integer-safe boundaries',()=>{
  assert.equal(compact('0'),'0');assert.equal(compact('999'),'999');
  assert.equal(compact('1000'),'1K');assert.equal(compact('1500000'),'1.5M');assert.equal(compact('1000000000'),'1B');
  assert.equal(compact('1000000000000'),'1T');assert.equal(compact('9007199254740993'),'9Qa');
  assert.equal(compact('10000000000000000'),'10Qa');
  assert.equal(integer('9007199254740993')+1n,9007199254740994n);
  assert.equal(integer('9223372036854775807').toString(),'9223372036854775807');
  assert.equal(compact('9223372036854775807'),'9.2Qi');
  assert.equal(JSON.parse(JSON.stringify({gold:integer('9007199254740993').toString()})).gold,'9007199254740993');
  assert.equal(compact('bad'),'—');
});
test('units beyond Ud and scientific fallback remain exact for BigInt and saved strings',()=>{
  const units=[[39,'Dd'],[42,'Td'],[45,'Qad'],[48,'Qid'],[51,'Sxd'],[54,'Spd'],[57,'Ocd'],[60,'Nod'],[63,'Vg'],[66,'Uvg'],[69,'Dvg'],[72,'Tvg'],[75,'Qavg'],[78,'Qivg'],[81,'Sxvg'],[84,'Spvg'],[87,'Ocvg'],[90,'Novg'],[93,'Tg']];
  for(const [exponent,suffix] of units){
    const base=10n**BigInt(exponent);
    assert.equal(compact(base),`1${suffix}`);
    assert.equal(compact((base*123n/100n).toString()),`1.2${suffix}`);
    assert.equal(compact(base-1n),`1${suffix}`);
  }
  assert.equal(compact(999949n*10n**33n),'999.9Ud');
  assert.equal(compact(999950n*10n**33n),'1Dd');
  assert.equal(compact(10n**96n),'1UTg');
  assert.equal(compact(10n**100n-1n),'10DTg');
  assert.equal(compact(123n*10n**118n),'1.2NoTg');
});
test('named units through centillion and 1000-digit scientific fallback',()=>{
 const checkpoints=[[123,'Qag'],[153,'Qig'],[156,'UQig'],[183,'Sxg'],[213,'Spg'],[243,'Ocg'],[273,'Nog'],[300,'NoNog'],[303,'Ce']];
 for(const [exponent,suffix] of checkpoints){const base=10n**BigInt(exponent);assert.equal(compact(base),`1${suffix}`);assert.equal(compact(base-1n),`1${suffix}`);}
 assert.equal(compact(10n**306n),'1e306');assert.equal(compact(10n**1000n-1n),'1e1000');
});
