(() => {
  let snapshot=null,manual=null,serverTime=0,received=0,lastPhase='idle',lastId=null,always=false,lastAlways=false;
  const clock=()=>performance.now();
  function current(event=snapshot){
    const elapsed=clock()-received,now=serverTime+elapsed;
    if(!event||elapsed>12000||!Number.isFinite(now)||now>=Date.parse(event.ends_at))return {phase:'idle',event:null};
    const scheduled=now<Date.parse(event.starts_at);
    return {phase:scheduled?'scheduled':'active',event,seconds:Math.max(0,Math.ceil((Date.parse(scheduled?event.starts_at:event.ends_at)-now)/1000))};
  }
  function render(){
    const gameplay=current(),s=current(manual),banner=document.getElementById('adminBallEventBanner'),info=document.getElementById('adminBallEventInfo');
    const title='👑 관리자 특별 이벤트 · 왁뿌볼';
    const text=s.phase==='active'?`${title} · 남은 시간 ${window.WakppuEventTime.format(s.seconds)} · 도감에서 선택 가능`:s.phase==='scheduled'?`${title} · ${window.WakppuEventTime.format(s.seconds)} 후 시작`:'현재 관리자 왁뿌볼 이벤트가 없습니다.';
    if(banner){banner.hidden=s.phase==='idle';banner.textContent=text;banner.dataset.phase=s.phase;banner.dataset.source='manual';}
    if(info)info.textContent=text;
    const start=document.getElementById('adminBallEventStart'),stop=document.getElementById('adminBallEventStop');
    if(start)start.disabled=s.phase!=='idle';if(stop)stop.disabled=s.phase==='idle';
    if(lastPhase!==gameplay.phase||lastId!==gameplay.event?.id||lastAlways!==always){lastPhase=gameplay.phase;lastId=gameplay.event?.id;lastAlways=always;window.dispatchEvent(new CustomEvent('wakppu-admin-ball-event',{detail:gameplay}));}
  }
  window.WakppuAdminBallEvent={current,alwaysAvailable:()=>always,update(data){
    const t=Date.parse(data.server_time),e=data.admin_ball_event;
    if(!Number.isFinite(t)||!Object.prototype.hasOwnProperty.call(data,'admin_ball_event'))return;
    // A status request issued before Start/Stop can finish after the mutation response.
    if(Number.isFinite(t)&&t<serverTime)return;
    if(Object.prototype.hasOwnProperty.call(data,'admin_ball_always'))always=data.admin_ball_always===true;
    snapshot=Number.isFinite(t)&&e?.id&&Number.isFinite(Date.parse(e.starts_at))&&Date.parse(e.ends_at)>Date.parse(e.starts_at)?e:null;
    manual=Object.prototype.hasOwnProperty.call(data,'manual_ball_event')?data.manual_ball_event:(snapshot?.source==='weekly'?null:snapshot);serverTime=t;received=clock();render();
  }};
  setInterval(render,250);
})();
