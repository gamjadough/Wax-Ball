import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createHash} from 'node:crypto';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('aura audio requires equipment, has a bounded voice/cooldown and stops on lifecycle changes',()=>{
 let now=1000,reduced=false,volume=.7;const calls=[],events={},docEvents={},styles={};let cancelled=0;
 const layer={setAttribute(){},animate(frames,options){calls.push(['animate',options.duration]);return {cancel(){cancelled++;}};}};
 const wrap={append(){},style:{setProperty(k,v){styles[k]=v;}}};
 const window={WakppuSettings:{effectVolume:()=>volume,reduced:()=>reduced},addEventListener(n,fn){events[n]=fn;}};
 const document={hidden:false,getElementById:()=>wrap,createElement:()=>layer,addEventListener(n,fn){docEvents[n]=fn;}};
 const c={window,document,performance:{now:()=>now},SoundManager:{init:n=>calls.push(['init',n]),stop:n=>calls.push(['stop',n]),play:(n,o)=>calls.push(['play',n,o])}};
 vm.runInNewContext(read('wakppuball/js/purchase-effects.js'),c);const fx=window.WakppuPurchaseEffects;
 const plays=()=>calls.filter(x=>x[0]==='play');fx.hit();assert.equal(plays().length,0);
 fx.spawn({id:'yellow',design:{colors:{light:'#fff0a3'}}});fx.setActive(true);assert.equal(styles['--aura-tint'],'#fff0a3');
 fx.hit();assert.equal(plays().length,1);assert.equal(plays()[0][2].volume,.13);
 now+=100;fx.hit();assert.equal(plays().length,1);now+=200;fx.hit();assert.equal(plays().length,2);
 fx.hit({final:true});assert.equal(plays().at(-1)[2].volume,.20);
 volume=0;now+=500;fx.hit();assert.equal(plays().length,3);
 reduced=true;volume=.7;now+=500;const animations=calls.filter(x=>x[0]==='animate').length;fx.hit();assert.equal(calls.filter(x=>x[0]==='animate').length,animations);
 fx.spawn({id:'blackhole'});assert.equal(styles['--aura-tint'],'#a9cfff');assert.ok(cancelled>0);
 fx.setActive(false);assert.equal(calls.at(-1)[0],'stop');now+=500;fx.hit();assert.equal(plays().length,4);
 fx.setActive(true);events.pagehide();assert.equal(calls.at(-1)[0],'stop');document.hidden=true;docEvents.visibilitychange();fx.hit();assert.equal(plays().length,4);
});
test('free chime includes provenance, a short bounded waveform and cache versions',()=>{
 const root=new URL('../wakppuball/sounds/starlight/',import.meta.url),meta=JSON.parse(fs.readFileSync(new URL('sources.json',root),'utf8')),bytes=fs.readFileSync(new URL(meta.output,root));
 assert.equal(meta.license,'CC0-1.0');assert.equal(meta.source_url,'https://kenney.nl/assets/impact-sounds');assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.sha256);
 assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.ok(meta.duration<=.65&&meta.peak<=.42);assert.ok(bytes.length<30000);
 const html=read('wakppuball/index.html');for(const f of ['purchase-effects','purchase-ui','game'])assert.ok(html.includes('js/'+f+'.js?v=20261019-starlight3'));
});
