(() => {
  const $=id=>document.getElementById(id);let target=null;
  function status(message){$('adminStatus').textContent=message;}
  function info(player){
    target=player.id;
    const m=player.moderation||{};
    const until=m.suspended_until?new Date(m.suspended_until):null;
    const banned=m.status==='banned'||(m.status==='suspended'&&(!until||until.getTime()>Date.now()));
    const state=m.status==='banned'?'영구 밴':banned?'기간제 밴':m.status==='suspended'?'정상 (밴 기간 만료)':'정상';
    $('adminPlayerInfo').textContent=`${player.nickname}\nUser ID: ${player.id}\nGold: ${WakppuGold.integer(player.state.gold).toLocaleString('ko-KR')}G · 환생: ${player.state.rebirths}회\n해금: ${player.state.unlocked_ball_ids.join(', ')}\n도감: ${(player.state.discovered_ball_ids||[]).join(', ')}\n랭킹: ${player.ranking_hidden?'숨김':'표시'}${banned?' (밴으로 제외됨)':''}\n이용 상태: ${state}\n종료: ${until?until.toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+' (한국 시간)':banned?'기한 없음':'—'}\n사유: ${m.last_reason||'—'}`;
    $('adminHideRanking').disabled=!!player.ranking_hidden;
    $('adminShowRanking').disabled=!player.ranking_hidden;
    $('adminUnban').disabled=!banned;
  }
  let pending=false;
  async function call(action,payload={}){if(pending)return null;pending=true;try{const result=await window.WakppuAuth.invoke(action,payload);if(result.target)info(result.target);status('완료했습니다.');return result;}catch(e){status(e.message);return null;}finally{pending=false;}}
  let refreshing=false;
  async function refresh(){
    if(refreshing||!window.WakppuAuth)return;
    refreshing=true;
    try{
      const result=await window.WakppuAuth.invoke('status');
      window.WakppuGoldEvent.update(result);
      $('adminBtn').hidden=result.role!=='admin';
      if($('adminBtn').hidden)$('admin').hidden=true;
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
      $('serverAnnouncement').hidden=!result.announcement;
      $('serverAnnouncement').textContent=result.announcement?.message||'';
      $('adminClearAnnouncement').disabled=!result.announcement;
      if(!window.wakppuServerBlocked&&(wasBlocked||(result.admin_revision!=null&&result.admin_revision!==WakppuGameTest.revision())))await WakppuGameTest.restoreAccount();
    }catch(_){$('adminBtn').hidden=true;$('admin').hidden=true;}
    finally{refreshing=false;}
  }
  $('adminBall').replaceChildren(...WAKPPU_BALLS.map(b=>new Option(b.name,b.id)));
  $('adminGold').type='text';$('adminGold').inputMode='numeric';$('adminGold').maxLength=19;
  $('adminQuery').placeholder='닉네임 또는 User ID';
  $('adminBtn').onclick=async()=>{const result=await call('admin_search',{query:''});if(result){$('admin').hidden=false;render(result);}};
  function render(players){$('adminResults').replaceChildren(...players.map(p=>{const b=document.createElement('button');b.className='btn small';b.textContent=`${p.nickname} · ${p.id}`;b.onclick=()=>info(p);return b;}));}
  $('adminSearch').onclick=async()=>{const result=await call('admin_search',{query:$('adminQuery').value});if(result)render(result);};
  function bind(id,action,payload,confirmMessage){$(id).onclick=async()=>{if(action!=='admin_maintenance'&&action!=='admin_announcement'&&!target)return status('먼저 플레이어를 선택하세요.');if(confirmMessage&&!confirm(confirmMessage))return;await call(action,{user_id:target,...payload()});await refresh();};}
  bind('adminMaintenanceOn','admin_maintenance',()=>({enabled:true,message:$('adminMaintenanceMessage').value}),'점검 모드를 켜시겠습니까?');
  bind('adminMaintenanceOff','admin_maintenance',()=>({enabled:false}));
  bind('adminAnnounce','admin_announcement',()=>({message:$('adminAnnouncement').value}));
  $('adminClearAnnouncement').onclick=async()=>{
    const result=await call('admin_announcement',{clear:true});
    if(result){$('adminAnnouncement').value='';await refresh();status('공지를 내렸습니다.');}
  };
  bind('adminSetGold','admin_gold',()=>({mode:$('adminChangeMode').value,value:$('adminGold').value.trim()}),'선택한 플레이어의 Gold를 변경하시겠습니까?');
  $('adminGoldEventStart').onclick=async()=>{
    if(!confirm('모든 플레이어에게 30초 예고 후 Gold ×10 이벤트를 60초간 진행하시겠습니까?'))return;
    if(await call('admin_gold_event',{mode:'start'})){await refresh();status('30초 예고를 시작했습니다. 이벤트는 60초 후 자동 종료됩니다.');}
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
    if(!target)return status('먼저 플레이어를 선택하세요.');
    const reason=$('adminModerationReason').value.trim();
    if(!reason)return status('밴 사유를 입력하세요.');
    const duration=$('adminBanDuration').value;
    if(!confirm(`선택한 플레이어에게 ${duration==='permanent'?'영구 밴':$('adminBanDuration').selectedOptions[0].textContent+' 밴'}을 적용하시겠습니까?`))return;
    await call('admin_ban',{user_id:target,reason,mode:duration==='permanent'?'permanent':'temporary',duration_hours:duration==='permanent'?null:Number(duration)});
    await refresh();
  };
  for(const [id,action,mode] of [['adminUnlock','admin_unlock','one'],['adminUnlockAll','admin_unlock','all'],['adminDiscover','admin_discovery','one'],['adminDiscoverAll','admin_discovery','all'],['adminResetOne','admin_discovery','reset_one'],['adminResetAll','admin_discovery','reset_all']])bind(id,action,()=>({mode,ball_id:$('adminBall').value}),mode==='reset_all'?'선택한 플레이어의 전체 도감 발견 상태를 초기화하시겠습니까?':null);
  async function test(mode){const result=await call('admin_test',{ball_id:$('adminBall').value});if(result){window.WakppuGameTest.run(mode,result.ball_id,Number($('adminHoneySeconds').value));$('admin').hidden=true;}}
  $('adminTestBall').onclick=()=>test('ball');$('adminTestLast').onclick=()=>test('last');$('adminTestBreak').onclick=()=>test('break');$('adminTestHoney').onclick=()=>test('honey');$('adminEndTest').onclick=()=>{window.WakppuGameTest.end();status('실제 진행도를 복원했습니다.');};
  $('adminLoadLogs').onclick=async()=>{const logs=await call('admin_logs');if(logs)$('adminLogs').textContent=JSON.stringify(logs,null,2);};
  window.addEventListener('wakppu-account-restored',refresh);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  window.addEventListener('focus',refresh);setInterval(refresh,3000);refresh();
})();
