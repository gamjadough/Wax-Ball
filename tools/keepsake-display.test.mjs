import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
function fixture(){
 let now=1000000,serial=0;const storage=new Map(),timers=new Map(),listeners={},events={},nodes=new Set();
 const game={account:'a',ready:true,test:false,blocked:false};
 const document={hidden:false,addEventListener:(name,fn)=>events[name]=fn,getElementById:()=>({append:n=>nodes.add(n)}),
  createElement:()=>({setAttribute(){},querySelector:()=>({textContent:''}),remove(){nodes.delete(this);}})};
 const window={WakppuItemGame:{read:()=>game},addEventListener:(name,fn)=>listeners[name]=fn};
 const ctx={window,document,Date:{now:()=>now},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},setTimeout:(fn,ms)=>{const id=++serial;timers.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id)};
 vm.runInNewContext(readFileSync(new URL('../wakppuball/js/keepsake-display.js',import.meta.url),'utf8'),ctx);
 return {api:window.WakppuKeepsakeDisplay,game,document,storage,nodes,timers,events,listeners,now:()=>now,
  advance(ms){now+=ms;for(const [id,t] of [...timers])if(t.at<=now){timers.delete(id);t.fn();}}};
}
const owned={inventory:{developer_piercing_fragment:1}},key=id=>'wakppuball:keepsake-display:'+id;
test('cosmetic display: only owned use starts, exactly ten minutes, reuse renews, one timer and expiry cleanup',()=>{
 const f=fixture();f.api.start('a');assert.equal(f.nodes.size,0);
 f.api.sync(owned);assert.equal(f.nodes.size,0);f.api.start('a');assert.equal(f.nodes.size,1);assert.equal(f.timers.size,1);
 assert.equal(Number(f.storage.get(key('a')))-f.now(),600000);
 f.advance(9000);f.api.start('a');assert.equal(Number(f.storage.get(key('a')))-f.now(),600000);assert.equal(f.timers.size,1);
 f.advance(599000);assert.equal(f.nodes.size,1);f.advance(1000);assert.equal(f.nodes.size,0);assert.equal(f.timers.size,0);assert.ok(!f.storage.has(key('a')));
});
test('cosmetic display: account isolation, auth cleanup, tab pause/resume, blocked play and ownership loss',()=>{
 const f=fixture();f.api.sync(owned);f.api.start('a');const deadline=f.storage.get(key('a'));
 f.document.hidden=true;f.events.visibilitychange();assert.equal(f.nodes.size,0);assert.equal(f.timers.size,0);
 f.advance(120000);f.document.hidden=false;f.events.visibilitychange();assert.equal(f.nodes.size,1);assert.equal(f.storage.get(key('a')),deadline);
 f.game.test=true;f.advance(1000);assert.equal(f.nodes.size,0);f.game.test=false;f.advance(1000);assert.equal(f.nodes.size,1);
 f.listeners['wakppu-auth-changed']({detail:{user:{id:'b'}}});assert.equal(f.nodes.size,0);assert.equal(f.timers.size,0);
 f.game.account='b';f.api.sync(owned);assert.equal(f.nodes.size,0);assert.equal(f.storage.get(key('a')),deadline);
 f.game.account='a';f.api.sync(owned);assert.equal(f.nodes.size,1);f.api.sync({inventory:{}});assert.equal(f.nodes.size,0);assert.ok(!f.storage.has(key('a')));
});
