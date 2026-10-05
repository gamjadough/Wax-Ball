import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStore,execute,ballIds,isBanned} from './admin-service.mjs';
test('공지 등록·해제·재등록과 권한 차단 및 작업 기록',()=>{
  const s=createStore(),a=s.players[0],p=s.players[1];
  execute(s,a,{action:'admin_announcement',message:'테스트 공지'});
  const before=structuredClone(s.announcement),progress=structuredClone(s.players);
  for(const actor of [p,null]) assert.throws(()=>execute(s,actor,{action:'admin_announcement',clear:true}));
  assert.deepEqual(s.announcement,before);
  assert.throws(()=>execute(s,a,{action:'admin_announcement',message:''}));
  execute(s,a,{action:'admin_announcement',clear:true});
  assert.equal(execute(s,p,{action:'status'}).announcement,null);
  assert.deepEqual(s.logs[1].before,before);assert.equal(s.logs[1].after,null);
  assert.deepEqual(s.players,progress);
  execute(s,a,{action:'admin_announcement',clear:true});
  execute(s,a,{action:'admin_announcement',message:'새 공지'});
  assert.equal(s.announcement.message,'새 공지');
});
test('일반 유저와 미로그인 요청은 모든 관리자 기능에서 거절',()=>{
  const s=createStore();for(const action of ['admin_search','admin_logs','admin_gold','admin_rebirths','admin_unlock','admin_discovery','admin_unban','admin_test','admin_maintenance','admin_announcement','admin_ban','admin_ranking_visibility']) {
    assert.throws(()=>execute(s,s.players[1],{action}),{status:403});assert.throws(()=>execute(s,null,{action}),{status:401});
  }assert.equal(s.logs.length,0);
});
test('랭킹 숨김은 플레이 유지, 해제 복원, 밴 해제와 독립',()=>{
  const s=createStore(),a=s.players[0],p=s.players[1],progress=structuredClone(p.state);
  const payload={action:'admin_ranking_visibility',user_id:p.id,hidden:true,reason:'랭킹 제외'};
  execute(s,a,payload);
  assert.equal(execute(s,a,{action:'rankings'}).some(r=>r.nickname===p.nickname),false);
  assert.deepEqual({...p.state,admin_revision:undefined},{...progress,admin_revision:undefined});
  assert.equal(execute(s,p,{action:'bootstrap'}).player.id,p.id);
  execute(s,p,{action:'save_progress',admin_revision:p.state.admin_revision,gold:'10001'});
  assert.equal(p.state.gold,'10001');
  execute(s,a,{action:'admin_unban',user_id:p.id});assert.equal(p.ranking_hidden,true);
  execute(s,a,{...payload,hidden:false});
  assert.equal(execute(s,a,{action:'rankings'}).some(r=>r.nickname===p.nickname),true);
  assert.equal(s.logs[0].reason,'랭킹 제외');assert.equal(s.logs[0].after.ranking_hidden,true);
});
test('기간제·영구 밴 차단, 만료 및 해제, 관리자 보호',()=>{
  const s=createStore(),a=s.players[0],p=s.players[1];
  const payload={action:'admin_ban',user_id:p.id,mode:'temporary',duration_hours:24,reason:'테스트 제재'};
  execute(s,a,payload);assert.equal(isBanned(p),true);
  assert.equal(execute(s,p,{action:'status'}).moderation.blocked,true);
  for(const action of ['bootstrap','save_progress','rankings','set_nickname'])assert.throws(()=>execute(s,p,{action}),{status:403});
  assert.equal(execute(s,a,{action:'rankings'}).some(r=>r.nickname===p.nickname),false);
  p.moderation.suspended_until=new Date(Date.now()-1).toISOString();
  assert.equal(isBanned(p),false);assert.equal(execute(s,p,{action:'bootstrap'}).player.id,p.id);
  assert.equal(execute(s,a,{action:'rankings'}).some(r=>r.nickname===p.nickname),true);
  execute(s,a,{...payload,mode:'permanent'});assert.equal(p.moderation.status,'banned');assert.equal(p.moderation.suspended_until,null);
  execute(s,a,{action:'admin_ranking_visibility',user_id:p.id,hidden:false});assert.equal(isBanned(p),true);
  execute(s,a,{action:'admin_unban',user_id:p.id});assert.equal(isBanned(p),false);
  assert.throws(()=>execute(s,a,{...payload,user_id:a.id}));assert.equal(isBanned(a),false);
});
test('잘못된 제재 요청은 상태와 기록을 변경하지 않음',()=>{
  const s=createStore(),a=s.players[0],p=s.players[1],before=structuredClone(s);
  for(const extra of [{reason:''},{mode:'invalid'},{duration_hours:0},{duration_hours:1.5},{duration_hours:8761},{reason:'x'.repeat(501)}])
    assert.throws(()=>execute(s,a,{action:'admin_ban',user_id:p.id,mode:'temporary',duration_hours:24,reason:'사유',...extra}));
  assert.throws(()=>execute(s,a,{action:'admin_ranking_visibility',user_id:p.id,hidden:'true'}));
  assert.deepEqual(s,before);
});
test('Gold 수정은 다른 진행도 유지, 잘못된 값 거절, 변경 전후 기록',()=>{
  const s=createStore(),a=s.players[0],p=s.players[1];const original=structuredClone(p.state);
  execute(s,a,{action:'admin_gold',user_id:p.id,mode:'add',value:500});assert.equal(p.state.gold,10500);
  assert.deepEqual({...p.state,gold:original.gold},original);assert.equal(s.logs[0].before.state.gold,10000);assert.equal(s.logs[0].after.state.gold,10500);
  assert.throws(()=>execute(s,a,{action:'admin_gold',user_id:p.id,mode:'set',value:-1}));assert.equal(p.state.gold,10500);
});
test('환생 범위·정지 해제·도감 초기화와 해금 분리',()=>{
  const s=createStore(),a=s.players[0],p=s.players[1];execute(s,a,{action:'admin_rebirths',user_id:p.id,mode:'set',value:5});assert.equal(p.state.rebirths,5);
  execute(s,a,{action:'admin_rebirths',user_id:p.id,mode:'set',value:100});assert.equal(p.state.rebirths,100);
  assert.throws(()=>execute(s,a,{action:'admin_rebirths',user_id:p.id,mode:'set',value:101}));
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
