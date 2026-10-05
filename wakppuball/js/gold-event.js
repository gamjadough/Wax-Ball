(function(root){
  'use strict';
  function phase(event,now){
    const start=Date.parse(event?.starts_at),end=Date.parse(event?.ends_at);
    if(!event||event.multiplier!==10||!Number.isFinite(start)||end-start!==60000||now>=end)return {phase:'idle',multiplier:1,seconds:0};
    return now<start?{phase:'scheduled',multiplier:1,seconds:Math.ceil((start-now)/1000)}:{phase:'active',multiplier:10,seconds:Math.ceil((end-now)/1000)};
  }
  let snapshot=null,serverTime=0,received=0;
  const clock=()=>root.performance?.now?.()??Date.now();
  function current(){const elapsed=clock()-received;return elapsed>=0&&elapsed<=12000?phase(snapshot,serverTime+elapsed):{phase:'idle',multiplier:1,seconds:0};}
  function render(){
    if(!root.document)return;
    const state=current(),banner=document.getElementById('goldEventBanner'),info=document.getElementById('adminGoldEventInfo');
    const text=state.phase==='scheduled'?`🎉 관리자 골드 타임! ${state.seconds}초 후 시작 · Gold ×10, 60초`:state.phase==='active'?`🎉 관리자 골드 타임! Gold ×10 · 남은 시간 ${String(Math.floor(state.seconds/60)).padStart(2,'0')}:${String(state.seconds%60).padStart(2,'0')}`:'현재 진행 중인 이벤트가 없습니다.';
    if(banner){banner.hidden=state.phase==='idle';banner.textContent=text;banner.dataset.phase=state.phase;}
    if(info)info.textContent=text;
    const start=document.getElementById('adminGoldEventStart'),stop=document.getElementById('adminGoldEventStop');
    if(start)start.disabled=state.phase!=='idle';if(stop)stop.disabled=state.phase==='idle';
  }
  root.WakppuGoldEvent={phase,current,multiplier:()=>current().multiplier,update(data){
    const time=Date.parse(data.server_time);
    snapshot=Number.isFinite(time)?data.gold_event:null;serverTime=time;received=clock();render();
  }};
  if(root.document)setInterval(render,250);
})(typeof window==='undefined'?globalThis:window);
