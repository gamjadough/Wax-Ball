import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
const source=readFileSync(new URL('../wakppuball/js/pumpkin-skins.js',import.meta.url),'utf8');
function setup(id='wisp',options={}){
 const timers=new Map(),nodes=[],animations=[];let next=0,paid=0,spawned=0,valid=true;
 const element=()=>({style:{},dataset:{},setAttribute(){},querySelector(){return null;},remove(){this.removed=true;},animate(frames,opts){const a={frames,opts,cancel(){this.cancelled=true;}};animations.push(a);return a;}});
 const themes=[];const context={window:{WakppuHalloweenEffects:{startScare(o){themes.push(o.theme);return null;}}},document:{createElement:element},matchMedia:()=>({matches:options.compact??true}),setTimeout:(fn,at)=>{timers.set(++next,{fn,at});return next;},clearTimeout:id=>timers.delete(id)};
 vm.createContext(context);vm.runInContext(readFileSync(new URL('../wakppuball/js/eclipse-pumpkin.js',import.meta.url),'utf8'),context);vm.runInContext(readFileSync(new URL('../wakppuball/js/pumpkin-skin-art.js',import.meta.url),'utf8'),context);vm.runInContext(source,context);const skins=context.window.WakppuPumpkinSkins;
 const base={id:skins.ballId,clicks:100,reward:1500000000,design:{art:'pumpkin'},sound:{volume:.5}};
 const ball=skins.appearance(base,id),svg=element();
 const run=()=>skins.play({ball,svg,effects:{append:n=>nodes.push(n)},center:{x:100,y:100},radius:100,valid:()=>valid,reward:()=>paid++,respawn:()=>spawned++,...options});
 const until=time=>{for(const [key,t] of [...timers].sort((a,b)=>a[1].at-b[1].at))if(t.at<=time&&timers.has(key)){timers.delete(key);t.fn();}};
 return {skins,base,ball,nodes,animations,timers,themes,run,until,invalidate(){valid=false;},get paid(){return paid;},get spawned(){return spawned;}};
}
test('three cosmetic profiles preserve original stats and use existing audio with distinct SVG motifs',()=>{
 const x=setup();assert.equal(x.skins.profiles.length,3);
 for(const p of x.skins.profiles){
  const b=x.skins.appearance(x.base,p.id);assert.equal(b.clicks,100);assert.equal(b.reward,1500000000);assert.equal(b.id,x.base.id);
  assert.equal(x.base.design.art,'pumpkin');assert.equal(x.base.skinId,undefined);assert.equal(b.design.gloss,p.id!=='eclipse');
  assert.match(x.skins.art('quality',b).art,/data-wax-material="polished"/);
  assert.match(x.skins.art('quality',b).defs,/carved-face/);
  assert.match(x.skins.art('unique-'+p.id,b).art,new RegExp('data-pumpkin-skin="'+p.id+'"'));
  assert.match(x.skins.art('unique-'+p.id,b).defs,new RegExp('unique-'+p.id+'-pumpkin-body'));
  for(const sound of p.sounds){assert.match(sound,/^pumpkin-skins\//);assert.ok(existsSync(new URL('../wakppuball/sounds/'+sound,import.meta.url)),sound);}
 }
 assert.equal(x.skins.appearance(x.base,'missing'),x.base);
 const other={...x.base,id:'eternity'};assert.equal(x.skins.appearance(other,'wisp'),other);
 const html=readFileSync(new URL('../wakppuball/index.html',import.meta.url),'utf8');
 for(const file of ['eclipse-pumpkin.js','pumpkin-skin-art.js','pumpkin-skins.js','pumpkin-skins-ui.js'])assert.ok(html.includes('js/'+file+'?v='+(file==='pumpkin-skins-ui.js'?'20261025-shop-tabs1':file==='pumpkin-skins.js'?'20261021-halloweenshop1':'20261020-pumpkin-skins1')));
 assert.ok(html.includes('pumpkin-skins.css?v=20261020-pumpkin-skins1'));assert.doesNotMatch(html,/preview-cracks|local-pumpkin-skins/);
});
test('all tiers preserve callback timing, respect reduced motion and clean every particle',()=>{
 for(const id of ['wisp','ghost','eclipse'])for(const speed of [1,2.5])for(const reduced of [false,true])for(const compact of [false,true]){
  const x=setup(id,{speed,respawnSpeed:4,reduced,compact});x.run();assert.deepEqual(x.themes,[id]);const reward=(reduced?250:450)/speed,end=(reduced?550:1300)/speed+250;
  const extras={wisp:0,ghost:1,eclipse:3};
  assert.equal(x.nodes.length,reduced?0:x.skins.tiers[id][compact?'compact':'full']+extras[id]);
  if(id==='eclipse'&&!reduced){assert.ok(x.nodes.some(n=>n.className.includes('eclipse-umbra')));assert.ok(x.nodes.some(n=>n.className.includes('eclipse-corona')));assert.equal(x.nodes.filter(n=>n.className.includes('eclipse-shell-sector')).length,compact?6:10);assert.ok(!x.animations[0].frames.some(f=>f.transform));}
  x.until(reward-.01);assert.equal(x.paid,0);x.until(reward);assert.equal(x.paid,1);assert.equal(x.spawned,0);
  x.until(end);assert.equal(x.spawned,1);assert.equal(x.paid,1);assert.equal(x.timers.size,0);assert.ok(x.nodes.every(n=>n.removed));assert.ok(x.animations.every(a=>a.cancelled));
 }
});
test('cancellation and invalidated lifecycle cannot grant or respawn',()=>{
 for(const id of ['wisp','ghost','eclipse'])for(const invalidate of [false,true]){
  const x=setup(id),run=x.run();if(invalidate)x.invalidate();else{run.cancel();run.cancel();}
  x.until(Infinity);assert.equal(x.paid,0);assert.equal(x.spawned,0);assert.ok(x.nodes.every(n=>n.removed));assert.equal(x.timers.size,0);
 }
});
