import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,statSync} from 'node:fs';import {createHash} from 'node:crypto';import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function fixture(){const c={window:{addEventListener(){}},document:{addEventListener(){}}};vm.createContext(c);for(const f of ['balls-data','material-sounds','skin-sounds','gem-ball-data','limited-data','sound'])vm.runInContext(read('wakppuball/js/'+f+'.js'),c);return c;}
test('every ordinary ball without explicit audio has distinct four-stage material sounds; existing special audio wins',()=>{
 const c=fixture(),balls=vm.runInContext('WAKPPU_BALLS',c),manifest=JSON.parse(read('wakppuball/sounds/materials/sources.json'));
 assert.equal(Object.keys(c.window.WakppuMaterialSounds).length,23);assert.equal(manifest.outputs.length,92);
 const paths=new Set();for(const b of balls){c.ball=b;const cfg=vm.runInContext('getSoundConfig(ball)',c);if(b.id==='yellow'){assert.equal(cfg.sequence.length,5);assert.equal(cfg.sequence[0],'yellow-crack-1.wav');continue;}
 for(const stage of ['early','mid','late','final']){assert.equal(cfg[stage][0],'materials/'+b.id+'/'+stage+'.wav');paths.add(cfg[stage][0]);}assert.equal(cfg.pitch,1);assert.ok(cfg.pitchRandom<=.03);}
 assert.equal(paths.size,92);
 const original={admin:vm.runInContext('getSoundConfig(ADMIN_EVENT_BALL)',c),gem:vm.runInContext('getSoundConfig(window.WakppuGemBallData.ball)',c),pumpkin:vm.runInContext('getSoundConfig(window.WakppuLimitedData.ball)',c)};
 assert.equal(original.admin.final[0],'admin/collapse.wav');assert.equal(original.gem.final[0],'blue-crystal/break.wav');assert.equal(original.pumpkin.final[0],'pumpkin/break');
 for(const {id} of c.window.WakppuSkinSounds.profiles){c.ball={id:'eternity',skinId:id};const cfg=vm.runInContext('getSoundConfig(ball)',c);assert.ok(cfg.early[0].startsWith('eternity/'));}
 c.ball={id:'water',sound:{early:['custom/user.wav'],final:['custom/break.wav']}};assert.equal(vm.runInContext('getSoundConfig(ball).early[0]',c),'custom/user.wav');
});
test('generated foley is original mono PCM, unique, short, bounded and checksum verified',()=>{
 const m=JSON.parse(read('wakppuball/sounds/materials/sources.json')),hashes=new Set();let bytes=0;
 assert.match(m.license,/CC-BY-4.0/);assert.equal(m.recordings.length,3);assert.ok(read('wakppuball/sounds/materials/CREDITS.txt').includes('orginaljun.deviantart.com'));assert.ok(read('wakppuball/index.html').includes('sounds/materials/CREDITS.txt'));assert.equal(m.shared_base_layer,false);assert.equal(m.pitch_shift,false);assert.equal(new Set(Object.values(m.profiles).map(p=>p[1])).size,23);
 for(const source of Object.values(m.sources)){const raw=readFileSync(new URL('../tools/audio-sources/materials/'+source.file,import.meta.url));assert.equal(createHash('sha256').update(raw).digest('hex'),source.sha256);}
 assert.ok(new Set(m.outputs.map(o=>o.seconds)).size>15);

 for(const output of m.outputs){const b=readFileSync(new URL('../wakppuball/sounds/materials/'+output.file,import.meta.url));bytes+=b.length;
 assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.readUInt16LE(22),1);assert.equal(b.readUInt32LE(24),22050);assert.equal(b.readUInt16LE(34),16);assert.equal(b.readUInt32LE(40),b.length-44);
 assert.equal(createHash('sha256').update(b).digest('hex'),output.sha256);hashes.add(output.sha256);
 let peak=0,sum=0;for(let i=44;i<b.length;i+=2){const x=b.readInt16LE(i)/32768;peak=Math.max(peak,Math.abs(x));sum+=x*x;}
 assert.ok(peak<=.60&&peak>=.30);assert.ok(Math.sqrt(sum/((b.length-44)/2))>.015);assert.ok(output.seconds>=.1&&output.seconds<=1.05);
 }assert.equal(hashes.size,92);assert.ok(bytes<2200000);
 const html=read('wakppuball/index.html');assert.ok(html.indexOf('js/material-sounds.js')<html.indexOf('js/sound.js'));
});
