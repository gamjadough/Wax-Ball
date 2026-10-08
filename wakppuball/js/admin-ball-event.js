(() => {
  let snapshot=null,serverTime=0,received=0,lastPhase='idle',lastId=null,always=false,lastAlways=false;
  const clock=()=>performance.now();
  function current(){
    const elapsed=clock()-received,now=serverTime+elapsed;
    if(!snapshot||elapsed>12000||!Number.isFinite(now)||now>=Date.parse(snapshot.ends_at))return {phase:'idle',event:null};
    const scheduled=now<Date.parse(snapshot.starts_at);
    return {phase:scheduled?'scheduled':'active',event:snapshot,seconds:Math.max(0,Math.ceil((Date.parse(scheduled?snapshot.starts_at:snapshot.ends_at)-now)/1000))};
  }
  function render(){
    const s=current(),banner=document.getElementById('adminBallEventBanner'),info=document.getElementById('adminBallEventInfo');
    const text=s.phase==='active'?`👑 관리자 왁뿌볼 이벤트 · 남은 시간 ${window.WakppuEventTime.format(s.seconds)} · 도감에서 선택 가능`:s.phase==='scheduled'?`👑 관리자 왁뿌볼 이벤트 · ${window.WakppuEventTime.format(s.seconds)} 후 시작`:'현재 관리자 왁뿌볼 이벤트가 없습니다.';
    if(banner){banner.hidden=s.phase==='idle';banner.textContent=text;banner.dataset.phase=s.phase;}
    if(info)info.textContent=text;
    const start=document.getElementById('adminBallEventStart'),stop=document.getElementById('adminBallEventStop');
    if(start)start.disabled=s.phase!=='idle';if(stop)stop.disabled=s.phase==='idle';
    if(lastPhase!==s.phase||lastId!==s.event?.id||lastAlways!==always){lastPhase=s.phase;lastId=s.event?.id;lastAlways=always;window.dispatchEvent(new CustomEvent('wakppu-admin-ball-event',{detail:s}));}
  }
  window.WakppuAdminBallEvent={current,alwaysAvailable:()=>always,update(data){
    const t=Date.parse(data.server_time),e=data.admin_ball_event;
    if(!Number.isFinite(t)||!Object.prototype.hasOwnProperty.call(data,'admin_ball_event'))return;
    // A status request issued before Start/Stop can finish after the mutation response.
    if(Number.isFinite(t)&&t<serverTime)return;
    if(Object.prototype.hasOwnProperty.call(data,'admin_ball_always'))always=data.admin_ball_always===true;
    snapshot=Number.isFinite(t)&&e?.id&&Number.isFinite(Date.parse(e.starts_at))&&Date.parse(e.ends_at)>Date.parse(e.starts_at)?e:null;
    serverTime=t;received=clock();render();
  }};
  setInterval(render,250);
})();
