(() => {
  const $=id=>document.getElementById(id);let target=null;
  function status(message){$('adminStatus').textContent=message;}
  function info(player){target=player.id;$('adminPlayerInfo').textContent=`${player.nickname}\nUser ID: ${player.id}\nGold: ${WakppuGold.integer(player.state.gold).toLocaleString('ko-KR')}G · 환생: ${player.state.rebirths}회\n해금: ${player.state.unlocked_ball_ids.join(', ')}\n도감: ${(player.state.discovered_ball_ids||[]).join(', ')}\n정지 상태: ${player.moderation?.status||'active'}`;}
  let pending=false;
  async function call(action,payload={}){if(pending)return null;pending=true;try{const result=await window.WakppuAuth.invoke(action,payload);if(result.target)info(result.target);status('완료했습니다.');return result;}catch(e){status(e.message);return null;}finally{pending=false;}}
  let refreshing=false;
  async function refresh(){
    if(refreshing||!window.WakppuAuth)return;
    refreshing=true;
    try{
      const result=await window.WakppuAuth.invoke('status');
      $('adminBtn').hidden=result.role!=='admin';
      if($('adminBtn').hidden)$('admin').hidden=true;
      window.wakppuServerBlocked=result.maintenance&&result.role!=='admin';
      $('game').hidden=window.wakppuServerBlocked;
      $('maintenance').hidden=!$('game').hidden;
      document.querySelector('.maintenance-note').textContent=result.message||'잠시 후 다시 접속해주세요.';
      $('serverAnnouncement').hidden=!result.announcement;
      if(result.announcement)$('serverAnnouncement').textContent=result.announcement.message;
      if(result.admin_revision!=null&&result.admin_revision!==WakppuGameTest.revision())await WakppuGameTest.restoreAccount();
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
  bind('adminSetGold','admin_gold',()=>({mode:$('adminChangeMode').value,value:$('adminGold').value.trim()}),'선택한 플레이어의 Gold를 변경하시겠습니까?');
  bind('adminSetRebirths','admin_rebirths',()=>({mode:$('adminChangeMode').value,value:Number($('adminRebirths').value)}),'선택한 플레이어의 환생 횟수를 변경하시겠습니까?');
  bind('adminUnban','admin_unban',()=>({}));
  for(const [id,action,mode] of [['adminUnlock','admin_unlock','one'],['adminUnlockAll','admin_unlock','all'],['adminDiscover','admin_discovery','one'],['adminDiscoverAll','admin_discovery','all'],['adminResetOne','admin_discovery','reset_one'],['adminResetAll','admin_discovery','reset_all']])bind(id,action,()=>({mode,ball_id:$('adminBall').value}),mode==='reset_all'?'선택한 플레이어의 전체 도감 발견 상태를 초기화하시겠습니까?':null);
  async function test(mode){const result=await call('admin_test',{ball_id:$('adminBall').value});if(result){window.WakppuGameTest.run(mode,result.ball_id,Number($('adminHoneySeconds').value));$('admin').hidden=true;}}
  $('adminTestBall').onclick=()=>test('ball');$('adminTestLast').onclick=()=>test('last');$('adminTestBreak').onclick=()=>test('break');$('adminTestHoney').onclick=()=>test('honey');$('adminEndTest').onclick=()=>{window.WakppuGameTest.end();status('실제 진행도를 복원했습니다.');};
  $('adminLoadLogs').onclick=async()=>{const logs=await call('admin_logs');if(logs)$('adminLogs').textContent=JSON.stringify(logs,null,2);};
  window.addEventListener('wakppu-account-restored',refresh);setInterval(refresh,10000);refresh();
})();
