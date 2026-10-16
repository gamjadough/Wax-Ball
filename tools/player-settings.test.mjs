import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const settingsSource=readFileSync(new URL('../wakppuball/js/player-settings.js',import.meta.url),'utf8');
const audioSource=readFileSync(new URL('../wakppuball/js/sound.js',import.meta.url),'utf8');
const key='wakppuball:player-settings:v1';
function fixture(saved=null,{denied=false,audio=true}={}){
 const listeners=new Map(),nodes=new Map(),storage=new Map(saved===null?[]:[[key,saved]]),timers=new Map(),contexts=[],audios=[];
 function target(){return {hidden:false,addEventListener(){},focus(){},querySelectorAll(){return [];},getClientRects(){return [1];},classList:{toggle(){}}};}
 const node=selector=>{if(!nodes.has(selector))nodes.set(selector,target());return nodes.get(selector);};
 const classes=new Set();
 const document={hidden:false,body:{append(){}},querySelector:node,documentElement:{classList:{toggle(name,on){on?classes.add(name):classes.delete(name);}}},addEventListener(name,fn){listeners.set('document:'+name,fn);}};
 const system={matches:false,addEventListener(name,fn){this.changed=fn;}};
 class Param{value=0;setValueAtTime(v){this.value=v;}exponentialRampToValueAtTime(v){this.value=v;}}
 class AudioNode{gain=new Param();frequency=new Param();Q=new Param();connect(dest){this.connected=dest;}disconnect(){this.connected=null;}start(){this.started=true;}stop(time){if(time===undefined){this.stopped=true;this.onended?.();}}}
 class AudioContext{
  state='running';currentTime=0;sampleRate=100;destination={};gains=[];oscillators=[];
  constructor(){contexts.push(this);}createGain(){const n=new AudioNode();this.gains.push(n);return n;}
  createOscillator(){const n=new AudioNode();this.oscillators.push(n);return n;}
  createBuffer(){return {getChannelData:()=>new Float32Array(100)};}createBufferSource(){return new AudioNode();}createBiquadFilter(){return new AudioNode();}
  createMediaElementSource(){return new AudioNode();}
  resume(){this.state='running';return Promise.resolve();}
 }
 class Audio{events={};volume=1;paused=true;constructor(src=''){this.src=src;audios.push(this);}addEventListener(n,fn){this.events[n]=fn;}pause(){this.playing=false;this.paused=true;}play(){this.playing=true;this.paused=false;return Promise.resolve();}}
 let timerId=0;
 const context={document,matchMedia:()=>system,Audio,AudioContext:audio?AudioContext:undefined,
  localStorage:{getItem(k){if(denied)throw Error('blocked');return storage.get(k)||null;},setItem(k,v){if(denied)throw Error('blocked');storage.set(k,v);}},
  CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},Event:class{constructor(type){this.type=type;}},
  addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(fn);},
  dispatchEvent(event){for(const fn of listeners.get(event.type)||[])fn(event);},
  setInterval(fn){timers.set(++timerId,fn);return timerId;},clearInterval(id){timers.delete(id);},
  SOUND_SETTINGS:{folder:'sounds/',extension:'.mp3',poolSize:4,usePlaceholderSound:true}};
 context.window=context;vm.createContext(context);vm.runInContext(settingsSource,context);vm.runInContext(audioSource+';globalThis.sound=SoundManager;',context);
 return {context,settings:context.WakppuSettings,sound:context.sound,storage,timers,contexts,audios,nodes,classes,system,bgm:()=>audios.find(a=>a.src==='sounds/halloween-waltz.mp3'),
  event(type){context.dispatchEvent({type});},visibility(hidden){document.hidden=hidden;listeners.get('document:visibilitychange')();}};
}
test('defaults, malformed saved data, safe bounds, storage failures and cross-tab updates',()=>{
 for(const raw of [null,'broken','[]','{"muted":"yes","sfxVolume":"100"}']){
  const f=fixture(raw);assert.equal(f.settings.read().music,false);assert.equal(f.settings.effectVolume(),.7);
 }
 const f=fixture();f.settings.set({music:true,musicVolume:150,sfxVolume:-5,muted:'invalid',unknown:true});
 assert.equal(f.settings.musicVolume(),1);assert.equal(f.settings.effectVolume(),0);assert.equal(f.settings.read().muted,false);
 assert.equal(Object.hasOwn(JSON.parse(f.storage.get(key)),'unknown'),false);
 f.storage.set(key,'{"muted":true,"reduceEffects":true}');f.context.dispatchEvent({type:'storage',key});
 assert.equal(f.settings.effectVolume(),0);assert.ok(f.classes.has('reduced-effects'));
 f.system.matches=true;f.settings.set({reduceEffects:false});assert.equal(f.settings.reduced(),true);
 const blocked=fixture(null,{denied:true});assert.doesNotThrow(()=>blocked.settings.set({music:true}));
 assert.equal(blocked.settings.read().music,true);assert.ok(blocked.nodes.get('#settingsStorageStatus').textContent);
 const unsupported=fixture(null,{audio:false});assert.doesNotThrow(()=>unsupported.sound.unlock());
 unsupported.settings.set({music:true});unsupported.sound.unlock();assert.equal(unsupported.bgm().paused,false);
});
test('music is opt-in and waits for interaction; independent volumes and immediate pooled/synth mute',()=>{
 const f=fixture();f.settings.set({music:true,musicVolume:30});assert.equal(f.contexts.length,0);assert.equal(f.timers.size,0);
 f.sound.unlock();assert.equal(f.contexts.length,1);assert.equal(f.bgm().paused,false);
 const ac=f.contexts[0];assert.equal(ac.gains[0].gain.value,.7);assert.equal(ac.gains[1].gain.value,.3);
 assert.equal(f.bgm().loop,true);
 f.sound.init(['tap1']);const tap=f.audios.find(a=>a.src==='sounds/tap1.mp3');tap.events.canplay();f.sound.play('tap1',{pitch:1,pitchRandom:0,volume:.5,volumeRandom:0});
 assert.equal(tap.volume,.35);assert.equal(tap.playing,true);
 f.settings.set({sfxVolume:20});assert.equal(tap.volume,.1);assert.equal(ac.gains[0].gain.value,.2);assert.equal(ac.gains[1].gain.value,.3);
 f.sound.play('tap2',{pitch:1,pitchRandom:0,volume:1,volumeRandom:0});assert.ok(ac.gains.some(n=>n.connected===ac.gains[0]));
 f.settings.set({muted:true});assert.equal(f.bgm().paused,true);assert.equal(ac.gains[0].gain.value,0);assert.equal(ac.gains[1].gain.value,0);assert.equal(tap.playing,false);
 const count=ac.oscillators.length;f.sound.play('tap2',{pitch:1,pitchRandom:0,volume:1,volumeRandom:0});assert.equal(ac.oscillators.length,count);
 f.settings.set({muted:false});assert.equal(f.bgm().paused,false);assert.equal(f.settings.read().music,true);
});
test('hidden tabs, sleep lock, page lifecycle and rapid toggles pause a single music player',()=>{
 const f=fixture();f.settings.set({music:true});f.sound.unlock();
 f.visibility(true);assert.equal(f.bgm().paused,true);
 f.visibility(false);assert.equal(f.bgm().paused,false);
 f.context.wakppuServerBlocked=true;f.event('wakppu-access-changed');assert.equal(f.bgm().paused,true);
 f.context.wakppuServerBlocked=false;f.event('wakppu-access-changed');assert.equal(f.bgm().paused,false);
 f.event('pagehide');assert.equal(f.bgm().paused,true);f.event('pageshow');assert.equal(f.bgm().paused,false);
 for(let i=0;i<40;i++){f.settings.set({music:false});assert.equal(f.bgm().paused,true);f.settings.set({music:true});assert.equal(f.bgm().paused,false);}
 assert.equal(f.audios.filter(a=>a.id==='backgroundMusic').length,1);
 f.settings.set({musicVolume:0});assert.equal(f.bgm().paused,true);
});
