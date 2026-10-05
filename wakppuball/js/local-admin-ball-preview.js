// Only injected by the loopback server; real accounts and production services are never used.
window.WakppuLocalAdminBallPreview=async password=>{
  if(!WakppuAuth.local)return;
  document.body.classList.add('local-admin-ball-preview');
  const panel=document.createElement('div');panel.className='admin-ball-preview';
  panel.innerHTML='<p>로컬 관리자 볼 이벤트 · 운영 계정과 무관 · 기본 보상 150,000,000G</p>';
  const note=panel.querySelector('p');document.body.append(panel);
  let preparing=false;
  async function prepare(mode){
    if(preparing)return;preparing=true;
    try{
      const login=await WakppuAuth.signIn('dodoonglee@gmail.com',password);if(login.error)throw login.error;
      await WakppuAuth.invoke('admin_ball_event',{mode:'stop'});
      const {state:s}=await WakppuAuth.invoke('bootstrap');
      const ids=WAKPPU_BALLS.map(b=>b.id),boost=mode==='boost';
      await WakppuAuth.invoke('save_progress',{...s,gold:'0',rebirths:boost?2:0,unlocked_ball_ids:ids,discovered_ball_ids:ids,selected_ball_id:'whitehole',hammer_owned:mode!=='manual',hammer_level:mode==='manual'?0:10,honey_expires_at:boost?new Date(Date.now()+600000).toISOString():null});
      await WakppuAuth.invoke('admin_gold_event',{mode:'stop'});
      if(boost)await WakppuAuth.invoke('admin_gold_event',{mode:'start',multiplier:10,duration_seconds:300,delay_seconds:0});
      await WakppuGameTest.restoreAccount();
      await WakppuAuth.invoke('admin_ball_event',{mode:'start',duration_seconds:300,delay_seconds:0});
      const status=await WakppuAuth.invoke('status');WakppuGoldEvent.update(status);WakppuAdminBallEvent.update(status);
      note.textContent=boost?'배율 테스트 · 풀업 망치 5번 · 보상 12,000,000,000G':'로컬 이벤트 · '+(mode==='manual'?'맨손 600회':'풀업 망치 5번')+' · 보상 150,000,000G';
    }catch(error){note.textContent=error.message;}
    finally{preparing=false;}
  }
  for(const [mode,label] of [['hammer','풀업 망치 5번'],['manual','맨손 600회'],['boost','환생·꿀·골드 배율 테스트']]){
    const b=document.createElement('button');b.className='btn small';b.textContent=label;b.onclick=()=>prepare(mode);panel.append(b);
  }
  const stop=document.createElement('button');stop.className='btn small';stop.textContent='이벤트 종료';stop.onclick=async()=>{await WakppuAuth.invoke('admin_ball_event',{mode:'stop'});WakppuAdminBallEvent.update(await WakppuAuth.invoke('status'));};panel.append(stop);
  await prepare('hammer');
};
