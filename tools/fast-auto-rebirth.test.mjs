import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const scheduler=readFileSync(new URL('../wakppuball/js/auto-rebirth.js',import.meta.url),'utf8');
const game=readFileSync(new URL('../wakppuball/js/game.js',import.meta.url),'utf8');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function schedulerFixture(){
 const nodes=new Map(),events={},timers=new Map(),intervals=[];let account='a',ready=false,enabled=true,now=10000,calls=0,run=async()=>true,id=0;
 function node(){return {hidden:false,textContent:'',setAttribute(){},append(){},before(){},after(){}};}
 const get=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
 const document={hidden:false,getElementById:get,createElement:node,addEventListener:(id,fn)=>events[id]=fn};
 const window={addEventListener:(id,fn)=>events[id]=fn,WakppuAutoRebirthGame:{ready:()=>ready,run:()=>{calls++;return run();}}};
 const c={window,document,WakppuItemGame:{read:()=>({account,ready:true})},WakppuAuth:{invoke:async()=>({owned:true,enabled})},confirm:()=>true,Date:class extends Date{static now(){return now;}},setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),setInterval:(fn,ms)=>intervals.push({fn,ms})};
 vm.createContext(c);vm.runInContext(scheduler,c);events.DOMContentLoaded();
 return {window,document,get,timers,events,intervals,setReady:v=>ready=v,setEnabled:v=>enabled=v,setAccount:v=>account=v,setRun:v=>run=v,setNow:v=>now=v,get calls(){return calls;},async drain(){const tasks=[...timers.values()];timers.clear();for(const {fn}of tasks)fn();await settle();}};
}
test('event-driven checks coalesce immediately without waiting for 1s fallback; below threshold, hidden and OFF do nothing',async()=>{
 const f=schedulerFixture();await settle();assert.equal(f.timers.size,0);f.setReady(true);
 for(let i=0;i<100;i++)f.window.WakppuAutoRebirth.request();assert.equal(f.timers.size,1);assert.equal([...f.timers.values()][0].ms,0);
 await f.drain();assert.equal(f.calls,1);assert.ok(f.intervals.some(t=>t.ms===1000));
 f.document.hidden=true;f.window.WakppuAutoRebirth.request();assert.equal(f.timers.size,0);f.document.hidden=false;
 f.setEnabled(false);await f.window.WakppuAutoRebirth.refresh();f.window.WakppuAutoRebirth.request();await f.drain();assert.equal(f.calls,1);
});
test('pending run never overlaps, account changes cancel queued work, and errors retain 2s backoff',async()=>{
 const f=schedulerFixture();await settle();f.setReady(true);let release;f.setRun(()=>new Promise(r=>release=r));f.window.WakppuAutoRebirth.request();await f.drain();assert.equal(f.calls,1);
 for(let i=0;i<20;i++)f.window.WakppuAutoRebirth.request();assert.equal(f.timers.size,0);release(false);await settle();
 f.setRun(async()=>{throw new Error('lost response');});f.window.WakppuAutoRebirth.request();await f.drain();assert.equal(f.calls,2);await f.drain();assert.equal(f.calls,2);
 f.setNow(12001);f.setRun(async()=>false);f.window.WakppuAutoRebirth.request();await f.drain();assert.equal(f.calls,3);
 f.window.WakppuAutoRebirth.request();f.setAccount('b');f.setReady(false);f.events['wakppu-account-restored']();await settle();assert.equal(f.timers.size,0);assert.equal(f.calls,3);
});
function gameFixture(){
 const calls=[],state={account:{id:'a'},remoteReady:true,gold:2000000n,rebirths:0,busy:false};
 const saved={gold:'0',rebirths:1,item_revision:1,unlocked_ball_ids:['yellow'],selected_ball_id:'yellow',discovered_ball_ids:['yellow','green'],hammer_owned:true,hammer_level:8,hammer_selected_level:3,honey_expires_at:null,coating_expires_at:null};
 let reply={performed:true,progress:saved,items:{gold:'0',revision:1,inventory:{used:2},effects:{}}};
 const limited={data:{selected:'pumpkin',tokens:'55',owned:{pumpkin:{}}},accept(x){this.data=x;}},items={clearEffects:()=>calls.push('clear'),accept:()=>{calls.push('accept');return true;},refresh:async()=>calls.push('items-refresh')};
 const c={remoteInFlight:Promise.resolve(),remotePayload:()=>({gold:String(state.gold),rebirths:state.rebirths}),window:{},document:{hidden:false},state,nextRebirthCost:()=>2000000n,testSnapshot:null,eventRequest:false,hammerSelectionBusy:false,pendingItemHits:[],remoteSaveTimer:null,clearTimeout(){},itemRevision:0,rebirthModal:{hidden:false},eventSelected:true,eventClicks:5,eventAward:1n,displayEventReward:1n,ordinaryClicks:new Map([[0,3]]),WakppuLimited:limited,WakppuItems:items,WakppuItemGame:{flush:async()=>{throw new Error('redundant save');}},WakppuAuth:{invoke:async(action,body)=>{calls.push(action);assert.equal(body.progress.gold,String(state.gold));if(reply instanceof Error)throw reply;return reply;}},WAKPPU_BALLS:[{id:'yellow'},{id:'green'}],HAMMERS:Array(30).fill({}),WakppuGold:{integer:BigInt},wrap:{classList:{remove(){}}},svgEl:{classList:{remove(){}}},spawnBall:()=>calls.push('spawn'),updateAll:()=>calls.push('render'),restoreAccount:async()=>calls.push('restore')};
 Object.assign(c.window,{WakppuItems:items,WakppuLimited:limited});vm.createContext(c);vm.runInContext(readFileSync(new URL('../wakppuball/js/hit-requests.js',import.meta.url),'utf8'),c);c.pendingItemHits=c.WakppuHitRequests.createQueue();
 vm.runInContext(game.slice(game.indexOf('  function applySavedProgress'),game.indexOf('  async function restoreAccount')),c);
 vm.runInContext(game.slice(game.indexOf('  function autoRebirthReady'),game.indexOf('  window.WakppuGuestGame=')),c);
 return {c,calls,limited,saved,setReply:x=>reply=x,setFlush:x=>c.remoteInFlight=Promise.resolve().then(x),api:c.window.WakppuAutoRebirthGame};
}
test('atomic run drains older saves without another save request then applies authoritative snapshot without account reload; keeps stock/candy/hammer and clears selection',async()=>{
 const f=gameFixture();let release;f.setFlush(()=>new Promise(r=>release=r));const task=f.api.run();await settle();assert.deepEqual(f.calls,[]);release();assert.equal(await task,true);
 assert.deepEqual(f.calls,['auto_rebirth_run','clear','accept','spawn','render','render']);assert.equal(f.c.state.gold,0n);assert.equal(f.c.state.rebirths,1);assert.equal(f.c.state.hammerLevel,8);assert.equal(f.c.state.hammerSelectedLevel,3);assert.equal(f.limited.data.tokens,'55');assert.equal(f.limited.data.selected,null);assert.equal(f.c.state.busy,false);
});
test('guards prevent mid-animation transactions; legacy response and lost response reconcile safely; account switch never applies old snapshot',async()=>{
 let f=gameFixture();f.c.state.busy=true;assert.equal(await f.api.run(),false);assert.deepEqual(f.calls,[]);
 f=gameFixture();f.setReply({performed:true});await f.api.run();assert.ok(f.calls.includes('restore')&&f.calls.includes('items-refresh'));
 f=gameFixture();f.setReply({performed:false,progress:f.saved,items:{}});assert.equal(await f.api.run(),false);assert.ok(f.calls.includes('restore'));assert.ok(!f.calls.includes('clear'));assert.equal(f.limited.data.selected,'pumpkin');
 f=gameFixture();f.setReply(new Error('lost response'));await assert.rejects(f.api.run(),/lost response/);assert.ok(f.calls.includes('restore'));assert.equal(f.c.state.busy,false);
 f=gameFixture();f.setReply(new Error('lost committed response'));f.c.restoreAccount=async()=>{f.calls.push('restore');f.c.state.rebirths=1;f.c.state.gold=0n;};assert.equal(await f.api.run(),true);assert.equal(f.c.state.rebirths,1);
 f=gameFixture();f.setFlush(async()=>{f.c.state.account={id:'b'};});assert.equal(await f.api.run(),false);assert.deepEqual(f.calls,[]);assert.equal(f.c.state.gold,2000000n);
});
