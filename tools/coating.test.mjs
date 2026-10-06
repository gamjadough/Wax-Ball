import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStore,execute} from './admin-service.mjs';
test('event coating multiplies all rewards, doubles durability to 1200, persists and expires',()=>{
 const s=createStore(),[admin,p]=s.players,now=Date.now();
 p.state.hammer_owned=true;p.state.hammer_level=10;p.state.rebirths=2;p.state.honey_expires_at=new Date(now+600000).toISOString();
 p.state.coating_expires_at=new Date(now+900000).toISOString();p.state.gold='0';
 s.gold_event={multiplier:10,starts_at:new Date(now-1000).toISOString(),ends_at:new Date(now+600000).toISOString()};
 execute(s,admin,{action:'admin_ball_event',mode:'start',duration_seconds:300,delay_seconds:0});
 const hit=()=>execute(s,p,{action:'event_ball_hit',event_id:s.admin_ball_event.id,request_id:crypto.randomUUID()});
 for(let i=1;i<=8;i++){const r=hit();assert.equal(r.clicks,i*135);assert.equal(r.required_clicks,1200);assert.equal(r.reward,'0');}
 assert.equal(hit().reward,'2400'); // yellow 1 × event base 10 × rebirth 4 × honey 2 × event 10 × coating 3
 assert.equal(execute(s,p,{action:'bootstrap'}).state.coating_expires_at,p.state.coating_expires_at);
 p.state.coating_expires_at=new Date(now-1).toISOString();
 for(let i=1;i<=4;i++){const r=hit();assert.equal(r.required_clicks,600);assert.equal(r.reward,'0');}
 assert.equal(hit().reward,'800');
});
