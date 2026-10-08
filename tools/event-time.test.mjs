import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import '../wakppuball/js/event-time.js';
const format=globalThis.WakppuEventTime.format;
test('duration units and exact boundaries without zero components',()=>{
 for(const [n,text] of [[0,'0초'],[45,'45초'],[59,'59초'],[60,'1분'],[125,'2분 5초'],[3599,'59분 59초'],[3600,'1시간'],[7230,'2시간 30초'],[86400,'1일'],[183845,'2일 3시간 4분 5초'],[31536000,'365일'],[-1,'0초'],[NaN,'0초'],[0.1,'1초']])assert.equal(format(n),text);
});
test('both player banners: scheduled start, active expiry, stale response and idle',()=>{
 const elements=Object.fromEntries(['goldEventBanner','adminGoldEventInfo','adminBallEventBanner','adminBallEventInfo'].map(id=>[id,{hidden:true,dataset:{},textContent:''}]));
 let clock=0;
 const ctx={document:{getElementById:id=>elements[id]||null},performance:{now:()=>clock},setInterval:()=>{},dispatchEvent:()=>{},CustomEvent:class{}};ctx.window=ctx;
 vm.createContext(ctx);
 for(const name of ['event-time','gold-event','admin-ball-event'])vm.runInContext(readFileSync(new URL('../wakppuball/js/'+name+'.js',import.meta.url),'utf8'),ctx);
 const now=Date.parse('2026-10-08T00:00:00Z'),start=now+183845000,end=start+125000;
 const event={id:'test',multiplier:10,starts_at:new Date(start).toISOString(),ends_at:new Date(end).toISOString()};
 const update=time=>{const data={gold_event:event,admin_ball_event:event,server_time:new Date(time).toISOString()};ctx.WakppuGoldEvent.update(data);ctx.WakppuAdminBallEvent.update(data);};
 update(now);
 for(const id of ['goldEventBanner','adminBallEventBanner']){
  assert.equal(elements[id].hidden,false);assert.match(elements[id].textContent,/2일 3시간 4분 5초 후 시작/);
 }
 assert.match(elements.goldEventBanner.textContent,/2분 5초 진행/);
 assert.equal(ctx.WakppuAdminBallEvent.current().seconds,183845);
 update(start);
 assert.equal(ctx.WakppuGoldEvent.multiplier(),10);
 for(const id of ['goldEventBanner','adminBallEventBanner'])assert.match(elements[id].textContent,/남은 시간 2분 5초/);
 ctx.WakppuAdminBallEvent.update({admin_ball_event:null,server_time:new Date(start-1).toISOString()});
 assert.equal(ctx.WakppuAdminBallEvent.current().phase,'active');
 update(end-1000);clock=1000;
 assert.equal(ctx.WakppuGoldEvent.multiplier(),1);assert.equal(ctx.WakppuAdminBallEvent.current().phase,'idle');
 clock=0;update(end);
 assert.equal(elements.goldEventBanner.hidden,true);assert.equal(elements.adminBallEventBanner.hidden,true);
});
