import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../wakppuball/js/transcendent-effects.js',import.meta.url),'utf8');
function setup(rank,{speed=1,respawnSpeed=1,reduced=false}={}){
 const timers=new Map(),nodes=[],anims=[],events=[];let id=0,paid=0,spawned=0,valid=true;
 const element=()=>({style:{},dataset:{},setAttribute(){},remove(){this.removed=true;},animate(frames,options){const a={frames,options,cancel(){this.cancelled=true;}};anims.push(a);return a;}});
 const svg=element(),wrap={dataset:{},dispatchEvent:e=>events.push(e.detail)};
 const c={window:{},document:{createElement:element},matchMedia:q=>({matches:q.includes('reduced')?reduced:true}),CustomEvent:class{constructor(type,options){this.detail=options.detail;}},setTimeout:(fn,at)=>{timers.set(++id,{fn,at});return id;},clearTimeout:id=>timers.delete(id)};
 vm.createContext(c);vm.runInContext(source,c);
 const effect=c.window.WakppuTranscendent.play({ball:{id:'eternity',design:{motif:'eternity',skin:rank}},wrap,svg,effects:{append:n=>nodes.push(n)},center:{x:100,y:100},radius:80,speed,respawnSpeed,valid:()=>valid,reward:()=>paid++,respawn:()=>spawned++});
 function until(time=Infinity){for(const [key,t] of [...timers].sort((a,b)=>a[1].at-b[1].at)){if(t.at<=time&&timers.has(key)){timers.delete(key);t.fn();}}}
 return {timers,nodes,anims,events,svg,wrap,effect,until,invalidate(){valid=false;},get paid(){return paid;},get spawned(){return spawned;}};
}
test('skin tiers have different motion but identical reward/respawn deadlines, including heart speed and reduced motion',()=>{
 const kinds={common:'convergence',rare:'ice',hero:'flames',legendary:'time',transcendent:'void'};
 for(const speed of [1,2.5])for(const reduced of [false,true])for(const [rank,kind] of Object.entries(kinds)){
  const x=setup(rank,{speed,respawnSpeed:4,reduced});const duration=(reduced?650:2100)/speed;
  assert.equal(x.events[0].kind,kind);assert.ok([...x.timers.values()].some(t=>Math.abs(t.at-(duration+250))<.001));
  x.until(duration*.61);assert.equal(x.paid,0);assert.equal(x.spawned,0);
  if(rank!=='common')assert.ok(x.nodes.length<=(reduced?5:18));
  x.until(duration*.63);assert.equal(x.paid,1);assert.equal(x.spawned,0);
  x.until();assert.equal(x.paid,1);assert.equal(x.spawned,1);assert.ok(x.nodes.every(n=>n.removed));assert.equal(x.svg.style.opacity,'');
 }
});
test('changing skin or invalidating a run cancels effects and prevents stale rewards/respawns',()=>{
 for(const rank of ['common','rare','hero','legendary','transcendent']){
  const x=setup(rank);x.until(600);x.effect.cancel();x.until();assert.equal(x.paid,0);assert.equal(x.spawned,0);assert.ok(x.nodes.every(n=>n.removed));
  const y=setup(rank);y.invalidate();y.until();assert.equal(y.paid,0);assert.equal(y.spawned,0);
 }
});
test('legendary freezes then rewinds, transcendent folds space',()=>{
 const time=setup('legendary');time.until();const phases=time.events.map(e=>e.phase);assert.ok(phases.indexOf('freeze')<phases.indexOf('rewind'));assert.ok(phases.includes('rewind'));
 const freeze=time.anims.find(a=>a.frames.length===5);assert.ok(freeze);assert.equal(freeze.frames[1].transform,freeze.frames[2].transform);
 const space=setup('transcendent');space.until();assert.ok(space.events.some(e=>e.phase==='fold'));assert.ok(space.anims[0].frames[1].transform.includes('scale(.18)'));
});
