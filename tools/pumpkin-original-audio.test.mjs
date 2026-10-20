import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
test('12 original gourd sounds are unique bounded PCM without reused eternity assets',()=>{
 const hashes=new Set();let total=0;
 for(const kind of ['wisp','ghost','eclipse'])for(const stage of ['early','mid','late','final']){
  const b=readFileSync(new URL('../wakppuball/sounds/pumpkin-skins/'+kind+'-'+stage+'.wav',import.meta.url));total+=b.length;
  assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WAVE');assert.equal(b.readUInt16LE(22),1);assert.equal(b.readUInt32LE(24),24000);assert.equal(b.readUInt16LE(34),16);
  let peak=0,sum=0,energy=0;for(let i=44;i<b.length;i+=2){const n=b.readInt16LE(i)/32768;peak=Math.max(peak,Math.abs(n));sum+=n;energy+=n*n;}
  const samples=(b.length-44)/2;assert.ok(samples/24000<=1.31);assert.ok(peak<=.561&&peak>.4);assert.ok(Math.sqrt(energy/samples)>.008);assert.ok(Math.abs(sum/samples)<.004);assert.equal(b.readInt16LE(b.length-2),0);
  hashes.add(createHash('sha256').update(b).digest('hex'));
 }
 assert.equal(hashes.size,12);assert.ok(total<350000);
 const config=readFileSync(new URL('../wakppuball/js/pumpkin-skins.js',import.meta.url),'utf8');assert.doesNotMatch(config,/sounds:\['eternity\//);
});
