(function(root){
  'use strict';
  function phase(event,now){
    const start=Date.parse(event?.starts_at),end=Date.parse(event?.ends_at);
    if(!event||!Number.isInteger(event.multiplier)||event.multiplier<1||event.multiplier>1000||!Number.isFinite(start)||!Number.isFinite(end)||end-start<1000||end-start>86400000||now>=end)return {phase:'idle',multiplier:1,seconds:0};
    return now<start?{phase:'scheduled',multiplier:1,seconds:Math.ceil((start-now)/1000)}:{phase:'active',multiplier:event.multiplier,seconds:Math.ceil((end-now)/1000)};
  }
  let snapshot=null,manual=null,serverTime=0,received=0;
  const clock=()=>root.performance?.now?.()??Date.now();
  function current(event=snapshot){const elapsed=clock()-received;return elapsed>=0&&elapsed<=12000?phase(event,serverTime+elapsed):{phase:'idle',multiplier:1,seconds:0};}
  function render(){
    if(!root.document)return;
    const state=current(manual),banner=document.getElementById('goldEventBanner'),info=document.getElementById('adminGoldEventInfo');
    const duration=Math.round((Date.parse(manual?.ends_at)-Date.parse(manual?.starts_at))/1000);
    const title='👑 관리자 특별 이벤트 · 골드 타임';
    const text=state.phase==='scheduled'?`${title} · ${root.WakppuEventTime.format(state.seconds)} 후 시작 · Gold ×${manual.multiplier}, ${root.WakppuEventTime.format(duration)} 진행`:state.phase==='active'?`${title} · Gold ×${state.multiplier} · 남은 시간 ${root.WakppuEventTime.format(state.seconds)}`:'현재 진행 중인 이벤트가 없습니다.';
    if(banner){banner.hidden=state.phase==='idle';banner.textContent=text;banner.dataset.phase=state.phase;banner.dataset.source='manual';}
    if(info)info.textContent=text;
    const start=document.getElementById('adminGoldEventStart'),stop=document.getElementById('adminGoldEventStop');
    if(start)start.disabled=state.phase!=='idle';if(stop)stop.disabled=state.phase==='idle';
  }
  root.WakppuGoldEvent={phase,current,multiplier:()=>current().multiplier,update(data){
    const time=Date.parse(data.server_time);
    if(Number.isFinite(time)&&time<serverTime)return;
    snapshot=Number.isFinite(time)?data.gold_event:null;manual=Object.prototype.hasOwnProperty.call(data,'manual_gold_event')?data.manual_gold_event:(snapshot?.source==='weekly'?null:snapshot);serverTime=time;received=clock();render();
  }};
  if(root.document)setInterval(render,250);
})(typeof window==='undefined'?globalThis:window);
