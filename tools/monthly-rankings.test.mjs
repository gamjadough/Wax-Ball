import {test} from 'node:test';import assert from 'node:assert/strict';
import {monthlyFixture,player,admin} from './monthly-fixture.mjs';
import {createStore} from './admin-service.mjs';import {execute} from './ember-auto-service.mjs';
import {monthlyAction,monthlySettle} from './monthly-service.mjs';import {createProfileService} from './profile-service.mjs';

test('monthly SQL: accepted manual hit once, hammer independent, real ember excluded, all ball paths and failed hits',async()=>{
 const {db,rpc,clock}=await monthlyFixture();try{
 const get=()=>rpc(player,{action:'items'}),score=async()=>Number((await rpc(player,{action:'monthly_rankings'})).me.clicks);
 const send=async(action,more={})=>rpc(player,{action,request_id:crypto.randomUUID(),item_revision:(await get()).revision,...more});
 const req={action:'item_hit',request_id:crypto.randomUUID(),item_revision:(await get()).revision};await rpc(player,req);assert.equal(await score(),1);await rpc(player,req);assert.equal(await score(),1);
 await db.query('update game_states set hammer_owned=true,hammer_level=30,hammer_selected_level=30 where user_id=$1',[player]);
 await send('item_hit',{hit_source:'ember_auto',clicks:1e9});assert.equal(await score(),2);
 await assert.rejects(rpc(player,{action:'item_hit',request_id:crypto.randomUUID(),item_revision:-1}));assert.equal(await score(),2);
 await rpc(player,{action:'halloween_cosmetics'});await db.query("update wakppu_halloween_cosmetics set owned='{"+'"pumpkin_ember":true}'+"',equipped='pumpkin_ember' where user_id=$1",[player]);
 await send('ember_auto_hit',{hit_action:'item_hit'});assert.equal(await score(),2);
 const event=(await rpc(admin,{action:'admin_ball_event',mode:'start',duration_seconds:300,delay_seconds:0})).admin_ball_event;
 await send('item_hit',{event_id:event.id});await send('event_ball_hit',{event_id:event.id});assert.equal(await score(),4);
 await rpc(player,{action:'limited'});await db.exec("update wakppu_limited_settings set starts_at=now()-interval '1 day',ends_at=now()+interval '1 day'");await db.query('update wakppu_limited_players set tokens=100 where user_id=$1',[player]);
 await send('limited_buy');await send('limited_select',{ball_id:'halloween-pumpkin-2026'});await send('limited_hit');assert.equal(await score(),5);
 await clock('2026-10-31T14:59:59.999Z');await send('limited_hit');assert.equal(await score(),6);
 await clock('2026-10-31T15:00:00Z');await send('limited_hit');let r=await rpc(player,{action:'monthly_rankings'});assert.equal(r.month,'2026-11');assert.equal(r.trial,false);assert.equal(r.me.clicks,'1');
 r=await rpc(player,{action:'monthly_rankings',month:'2026-10'});assert.equal(r.finalized,true);assert.equal(r.me.clicks,'6');assert.equal((await db.query('select count(*) n from wakppu_monthly_rewards')).rows[0].n,0);
 await db.query('insert into wakppu_blue_gems(user_id,balance) values($1,5000) on conflict(user_id) do update set balance=5000',[player]);await send('gem_ball_buy',{ball_id:'blue-crystal-wax'});await send('gem_ball_select',{ball_id:'blue-crystal-wax'});
 const gemReq={action:'item_hit',item_revision:(await get()).revision,request_id:crypto.randomUUID()};const gemHit=await rpc(player,gemReq);assert.equal(gemHit.broken,true);assert.equal(gemHit.gem_reward,'5');await rpc(player,gemReq);assert.equal(await score(),2);
 await db.query("update wakppu_halloween_cosmetics set ember_last_hit_at=clock_timestamp()-interval '2 seconds' where user_id=$1",[player]);await send('ember_auto_hit',{hit_action:'item_hit'});assert.equal(await score(),2);
 await assert.rejects(rpc(player,{action:'monthly_rankings',month:'2026-13'}),{code:'PT400'});await assert.rejects(rpc(player,{action:'monthly_rankings',month:'2026-12'}),{code:'PT400'});
 await assert.rejects(rpc(player,{action:'monthly_rankings',user_id:admin}),{code:'PT403'});
 await db.exec('update server_settings set maintenance=true');assert.equal((await rpc(player,{action:'monthly_rankings'})).month,'2026-11');await assert.rejects(send('limited_hit'),{code:'PT503'});await db.exec('update server_settings set maintenance=false');
 await db.exec(`create or replace function wakppu_sleep_hours(instant timestamptz) returns jsonb language sql stable set search_path=public,pg_temp as $$select '{"active":true}'::jsonb$$;`);
 assert.equal((await rpc(null,{action:'monthly_rankings'})).month,'2026-11');await assert.rejects(send('limited_hit'),{code:'PT503'});
 }finally{await db.close();}
});

test('monthly SQL: exact tie order, frozen settlement, all reward tiers, permanent owned equipment and private boundaries',async()=>{
 const {db,rpc,clock}=await monthlyFixture();try{
 await clock('2026-11-30T14:59:59Z');await rpc(player,{action:'items'});
 await db.exec("insert into wakppu_monthly_seasons(month) values('2026-11-01') on conflict do nothing");
 const ids=[];for(let i=2;i<=15;i++){
  const u='00000000-0000-0000-0000-'+String(i).padStart(12,'0');ids.push(u);
  if(i>2){await db.query("insert into players(user_id,nickname,role) values($1,$2,'player')",[u,'월간'+i]);await db.query('insert into game_states(user_id) values($1)',[u]);}
  await db.query("insert into wakppu_monthly_clicks values('2026-11-01',$1,$2,$3)",[u,i<4?'2000':i===15?'999':'1000',new Date(Date.UTC(2026,10,30,14,58,i))]);
 }
 await db.query("insert into wakppu_monthly_clicks values('2026-11-01',$1,999999,now())",[admin]);
 await db.query('update players set ranking_hidden=true where user_id=$1',[ids[10]]);await db.query("insert into moderation_cases(user_id,status) values($1,'banned')",[ids[11]]);
 let r=await rpc(player,{action:'monthly_rankings'});assert.equal(r.me.rank,1);assert.equal(r.rows.length,12);assert.equal(r.rows[1].nickname,'월간3');
 await clock('2026-11-30T15:00:00Z');r=await rpc(player,{action:'monthly_rankings',month:'2026-11'});assert.equal(r.finalized,true);assert.equal(r.rows[0].clicks,'2000');
 let p=await rpc(player,{action:'profile_status'});assert.ok(p.owned.includes('monthly_202611_gold'));assert.equal(p.badge_catalog.length,1);assert.ok(p.title_catalog.some(t=>t.id==='monthly_202611_champion'));
 p=await rpc(player,{action:'profile_equip',card_id:'monthly_202611_gold'});assert.equal(p.equipped,'monthly_202611_gold');
 p=await rpc(player,{action:'profile_title',title_id:'monthly_202611_champion'});assert.equal(p.title,'2026년 11월 클릭왕');
 p=await rpc(player,{action:'monthly_badge_equip',badge_id:'monthly_202611_participant'});assert.equal(p.monthly_badge,'2026년 11월 참여 배지');
 const profile=await rpc(ids[1],{action:'player_profile',nickname:'플레이어'});assert.equal(profile.card.id,'monthly_202611_gold');assert.equal(profile.card.image,'images/profile-cards/monthly-gold.webp');assert.equal(profile.monthly_badge,'2026년 11월 참여 배지');assert.equal(profile.title,'2026년 11월 클릭왕');
 assert.equal((await rpc(player,{action:'rankings'})).find(r=>r.nickname==='플레이어').monthly_badge,'2026년 11월 참여 배지');
 assert.ok((await rpc(ids[1],{action:'profile_status'})).owned.includes('monthly_202611_silver'));assert.ok((await rpc(ids[2],{action:'profile_status'})).owned.includes('monthly_202611_bronze'));
 p=await rpc(ids[9],{action:'profile_status'});assert.ok(!p.owned.some(c=>c.startsWith('monthly_')));assert.ok(p.title_catalog.some(t=>t.id==='monthly_202611_top10'));
 p=await rpc(ids[12],{action:'profile_status'});assert.equal(p.badge_catalog.length,1);assert.ok(!p.title_catalog.some(t=>t.id.startsWith('monthly_')));
 p=await rpc(ids[13],{action:'profile_status'});assert.equal(p.badge_catalog.length,0);assert.ok(!p.title_catalog.some(t=>t.id.startsWith('monthly_')));
 await assert.rejects(rpc(ids[13],{action:'monthly_badge_equip',badge_id:'monthly_202611_participant'}),{code:'PT403'});
 await assert.rejects(rpc(admin,{action:'profile_equip',card_id:'monthly_202611_gold'}),{code:'PT400'});
 await assert.rejects(rpc(ids[12],{action:'profile_title',title_id:'monthly_202611_champion'}),{code:'PT403'});
 const rewards=(await db.query('select * from wakppu_monthly_rewards order by user_id,kind')).rows;
 await db.query("update wakppu_monthly_clicks set clicks=99999 where month='2026-11-01' and user_id=$1",[ids[1]]);await db.exec('select wakppu_monthly_settle()');
 assert.deepEqual((await db.query('select * from wakppu_monthly_rewards order by user_id,kind')).rows,rewards);assert.equal((await rpc(player,{action:'monthly_rankings',month:'2026-11'})).me.rank,1);
 await clock('2027-01-01T03:00:00Z');assert.equal((await rpc(player,{action:'profile_status'})).equipped,'monthly_202611_gold');
 await rpc(player,{action:'monthly_badge_equip',badge_id:null});assert.equal((await rpc(player,{action:'profile_status'})).monthly_badge,null);
 await db.query("update players set nickname='이름변경' where user_id=$1",[player]);r=await rpc(player,{action:'monthly_rankings',month:'2026-11'});assert.equal(r.me.nickname,'플레이어');assert.equal(r.me.profile_nickname,'이름변경');
 await db.exec('set role authenticated');for(const table of ['seasons','clicks','results','rewards'])await assert.rejects(db.query('select * from wakppu_monthly_'+table),{code:'42501'});
 for(const fn of ['wakppu_monthly_settle()','wakppu_monthly_record(\''+player+'\')',"wakppu_api_before_monthly('{}')"])await assert.rejects(db.query('select '+fn),{code:'42501'});
 }finally{await db.close();}
});

test('local monthly: manual replay exclusion, rank/rewards/ownership and new month leaves progress intact',()=>{
 const s=createStore(),p=s.players[1],profiles=createProfileService(s);s.sleep_now_ms=Date.parse('2026-10-29T03:00:00Z');s.monthly_now_ms=Date.parse('2026-11-30T14:59:59Z');
 const req={action:'item_hit',request_id:crypto.randomUUID(),item_revision:0};execute(s,p,req);execute(s,p,req);assert.equal(monthlyAction(s,p,{action:'monthly_rankings'}).me.clicks,'1');
 const before=structuredClone(p.state);s.monthly.get('2026-11').counts.get(p.id).clicks=1000n;s.monthly_now_ms+=1000;monthlySettle(s);monthlySettle(s);
 assert.equal(p.monthlyCards.length,1);assert.deepEqual(p.state,before);assert.equal(profiles.execute(p,{action:'profile_equip',card_id:'monthly_202611_gold'}).equipped,'monthly_202611_gold');
 assert.equal(profiles.execute(p,{action:'profile_title',title_id:'monthly_202611_champion'}).title,'2026년 11월 클릭왕');assert.throws(()=>monthlyAction(s,s.players[0],{action:'monthly_badge_equip',badge_id:'monthly_202611_participant'}),{status:403});
});
