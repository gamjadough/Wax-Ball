(() => {
  const $=id=>document.getElementById(id);let target=null,selectedPlayer=null,selectionVersion=0,searchVersion=0;
  const playerActionIds=['adminSetGold','adminSetRebirths','adminHideRanking','adminShowRanking','adminBan','adminUnban','adminUnlock','adminUnlockAll','adminDiscover','adminDiscoverAll','adminResetOne','adminResetAll'];
  const playerResults=new Map();
  const selectionStatus=document.createElement('p');
  selectionStatus.id='adminSelectionStatus';selectionStatus.className='admin-selection-status';selectionStatus.setAttribute('role','status');
  $('admin').querySelector('.sheet-head').after(selectionStatus);
  function syncSelection(){
    const m=selectedPlayer?.moderation||{};
    const banned=m.status==='banned'||(m.status==='suspended'&&(!m.suspended_until||new Date(m.suspended_until).getTime()>Date.now()));
    selectionStatus.textContent=selectedPlayer?`선택 대상: ${selectedPlayer.nickname}`:'선택 대상 없음 · 목록에서 플레이어를 선택하세요.';
    for(const id of playerActionIds)$(id).disabled=pending||!target;
    if(target){
      $('adminHideRanking').disabled=pending||!!selectedPlayer.ranking_hidden;
      $('adminShowRanking').disabled=pending||!selectedPlayer.ranking_hidden;
      $('adminUnban').disabled=pending||!banned;
    }
    for(const button of $('adminResults').querySelectorAll('button')){
      button.setAttribute('aria-pressed',String(button.dataset.playerId===target));button.disabled=pending;
    }
  }
  function clearSelection(){
    target=null;selectedPlayer=null;selectionVersion++;
    $('adminPlayerInfo').textContent='검색 결과에서 대상을 선택하세요.';
    $('adminModerationReason').value='';syncSelection();
  }
  const ANNOUNCEMENT_DISMISS_KEY='wakppuball:dismissed-announcement';
  let activeAnnouncementId=null;
  function announcementId(announcement){
    return String(announcement.id??announcement.updated_at??announcement.created_at??announcement.message);
  }
  function renderAnnouncement(announcement){
    const bar=$('serverAnnouncement');
    if(!announcement?.message){activeAnnouncementId=null;bar.hidden=true;return;}
    const id=announcementId(announcement);
    activeAnnouncementId=id;
    $('serverAnnouncementText').textContent=announcement.message;
    try{bar.hidden=localStorage.getItem(ANNOUNCEMENT_DISMISS_KEY)===id;}catch(_){bar.hidden=false;}
  }
  $('serverAnnouncementClose').onclick=()=>{
    if(activeAnnouncementId)try{localStorage.setItem(ANNOUNCEMENT_DISMISS_KEY,activeAnnouncementId);}catch(_){}
    $('serverAnnouncement').hidden=true;
  };
  function status(message){$('adminStatus').textContent=message;}
  const eventTimeFields=new Map();
  function timeSeconds(id){
    const {input,unit} = eventTimeFields.get(id),raw=input.value.trim();
    const value=Number(raw)*(unit.value==='minutes'?60:1),seconds=Math.round(value);
    return raw!==''&&Number.isFinite(value)&&Math.abs(value-seconds)<1e-7&&seconds>=Number(input.dataset.minSeconds)&&seconds<=86400?seconds:null;
  }
  function eventTimes(durationId,delayId){
    const duration_seconds=timeSeconds(durationId),delay_seconds=timeSeconds(delayId);
    for(const id of [durationId,delayId])if(timeSeconds(id)===null){status('진행 시간은 1초~24시간, 대기는 0초~24시간으로 입력하세요. 분 단위 소수는 초로 환산했을 때 정수여야 합니다.');$(id).focus();return null;}
    return {duration_seconds,delay_seconds};
  }
  for(const [durationId,delayId] of [['adminBallEventDuration','adminBallEventDelay'],['adminEventDuration','adminEventDelay']]){
    const preview=document.createElement('p');preview.id=durationId+'Preview';preview.setAttribute('role','status');
    $(delayId).parentElement.after(preview);
    const updatePreview=()=>{
      const duration=timeSeconds(durationId),delay=timeSeconds(delayId);
      if(duration===null||delay===null){preview.textContent='진행 1초~24시간 · 대기 0초~24시간 (0이면 즉시 시작)';return;}
      const label=id=>{const f=eventTimeFields.get(id);return f.input.value+(f.unit.value==='minutes'?'분':'초')+' = '+timeSeconds(id).toLocaleString('ko-KR')+'초';};
      const end=new Date(Date.now()+(duration+delay)*1000).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});
      preview.textContent='진행 '+label(durationId)+' · 대기 '+label(delayId)+' · 지금 시작 시 예상 종료 '+end+' (한국 시간)';
    };
    for(const id of [durationId,delayId]){
      const input=$(id),label=input.parentElement,isDelay=id===delayId;
      label.firstChild.textContent=isDelay?'시작 전 대기 시간':'진행 시간';
      input.dataset.minSeconds=isDelay?'0':'1';input.step='any';input.value=String(Number(input.value)/60);input.min=isDelay?'0':String(1/60);input.max='1440';
      const unit=document.createElement('select');unit.id=id+'Unit';unit.setAttribute('aria-label',(isDelay?'시작 전 대기':'진행')+' 시간 단위');
      unit.append(new Option('분','minutes'),new Option('초','seconds'));label.append(unit);
      eventTimeFields.set(id,{input,unit});let previousUnit='minutes';
      unit.addEventListener('change',()=>{if(input.value.trim()!==''&&Number.isFinite(Number(input.value)))input.value=String(Number((Number(input.value)*(previousUnit==='minutes'?60:1)/(unit.value==='minutes'?60:1)).toPrecision(15)));previousUnit=unit.value;input.min=isDelay?'0':unit.value==='minutes'?String(1/60):'1';input.max=unit.value==='minutes'?'1440':'86400';input.step=unit.value==='minutes'?'any':'1';updatePreview();});
      input.addEventListener('input',updatePreview);
    }
    updatePreview();
    $('admin').addEventListener('click',updatePreview);
    $('adminBtn').addEventListener('click',updatePreview);
  }
  function info(player){
    if(target!==player.id){selectionVersion++;$('adminModerationReason').value='';}
    target=player.id;
    selectedPlayer=player;
    playerResults.set(player.id,player);
    const m=player.moderation||{};
    const until=m.suspended_until?new Date(m.suspended_until):null;
    const banned=m.status==='banned'||(m.status==='suspended'&&(!until||until.getTime()>Date.now()));
    const state=m.status==='banned'?'영구 밴':banned?'기간제 밴':m.status==='suspended'?'정상 (밴 기간 만료)':'정상';
    $('adminPlayerInfo').textContent=`${player.nickname}\nUser ID: ${player.id}\nGold: ${WakppuGold.integer(player.state.gold).toLocaleString('ko-KR')}G · 환생: ${player.state.rebirths}회\n해금: ${player.state.unlocked_ball_ids.join(', ')}\n도감: ${(player.state.discovered_ball_ids||[]).join(', ')}\n랭킹: ${player.ranking_hidden?'숨김':'표시'}${banned?' (밴으로 제외됨)':''}\n이용 상태: ${state}\n종료: ${until?until.toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+' (한국 시간)':banned?'기한 없음':'—'}\n사유: ${m.last_reason||'—'}`;
    syncSelection();
  }
  let pending=false;
  async function call(action,payload={}){if(pending)return null;const version=selectionVersion;pending=true;syncSelection();try{const result=await window.WakppuAuth.invoke(action,payload);if(result.target&&version===selectionVersion&&result.target.id===target)info(result.target);status('완료했습니다.');return result;}catch(e){status(e.message);return null;}finally{pending=false;syncSelection();}}
  let refreshing=false;
  async function refresh(){
    if(refreshing||!window.WakppuAuth)return;
    refreshing=true;
    try{
      const result=await window.WakppuAuth.invoke('status');
      window.WakppuGoldEvent.update(result);
      window.WakppuAdminBallEvent.update(result);
      $('adminBtn').hidden=result.role!=='admin';
      if($('adminBtn').hidden){$('admin').hidden=true;clearSelection();}
      const wasBlocked=window.wakppuServerBlocked;
      const banned=result.moderation?.blocked===true;
      window.wakppuServerBlocked=banned||(result.maintenance&&result.role!=='admin');
      $('game').hidden=window.wakppuServerBlocked;
      $('maintenance').hidden=!$('game').hidden;
      $('maintenanceTitle').textContent=banned?'계정 이용 제한':'왁뿌볼 패치 중';
      $('maintenanceDescription').textContent=banned?'이 계정은 현재 플레이와 저장이 제한되어 있습니다.':'현재 게임이 업데이트 중입니다. 잠시 후 다시 접속해주세요.';
      $('maintenanceLogin').textContent=banned?'계정 관리':'관리자 로그인';
      const until=result.moderation?.suspended_until;
      document.querySelector('.maintenance-note').textContent=banned
        ? `사유: ${result.moderation.last_reason||'관리자 제재'}\n종료: ${until?new Date(until).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+' (한국 시간)':'영구 밴'}`
        : result.message||'잠시 후 다시 접속해주세요.';
      renderAnnouncement(result.announcement);
      $('adminClearAnnouncement').disabled=!result.announcement;
      if(!window.wakppuServerBlocked&&(wasBlocked||(result.admin_revision!=null&&result.admin_revision!==WakppuGameTest.revision())))await WakppuGameTest.restoreAccount();
    }catch(_){$('adminBtn').hidden=true;$('admin').hidden=true;clearSelection();}
    finally{refreshing=false;}
  }
  $('adminBallEventStart').onclick=async()=>{
    const times=eventTimes('adminBallEventDuration','adminBallEventDelay');if(!times)return;
    const {duration_seconds,delay_seconds}=times;
    const result=await call('admin_ball_event',{mode:'start',duration_seconds,delay_seconds});
    if(result){window.WakppuAdminBallEvent.update(result);await refresh();status('관리자 왁뿌볼 이벤트를 설정했습니다.');}
  };
  $('adminBallEventStop').onclick=async()=>{const result=await call('admin_ball_event',{mode:'stop'});if(result){window.WakppuAdminBallEvent.update(result);await refresh();status('관리자 왁뿌볼 이벤트를 종료했습니다.');}};
  $('adminBall').replaceChildren(...WAKPPU_BALLS.map(b=>new Option(b.name,b.id)));
  $('adminGold').type='text';$('adminGold').inputMode='numeric';$('adminGold').maxLength=1000;
  $('adminQuery').placeholder='닉네임 또는 User ID';
  function render(players){
    playerResults.clear();for(const player of players)playerResults.set(player.id,player);
    $('adminResults').replaceChildren(...players.map(p=>{const b=document.createElement('button');b.className='btn small admin-player';b.type='button';b.textContent=p.nickname;b.dataset.playerId=p.id;b.title=p.nickname;b.setAttribute('aria-pressed','false');b.onclick=()=>{if(!pending)info(playerResults.get(p.id));};return b;}));
    if(!players.length){const empty=document.createElement('p');empty.className='admin-results-empty';empty.textContent='검색 결과가 없습니다.';$('adminResults').append(empty);}
    syncSelection();
  }
  function invalidateSearch(){searchVersion++;clearSelection();playerResults.clear();$('adminResults').replaceChildren();}
  async function search(){
    invalidateSearch();const version=searchVersion;
    const result=await call('admin_search',{query:$('adminQuery').value.trim()});
    if(result&&version===searchVersion)render(result);
  }
  $('adminBtn').onclick=async()=>{if(pending)return;$('adminQuery').value='';$('admin').hidden=false;await search();};
  $('adminQuery').addEventListener('input',()=>{invalidateSearch();status('검색을 눌러 목록을 갱신하세요.');});
  $('adminQuery').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();search();}});
  $('adminSearch').onclick=search;
  function targetDescription(){return `“${selectedPlayer.nickname}” (User ID: ${target})`;}
  function bind(id,action,payload,confirmMessage){$(id).onclick=async()=>{if(pending)return;const playerAction=action!=='admin_maintenance'&&action!=='admin_announcement';if(playerAction&&!target)return status('먼저 플레이어를 선택하세요.');const userId=target;if(playerAction){if(!confirm(`대상: ${targetDescription()}\n${confirmMessage||$(id).textContent+' 작업을 적용하시겠습니까?'}`))return;}else if(confirmMessage&&!confirm(confirmMessage))return;await call(action,{user_id:userId,...payload()});await refresh();};}
  bind('adminMaintenanceOn','admin_maintenance',()=>({enabled:true,message:$('adminMaintenanceMessage').value}),'점검 모드를 켜시겠습니까?');
  bind('adminMaintenanceOff','admin_maintenance',()=>({enabled:false}));
  bind('adminAnnounce','admin_announcement',()=>({message:$('adminAnnouncement').value}));
  $('adminClearAnnouncement').onclick=async()=>{
    const result=await call('admin_announcement',{clear:true});
    if(result){$('adminAnnouncement').value='';await refresh();status('공지를 내렸습니다.');}
  };
  bind('adminSetGold','admin_gold',()=>({mode:$('adminChangeMode').value,value:$('adminGold').value.trim()}),'선택한 플레이어의 Gold를 변경하시겠습니까?');
  $('adminGoldEventStart').onclick=async()=>{
    const fields=[['adminEventMultiplier',1,1000]];
    for(const [id,min,max] of fields){const input=$(id),value=Number(input.value);if(input.value.trim()===''||!Number.isInteger(value)||value<min||value>max){status('배율과 시간은 표시된 범위의 정수로 입력하세요.');input.reportValidity();input.focus();return;}}
    const times=eventTimes('adminEventDuration','adminEventDelay');if(!times)return;
    const multiplier=Number($('adminEventMultiplier').value),{duration_seconds,delay_seconds}=times;
    if(!confirm(`모든 플레이어에게 ${delay_seconds}초 대기 후 Gold ×${multiplier} 이벤트를 ${duration_seconds}초간 진행하시겠습니까?`))return;
    const result=await call('admin_gold_event',{mode:'start',multiplier,duration_seconds,delay_seconds});
    if(result){window.WakppuGoldEvent.update(result);await refresh();status(`Gold ×${multiplier} 이벤트를 설정했습니다. 대기 ${delay_seconds}초 · 진행 ${duration_seconds}초`);}
  };
  $('adminGoldEventStop').onclick=async()=>{
    if(!confirm('예고/진행 중인 전체 골드 이벤트를 즉시 종료하시겠습니까?'))return;
    if(await call('admin_gold_event',{mode:'stop'})){await refresh();status('전체 골드 이벤트를 종료했습니다.');}
  };
  bind('adminSetRebirths','admin_rebirths',()=>({mode:$('adminChangeMode').value,value:Number($('adminRebirths').value)}),'선택한 플레이어의 환생 횟수를 변경하시겠습니까?');
  bind('adminUnban','admin_unban',()=>({}));
  bind('adminHideRanking','admin_ranking_visibility',()=>({hidden:true,reason:$('adminModerationReason').value.trim()}),'선택한 플레이어를 랭킹에서 숨기시겠습니까?');
  bind('adminShowRanking','admin_ranking_visibility',()=>({hidden:false,reason:$('adminModerationReason').value.trim()}));
  $('adminBan').onclick=async()=>{
    if(pending)return;
    if(!target)return status('먼저 플레이어를 선택하세요.');
    const reason=$('adminModerationReason').value.trim();
    if(!reason)return status('밴 사유를 입력하세요.');
    const duration=$('adminBanDuration').value;
    const userId=target;
    if(!confirm(`대상: ${targetDescription()}\n${duration==='permanent'?'영구 밴':$('adminBanDuration').selectedOptions[0].textContent+' 밴'}을 적용하시겠습니까?\n사유: ${reason}`))return;
    await call('admin_ban',{user_id:userId,reason,mode:duration==='permanent'?'permanent':'temporary',duration_hours:duration==='permanent'?null:Number(duration)});
    await refresh();
  };
  for(const [id,action,mode] of [['adminUnlock','admin_unlock','one'],['adminUnlockAll','admin_unlock','all'],['adminDiscover','admin_discovery','one'],['adminDiscoverAll','admin_discovery','all'],['adminResetOne','admin_discovery','reset_one'],['adminResetAll','admin_discovery','reset_all']])bind(id,action,()=>({mode,ball_id:$('adminBall').value}),mode==='reset_all'?'선택한 플레이어의 전체 도감 발견 상태를 초기화하시겠습니까?':null);
  async function test(mode){const result=await call('admin_test',{ball_id:$('adminBall').value});if(result){window.WakppuGameTest.run(mode,result.ball_id,Number($('adminHoneySeconds').value));$('admin').hidden=true;}}
  $('adminTestBall').onclick=()=>test('ball');$('adminTestLast').onclick=()=>test('last');$('adminTestBreak').onclick=()=>test('break');$('adminTestHoney').onclick=()=>test('honey');$('adminEndTest').onclick=()=>{window.WakppuGameTest.end();status('실제 진행도를 복원했습니다.');};
  $('adminLoadLogs').onclick=async()=>{const logs=await call('admin_logs');if(logs)$('adminLogs').textContent=JSON.stringify(logs,null,2);};
  clearSelection();
  window.addEventListener('wakppu-auth-changed',invalidateSearch);
  window.addEventListener('wakppu-account-restored',refresh);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  window.addEventListener('focus',refresh);setInterval(refresh,3000);refresh();
})();
