import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {monthlyFixture,player,admin} from './monthly-fixture.mjs';
import {monthlySettle,monthlyBadges,monthlyAction} from './monthly-service.mjs';import {createStore} from './admin-service.mjs';
const migration=new URL('../supabase/migrations/20261104102957_october_tester_badge.sql',import.meta.url);
test('October SQL: any recorded participant, one-time permanent grant, no November-only grant, safe equip/unequip and unchanged scores',async()=>{
 const {db,rpc}=await monthlyFixture();try{
  await db.exec("insert into wakppu_monthly_seasons(month,finalized_at) values('2026-10-01',now()),('2026-11-01',null) on conflict(month) do nothing");
  await db.query("insert into wakppu_monthly_clicks values('2026-10-01',$1,1,now()),('2026-11-01',$2,5000,now())",[player,admin]);
  await db.query("insert into wakppu_monthly_results select '2026-10-01',user_id,1,1,nickname from players where user_id=$1",[player]);
  const before=(await db.query('select * from wakppu_monthly_clicks order by month,user_id')).rows;
  const sql=await readFile(migration,'utf8');await db.exec(sql);await db.exec(sql);
  assert.deepEqual((await db.query('select * from wakppu_monthly_clicks order by month,user_id')).rows,before);
  assert.equal((await db.query("select count(*) n from wakppu_monthly_rewards where month='2026-10-01'")).rows[0].n,1);
  await db.query("insert into wakppu_monthly_rewards values($1,'2026-11-01','top10')",[player]);await rpc(player,{action:'profile_title',title_id:'monthly_202611_top10'});
  let p=await rpc(player,{action:'profile_status'});assert.deepEqual(p.badge_catalog,[{id:'monthly_202610_participant',name:'2026년 10월 테스터 배지'}]);assert.equal(p.badge_equipped,null);
  await assert.rejects(rpc(admin,{action:'monthly_badge_equip',badge_id:'monthly_202610_participant'}),{code:'PT403'});
  await assert.rejects(rpc(player,{action:'monthly_badge_equip',badge_id:'monthly_202610_participant',user_id:admin}),{code:'PT403'});
  p=await rpc(player,{action:'monthly_badge_equip',badge_id:'monthly_202610_participant'});assert.equal(p.monthly_badge,'2026년 10월 테스터 배지');assert.equal(p.title_equipped,'monthly_202611_top10');assert.equal(p.title,'2026년 11월 클릭 TOP 10');
  const nickname=(await db.query('select nickname from players where user_id=$1',[player])).rows[0].nickname;
  assert.equal((await rpc(player,{action:'player_profile',nickname})).monthly_badge,'2026년 10월 테스터 배지');
  assert.equal((await rpc(null,{action:'monthly_rankings',month:'2026-10'})).rows[0].monthly_badge,'2026년 10월 테스터 배지');
  assert.equal((await rpc(player,{action:'rankings'})).find(r=>r.nickname===nickname).monthly_badge,'2026년 10월 테스터 배지');
  await db.query("insert into wakppu_monthly_rewards values($1,'2026-11-01','participant')",[player]);
  p=await rpc(player,{action:'monthly_badge_equip',badge_id:'monthly_202611_participant'});assert.equal(p.monthly_badge,'2026년 11월 참여 배지');
  await db.exec(sql);assert.equal((await rpc(player,{action:'profile_status'})).badge_equipped,'monthly_202611_participant');
  p=await rpc(player,{action:'monthly_badge_equip',badge_id:null});assert.equal(p.monthly_badge,null);
  assert.equal((await db.query("select has_function_privilege('anon','wakppu_monthly_badge_state(uuid)','EXECUTE') permitted")).rows[0].permitted,false);
 }finally{await db.close();}
});
test('local October settlement grants a single souvenir at one click without granting formal cards/titles',()=>{
 const store=createStore(),p=store.players[1];store.monthly_now_ms=Date.parse('2026-11-04T03:00:00Z');
 store.monthly=new Map([['2026-10',{counts:new Map([[p.id,{id:p.id,clicks:1n,reached:0}]]),done:false}]]);
 monthlySettle(store);monthlySettle(store);assert.equal(p.monthlyRewards.length,1);assert.equal(p.monthlyCards,undefined);
 assert.deepEqual(monthlyBadges(p).badge_catalog,[{id:'monthly_202610_participant',name:'2026년 10월 테스터 배지'}]);
 monthlyAction(store,p,{action:'monthly_badge_equip',badge_id:'monthly_202610_participant'});assert.equal(monthlyBadges(p).monthly_badge,'2026년 10월 테스터 배지');
});
