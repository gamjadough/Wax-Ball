import {test} from 'node:test';import assert from 'node:assert/strict';
import {weeklyRows,weeklyCandidate,refreshWeekly} from './weekly-service.mjs';
import {createStore,execute} from './admin-service.mjs';
test('local weekly schedule matches KST boundaries and preserves manual events',()=>{
 const s=createStore(),rows=weeklyRows(s);rows.forEach(r=>r.enabled=true);
 const at=t=>Date.parse(t+'+09:00');
 assert.equal(weeklyCandidate(rows,'gold',at('2026-10-16T07:00:00')).multiplier,10);
 assert.equal(weeklyCandidate(rows,'gold',at('2026-10-16T07:10:00')).multiplier,100);
 assert.equal(weeklyCandidate(rows,'gold',at('2026-10-16T21:10:00')).multiplier,10);
 assert.equal(Date.parse(weeklyCandidate(rows,'ball',at('2026-10-16T21:10:00')).ends_at),at('2026-10-16T21:15:00'));
 assert.equal(Date.parse(weeklyCandidate(rows,'ball',at('2026-10-16T21:15:00')).starts_at),at('2026-10-23T07:00:00'));
 s.gold_event={id:'manual',ends_at:new Date(Date.now()+86400000).toISOString()};refreshWeekly(s);assert.equal(s.gold_event.id,'manual');
 assert.throws(()=>execute(s,s.players[1],{action:'admin_weekly_events',mode:'enable'}),{status:403});
 assert.throws(()=>execute(s,{...s.players[0],is_anonymous:true},{action:'admin_weekly_events',mode:'enable'}),{status:403});
 const enabled=execute(s,s.players[0],{action:'admin_weekly_events',mode:'enable'});assert.equal(enabled.weekly_events.filter(r=>r.enabled).length,2);
 execute(s,s.players[0],{action:'admin_weekly_events',mode:'disable'});assert.equal(s.gold_event.id,'manual');assert.equal(s.admin_ball_event,null);
});
