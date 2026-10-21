import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../wakppuball/js/guest-exit.js',import.meta.url),'utf8');
function setup(options={}){
 let session={user:{id:'guest',is_anonymous:true}},removed=false,cleared=0,released=0,adopted=0,discardCalls=0,reset=0;const events=[],storage=new Map();
 const driver={
  check:async()=>({data:{user:{...session.user,is_anonymous:options.converted?false:session.user.is_anonymous}}}),
  verify:async()=>options.badPassword?{error:Error('비밀번호 오류')}:{data:{session:{user:{id:'existing',email:'used@test.com',is_anonymous:false}}},release:async()=>released++},
  discard:async original=>{discardCalls++;if(options.serverFail)throw Object.assign(Error('서버 실패'),{status:503});if(options.lostResponse&&discardCalls===1){removed=true;throw Error('네트워크 오류');}removed=true;return {deleted:true,user_id:original.user.id};},
  adopt:async target=>{if(options.adoptFail)return {error:Error('저장 실패')};adopted++;session=target;return {error:null};},
  clear:async()=>{cleared++;session=null;return {error:null};},
 };
 const auth={session:async()=>({data:{session}}),guestDriver:driver};const window={WakppuGuestGame:{discarded:()=>reset++},dispatchEvent:e=>events.push(e.detail)};
 vm.runInNewContext(source,{window,WakppuAuth:auth,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},CustomEvent:class{constructor(_,o){this.detail=o.detail;}},Error});
 return {api:window.WakppuGuestExit,counts:()=>({removed,cleared,released,adopted,discardCalls,reset}),session:()=>session,events};
}
test('switch authenticates first, discards only self and blocks guest progress import',async()=>{const s=setup();assert.equal((await s.api.run('switch','used@test.com','password')).deleted,true);assert.equal(s.session().user.id,'existing');assert.equal(s.api.skipImport('existing'),true);assert.deepEqual(s.counts(),{removed:true,cleared:0,released:0,adopted:1,discardCalls:1,reset:1});assert.equal(s.api.busy,false);});
test('wrong password, converted account and definite deletion failure preserve original guest',async()=>{for(const o of [{badPassword:true},{converted:true},{serverFail:true}]){const s=setup(o);assert.ok((await s.api.run('switch','used@test.com','bad')).error);assert.equal(s.counts().removed,false);assert.equal(s.counts().adopted,0);assert.equal(s.session().user.id,'guest');assert.equal(s.counts().reset,0);}});
test('logout deletes and clears; lost success can retry safely; adopted-session failure never restores deleted guest',async()=>{let s=setup();assert.equal((await s.api.run('logout')).deleted,true);assert.equal(s.session(),null);s=setup({lostResponse:true});assert.equal((await s.api.run('logout')).deleted,true);assert.equal(s.counts().discardCalls,2);s=setup({adoptFail:true});const r=await s.api.run('switch','used@test.com','password');assert.equal(r.deleted,true);assert.match(r.error.message,/삭제는 완료/);assert.equal(s.session(),null);assert.equal(s.counts().released,1);});
