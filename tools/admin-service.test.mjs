import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStore,execute,ballIds} from './admin-service.mjs';
test('일반 유저와 미로그인 요청은 모든 관리자 기능에서 거절',()=>{
  const s=createStore();for(const action of ['admin_search','admin_logs','admin_gold','admin_rebirths','admin_unlock','admin_discovery','admin_unban','admin_test','admin_maintenance','admin_announcement']) {
    assert.throws(()=>execute(s,s.players[1],{action}),{status:403});assert.throws(()=>execute(s,null,{action}),{status:401});
  }assert.equal(s.logs.length,0);
});
test('Gold 수정은 다른 진행도 유지, 잘못된 값 거절, 변경 전후 기록',()=>{
  const s=createStore(),a=s.players[0],p=s.players[1];const original=structuredClone(p.state);
  execute(s,a,{action:'admin_gold',user_id:p.id,mode:'add',value:500});assert.equal(p.state.gold,10500);
  assert.deepEqual({...p.state,gold:original.gold},original);assert.equal(s.logs[0].before.state.gold,10000);assert.equal(s.logs[0].after.state.gold,10500);
  assert.throws(()=>execute(s,a,{action:'admin_gold',user_id:p.id,mode:'set',value:-1}));assert.equal(p.state.gold,10500);
});
test('환생 범위·정지 해제·도감 초기화와 해금 분리',()=>{
  const s=createStore(),a=s.players[0],p=s.players[1];execute(s,a,{action:'admin_rebirths',user_id:p.id,mode:'set',value:5});assert.equal(p.state.rebirths,5);
  assert.throws(()=>execute(s,a,{action:'admin_rebirths',user_id:p.id,mode:'set',value:26}));
  execute(s,a,{action:'admin_unlock',user_id:p.id,mode:'all'});assert.deepEqual(p.state.unlocked_ball_ids,ballIds);
  execute(s,a,{action:'admin_discovery',user_id:p.id,mode:'reset_all'});assert.deepEqual(p.state.discovered_ball_ids,[]);assert.deepEqual(p.state.unlocked_ball_ids,ballIds);
  execute(s,a,{action:'admin_unban',user_id:p.id});assert.equal(p.moderation.status,'active');
});
test('점검은 일반 유저 API 차단, 관리자·상태 확인 허용',()=>{
  const s=createStore(),a=s.players[0],p=s.players[1];execute(s,a,{action:'admin_maintenance',enabled:true});
  assert.throws(()=>execute(s,p,{action:'save_progress'}),{status:503});assert.throws(()=>execute(s,p,{action:'bootstrap'}),{status:503});assert.equal(execute(s,p,{action:'status'}).maintenance,true);assert.equal(execute(s,a,{action:'bootstrap'}).player.role,'admin');
});
test('개발 테스트 승인만으로 진행도·랭킹 변경 없음',()=>{
  const s=createStore(),a=s.players[0];const before=structuredClone(s);assert.equal(execute(s,a,{action:'admin_test',ball_id:'blackhole'}).authorized,true);assert.deepEqual(s,before);
});
