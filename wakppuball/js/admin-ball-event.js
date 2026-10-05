(() => {
  let snapshot=null,serverTime=0,received=0,lastPhase='idle',lastId=null;
  const clock=()=>performance.now();
  function current(){
    const elapsed=clock()-received,now=serverTime+elapsed;
    if(!snapshot||elapsed>12000||!Number.isFinite(now)||now>=Date.parse(snapshot.ends_at))return {phase:'idle',event:null};
    return {phase:now<Date.parse(snapshot.starts_at)?'scheduled':'active',event:snapshot,seconds:Math.max(0,Math.ceil((Date.parse(snapshot.ends_at)-now)/1000))};
  }
  function render(){
    const s=current(),banner=document.getElementById('adminBallEventBanner'),info=document.getElementById('adminBallEventInfo');
    const text=s.phase==='active'?`👑 관리자 왁뿌볼 이벤트 · 남은 시간 ${s.seconds}초 · 도감에서 선택 가능`:s.phase==='scheduled'?'👑 관리자 왁뿌볼 이벤트 시작 대기 중':'현재 관리자 왁뿌볼 이벤트가 없습니다.';
    if(banner){banner.hidden=s.phase!=='active';banner.textContent=text;}
    if(info)info.textContent=text;
    const start=document.getElementById('adminBallEventStart'),stop=document.getElementById('adminBallEventStop');
    if(start)start.disabled=s.phase!=='idle';if(stop)stop.disabled=s.phase==='idle';
    if(lastPhase!==s.phase||lastId!==s.event?.id){lastPhase=s.phase;lastId=s.event?.id;window.dispatchEvent(new CustomEvent('wakppu-admin-ball-event',{detail:s}));}
  }
  window.WakppuAdminBallEvent={current,update(data){
    const t=Date.parse(data.server_time),e=data.admin_ball_event;
    snapshot=Number.isFinite(t)&&e?.id&&Number.isFinite(Date.parse(e.starts_at))&&Date.parse(e.ends_at)>Date.parse(e.starts_at)?e:null;
    serverTime=t;received=clock();render();
  }};
  setInterval(render,250);
})();
