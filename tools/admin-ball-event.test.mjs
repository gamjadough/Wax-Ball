import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStore,execute,ballIds} from './admin-service.mjs';
import {ballCatalog} from './event-ball-catalog.mjs';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('event responses are applied immediately and older in-flight status cannot undo them',async()=>{
 let clock=0;const context={performance:{now:()=>clock},document:{getElementById:()=>null},setInterval:()=>{},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},dispatchEvent:()=>{}};context.window=context;
 vm.runInNewContext(await readFile(new URL('../wakppuball/js/event-time.js',import.meta.url),'utf8'),context);
 vm.runInNewContext(await readFile(new URL('../wakppuball/js/admin-ball-event.js',import.meta.url),'utf8'),context);
 const event={id:'event',starts_at:'2026-10-05T00:00:00Z',ends_at:'2026-10-05T00:05:00Z'};
 context.WakppuAdminBallEvent.update({admin_ball_event:event,server_time:'2026-10-05T00:00:01Z'});
 assert.equal(context.WakppuAdminBallEvent.current().phase,'active');
 context.WakppuAdminBallEvent.update({admin_ball_event:null,server_time:'2026-10-05T00:00:00Z'});
 assert.equal(context.WakppuAdminBallEvent.current().phase,'active');
 context.WakppuAdminBallEvent.update({admin_ball_event:null,server_time:'2026-10-05T00:00:02Z'});
 context.WakppuAdminBallEvent.update({admin_ball_event:event,server_time:'2026-10-05T00:00:01Z'});
 assert.equal(context.WakppuAdminBallEvent.current().phase,'idle');
});
test('catalog matches the real migration and excludes the event ball',async()=>{
 const sql=(await readFile(new URL('../supabase/migrations/20261007_admin_ball_event.sql',import.meta.url),'utf8'))+(await readFile(new URL('../supabase/migrations/20261009_transcendent_balls.sql',import.meta.url),'utf8'));
 for(const b of await ballCatalog())assert.ok(sql.includes(`('${b.id}',${b.reward})`));
 assert.equal(ballIds.includes('admin-event'),false);
});
test('local event: roles, 600 hits, max hammer five hits, repeated rewards, expiry and multipliers',()=>{
 const s=createStore(),[admin,p]=s.players,call=b=>execute(s,p,b);
 const start={action:'admin_ball_event',mode:'start',duration_seconds:300,delay_seconds:0};
 assert.throws(()=>call(start));execute(s,admin,start);
 const hit=()=>({action:'event_ball_hit',event_id:s.admin_ball_event.id,request_id:crypto.randomUUID()});
 p.state.gold='0';p.state.unlocked_ball_ids=ballIds;
 for(let i=1;i<600;i++){const r=call(hit());assert.equal(r.clicks,i);assert.equal(r.reward,'0');}
 assert.equal(call(hit()).reward,'10000000000');
 p.state.hammer_owned=true;p.state.hammer_level=10;p.state.rebirths=2;p.state.honey_expires_at=new Date(Date.now()+60000).toISOString();
 s.gold_event={multiplier:10,starts_at:new Date(Date.now()-1000).toISOString(),ends_at:new Date(Date.now()+60000).toISOString()};
 for(let i=1;i<=4;i++)assert.equal(call(hit()).reward,'0');
 const final=hit(),r=call(final);assert.equal(r.reward,'800000000000');assert.deepEqual(call(final),r);
 assert.equal(call(hit()).clicks,135);
 p.state.hammer_level=30;
 assert.equal(call(hit()).clicks,600);
 execute(s,admin,{action:'admin_ball_event',mode:'stop'});assert.throws(()=>call(final));
 assert.equal(s.logs.at(-1).action,'admin_ball_event');
});
