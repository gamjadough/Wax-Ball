import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../wakppuball/js/halloween-theme.js',import.meta.url),'utf8');
function setup(hostname,search='',now=Date.parse('2026-10-08T00:00:00+09:00')) {
  const state={active:false,hidden:true};
  const context={window:{},location:{hostname,search},URLSearchParams,Date:class extends Date {static now(){return now;}},document:{body:{classList:{toggle:(_,active)=>state.active=active}},getElementById:()=>state,addEventListener(){}},setInterval(){}};
  vm.runInNewContext(source,context);return {state,api:context.window.WakppuHalloween};
}
test('annual Korean-time season boundaries independent of host timezone',()=>{
  const {api}=setup('example.com');
  for(const year of [2026,2027,2028]) {
    for(const [date,expected] of [['10-23T23:59:59.999',false],['10-24T00:00:00',true],['10-31T12:00:00',true],['11-14T23:59:59.999',true],['11-15T00:00:00',false],['01-01T00:00:00',false]])assert.equal(api.activeAt(Date.parse(`${year}-${date}+09:00`)),expected);
  }
});
test('preview only forces scenery on loopback hosts; production follows schedule',()=>{
  assert.equal(setup('127.0.0.1','?preview=halloween').state.active,true);
  assert.equal(setup('gamjadough.github.io','?preview=halloween').state.active,false);
  assert.equal(setup('127.0.0.1','?theme=halloween').state.active,true);
  assert.equal(setup('gamjadough.github.io','?theme=halloween').state.active,false);
  assert.equal(setup('gamjadough.github.io','',Date.parse('2026-10-24T00:00:00+09:00')).state.hidden,false);
});
test('server override takes priority and auto restores Korean schedule using server time',()=>{
  const {state,api}=setup('example.com');
  api.accept({background_mode:'halloween'});assert.equal(state.active,true);
  api.accept({background_mode:'default',server_time:'2026-10-31T12:00:00+09:00'});assert.equal(state.active,false);
  api.accept({background_mode:'auto'});assert.equal(state.active,true);
  api.accept({background_mode:'auto',server_time:'2026-11-15T00:00:00+09:00'});assert.equal(state.active,false);
});
