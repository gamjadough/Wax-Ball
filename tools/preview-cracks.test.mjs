import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const game=readFileSync(new URL('../wakppuball/js/game.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const source=readFileSync(new URL('../wakppuball/js/preview-cracks.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const original=game.slice(game.indexOf('  function jaggedLine('),game.indexOf('    window.WakppuSkinEffects?.syncCracks'))+'  }';
function element(){return {attrs:{},style:{},children:[],setAttribute(k,v){this.attrs[k]=String(v);},removeAttribute(k){delete this.attrs[k];},appendChild(n){this.children.push(n);},append(n){this.children.push(n);},remove(){this.removed=true;},dataset:{}};}
function setup(){const c={window:{},document:{createElementNS:()=>element()},state:{cracks:[]},clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),mk:(tag,attrs)=>{const e=element();for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;}};vm.createContext(c);vm.runInContext(original+'\nwindow.live={design:designCracks,draw:drawCracks,update:updateCracks};',c);vm.runInContext(source,c);return c;}
const rng=seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};
test('preview uses unchanged live crack design/drawing and identical growth/width formulas',()=>{
 const c=setup(),live=c.window.live,preview=c.window.WakppuPreviewCracks;
 for(const name of ['design','draw'])assert.equal(preview[name].toString(),live[name].toString());
 assert.equal(preview.update.toString().replace('function updateCracks(cracks, v)','function updateCracks(v)').replace('cracks.forEach','state.cracks.forEach'),live.update.toString());
 for(const total of [1,20,100,500])for(let seed=0;seed<10;seed++){
  const a=live.design({cx:100,cy:100},total,rng(seed)),b=preview.design({cx:100,cy:100},total,rng(seed));assert.equal(JSON.stringify(a),JSON.stringify(b));
  const design={crack:{dark:'#112233',light:'#ddeeff'}};live.draw(element(),a,design);preview.draw(element(),b,design);
  c.state.cracks=a;
  for(const v of [0,.01,.1,.5,.9,1]){live.update(v);preview.update(b,v);assert.equal(JSON.stringify(a),JSON.stringify(b));}
 }
});
test('tier light follows exactly the live main cracks without adding alternate geometry',()=>{
 const c=setup();vm.runInContext(readFileSync(new URL('../wakppuball/js/pumpkin-skins.js',import.meta.url),'utf8'),c);
 const cracks=c.window.WakppuPreviewCracks.design({cx:100,cy:100},100,rng(9));c.window.WakppuPreviewCracks.draw(element(),cracks,{crack:{dark:'#111',light:'#fff'}});c.window.WakppuPreviewCracks.update(cracks,.75);
 for(const id of ['wisp','ghost','eclipse']){
  const layer=element(),svg={querySelector:()=>layer},ball={design:{pumpkinSkin:id}};
  c.window.WakppuPumpkinSkins.syncCracks({ball,svg,cracks,progress:.75,reduced:true});
  if(id==='wisp'){assert.equal(layer.children.length,0);continue;}
  const group=layer.children[0],main=cracks.filter(x=>x.weight===1);assert.equal(group.children.length,main.length*(id==='eclipse'?2:1));assert.equal(group.style.animation,'none');
  for(let i=0;i<group.children.length;i++){const cr=main[Math.floor(i/(id==='eclipse'?2:1))],n=group.children[i];assert.equal(n.attrs.d,cr.d);assert.equal(n.style.strokeDashoffset,cr.dark.style.strokeDashoffset);}
  c.window.WakppuPumpkinSkins.syncCracks({ball,svg,cracks,progress:0,reduced:true});assert.equal(group.style.opacity,'0');assert.equal(layer.children.length,1);
 }
});
