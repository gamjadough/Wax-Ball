import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,statSync} from 'node:fs';import {createHash} from 'node:crypto';import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function fixture(){const c={window:{addEventListener(){}},document:{addEventListener(){}}};vm.createContext(c);for(const f of ['balls-data','material-sounds','skin-sounds','gem-ball-data','limited-data','sound'])vm.runInContext(read('wakppuball/js/'+f+'.js'),c);return c;}
test('grade sound families include simultaneous dimension honey/wax/butter; other wax, final and explicit special audio remain',()=>{
 const c=fixture(),balls=vm.runInContext('WAKPPU_BALLS',c),manifest=JSON.parse(read('wakppuball/sounds/materials/sources.json'));
 assert.equal(Object.keys(c.window.WakppuMaterialSounds).length,23);assert.equal(manifest.outputs.length,35);
 const paths=new Set();for(const b of balls){c.ball=b;const cfg=vm.runInContext('getSoundConfig(ball)',c);if(b.id==='yellow'){assert.equal(cfg.sequence.length,5);assert.equal(cfg.sequence[0],'yellow-crack-1.wav');continue;}
 for(const stage of ['early','mid','late','final']){assert.equal(cfg[stage][0],'materials/'+(b.grade==='과일'?'fruit-wax':b.grade==='간식'?'honey-wax':b.grade==='자연'?'ice-wax':b.grade==='보석'?'keycap':b.grade==='우주'?'honey-keycap':b.grade==='차원'?'honey-wax-butter':'wax')+'/'+stage+'.wav');paths.add(cfg[stage][0]);}assert.equal(cfg.pitch,1);assert.ok(cfg.pitchRandom<=.03);}
 assert.equal(paths.size,28);
 const original={admin:vm.runInContext('getSoundConfig(ADMIN_EVENT_BALL)',c),gem:vm.runInContext('getSoundConfig(window.WakppuGemBallData.ball)',c),pumpkin:vm.runInContext('getSoundConfig(window.WakppuLimitedData.ball)',c)};
 assert.equal(original.admin.final[0],'admin/collapse.wav');assert.equal(original.gem.final[0],'blue-crystal/break.wav');assert.equal(original.pumpkin.final[0],'pumpkin/break');
 for(const {id} of c.window.WakppuSkinSounds.profiles){c.ball={id:'eternity',skinId:id};const cfg=vm.runInContext('getSoundConfig(ball)',c);assert.ok(cfg.early[0].startsWith('eternity/'));}
 c.ball={id:'water',sound:{early:['custom/user.wav'],final:['custom/break.wav']}};assert.equal(vm.runInContext('getSoundConfig(ball).early[0]',c),'custom/user.wav');
});
test('shared wax clips are mono PCM, short, bounded and reproducible from unchanged yellow inputs',()=>{
 const m=JSON.parse(read('wakppuball/sounds/materials/sources.json')),hashes=new Set();let bytes=0;
 assert.equal(m.license,'Pixabay Content License + CC0-1.0');assert.equal(m.recordings[0].license,'CC0-1.0');assert.equal(m.recordings[0].author,'qubodup');assert.equal(m.recordings[1].author,'hello_world+123');assert.equal(m.recordings[1].license,'CC0-1.0');assert.equal(m.recordings[2].author,'Nox_Sound');assert.equal(m.recordings[2].license,'CC0-1.0');assert.equal(m.recordings[3].author,'StavSounds');assert.equal(m.recordings[3].samples.length,5);assert.equal(m.recordings[3].license,'CC0-1.0');assert.ok(read('wakppuball/sounds/materials/CREDITS.txt').includes('DRAGON-STUDIO'));assert.ok(read('wakppuball/index.html').includes('sounds/materials/CREDITS.txt'));assert.equal(m.shared_base_layer,true);assert.equal(m.pitch_shift,false);assert.equal(m.profiles.length,23);
 for(const [file,hash] of Object.entries(m.sources)){const raw=readFileSync(new URL('../'+file,import.meta.url));assert.equal(createHash('sha256').update(raw).digest('hex'),hash);}
 const c=fixture();const configs=Object.values(c.window.WakppuMaterialSounds);for(const [id,cfg] of Object.entries(c.window.WakppuMaterialSounds)){const folder=['strawberry','apple'].includes(id)?'fruit-wax':['chocolate','donut'].includes(id)?'honey-wax':['rainbow','water'].includes(id)?'ice-wax':['emerald','diamond'].includes(id)?'keycap':['planet','sun'].includes(id)?'honey-keycap':['blackhole','whitehole'].includes(id)?'honey-wax-butter':'wax';assert.deepEqual(Array.from(cfg.early),['materials/'+folder+'/early.wav','materials/'+folder+'/tap.wav']);assert.deepEqual(Array.from(cfg.final),['materials/'+folder+'/final.wav']);assert.equal(cfg.sequence,undefined);assert.equal(cfg.pitch,1);assert.equal(cfg.pitchRandom,0);}
 assert.equal(new Set(configs.map(x=>JSON.stringify(x))).size,7);

 for(const output of m.outputs){const b=readFileSync(new URL('../wakppuball/sounds/materials/'+output.file,import.meta.url));bytes+=b.length;
 assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.readUInt16LE(22),1);assert.equal(b.readUInt32LE(24),22050);assert.equal(b.readUInt16LE(34),16);assert.equal(b.readUInt32LE(40),b.length-44);
 assert.equal(createHash('sha256').update(b).digest('hex'),output.sha256);hashes.add(output.sha256);
 let peak=0,sum=0;for(let i=44;i<b.length;i+=2){const x=b.readInt16LE(i)/32768;peak=Math.max(peak,Math.abs(x));sum+=x*x;}
 assert.ok(peak<=.60&&peak>=.30);assert.ok(Math.sqrt(sum/((b.length-44)/2))>.015);assert.ok(output.seconds>=.1&&output.seconds<=1.05);
 }assert.equal(hashes.size,35);assert.ok(bytes<530000);
 const html=read('wakppuball/index.html');assert.ok(html.indexOf('js/material-sounds.js')<html.indexOf('js/sound.js'));
});

test('dimension, snack and space layers overlap the initial hit and add no trailing audio',()=>{
 const pcm=file=>{const b=readFileSync(new URL('../wakppuball/sounds/materials/'+file,import.meta.url));return Array.from({length:(b.length-44)/2},(_,i)=>b.readInt16LE(44+i*2)/32768);};
 for(const [mix,dry] of [['honey-wax','wax'],['honey-keycap','keycap'],['honey-wax-butter','wax']])for(const phase of ['early','tap','mid','late','final']){
  const a=pcm(mix+'/'+phase+'.wav'),b=pcm(dry+'/'+phase+'.wav');assert.equal(a.length,b.length,'no extra honey-only tail: '+mix+'/'+phase);
  // A gain-only copy has zero residual. Require additional texture within 5–35 ms of the first click.
  const start=Math.round(.005*22050),end=Math.round(.035*22050);let dot=0,energy=0;
  for(let i=start;i<end;i++){dot+=a[i]*b[i];energy+=b[i]*b[i];}const gain=dot/Math.max(energy,1e-12);let residual=0;
  for(let i=start;i<end;i++)residual+=(a[i]-gain*b[i])**2;
  assert.ok(Math.sqrt(residual/(end-start))>.0005,'honey is present during attack: '+mix+'/'+phase);
 }
});
