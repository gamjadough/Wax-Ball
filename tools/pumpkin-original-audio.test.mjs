import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
test('approved eclipse sounds remain byte-identical',()=>{
 const expected={early:'5baa9c7c057812d90fe5f391da2bf636e0209ce6e546769a8b5eabd9ee0f247c',mid:'ac448d32c9b8c9d820195a2020fbd8d27381ef5ea0da40145b9c5c00ebce68e5',late:'3a2d64e3352cd891163db66ce276d9ea96888ccbe8083a4fa53c3d28b18c58ad',final:'e4a54a525815c29b5121ba48d3b634d2eb276a9ef49b043323d32af9f478af1c'};
 for(const [stage,hash]of Object.entries(expected)){const b=readFileSync(new URL('../wakppuball/sounds/pumpkin-skins/eclipse-'+stage+'.wav',import.meta.url));assert.equal(createHash('sha256').update(b).digest('hex'),hash);}
});
test('wisp is a bright transient while ghost is a soft sustained breath, not pitch variants',()=>{
 function signature(kind){const b=readFileSync(new URL('../wakppuball/sounds/pumpkin-skins/'+kind+'-early.wav',import.meta.url));let crossings=0,last=0,energy=0,tail=0;const count=(b.length-44)/2;for(let i=0;i<count;i++){const x=b.readInt16LE(44+i*2);if(i&&x*last<0)crossings++;last=x;energy+=x*x;if(i>count/2)tail+=x*x;}return {zcr:crossings/count,tail:tail/energy};}
 const wisp=signature('wisp'),ghost=signature('ghost');assert.ok(wisp.zcr>.3);assert.ok(ghost.zcr<.08);assert.ok(wisp.zcr>ghost.zcr*8);assert.ok(wisp.tail<.06);assert.ok(ghost.tail>.25);
});
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
