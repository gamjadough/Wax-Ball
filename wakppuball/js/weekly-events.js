(() => {
 const $=id=>document.getElementById(id);let snapshot={},pending=false;
 const section=document.createElement('section');section.id='adminWeeklyEvents';
 section.innerHTML='<h3>📅 매주 금요일 반복 이벤트</h3><p>한국 시간 · 오전 07:00 관리자 볼 10분 + Gold ×10 10분<br>오후 21:30 관리자 볼 15분 + Gold ×100 10분</p><p>수동 이벤트와 별도로 예약됩니다. 정기 안내는 플레이 화면에 표시하지 않습니다. 시간이 겹치면 수동 이벤트가 우선하며, 종료 후 남은 반복 시간만 적용됩니다. 점검 중에는 플레이할 수 없습니다.</p><div class="admin-controls"><button id="weeklyEnable" class="btn">매주 예약 켜기</button><button id="weeklyDisable" class="btn">매주 예약 끄기</button></div><p id="weeklyStatus" role="status"></p><div id="weeklyList"></div>';
 $('adminEventSchedule').after(section);
 function render(){
  const rows=snapshot.weekly_events||[];const enabled=rows.filter(r=>r.enabled).length;
  $('weeklyEnable').disabled=pending||enabled===2;$('weeklyDisable').disabled=pending||enabled===0;
  $('weeklyList').replaceChildren();
  if(!rows.length){$('weeklyList').textContent='반복 예약 서버 상태 확인 중…';$('weeklyEnable').disabled=true;return;}
  for(const row of rows){const p=document.createElement('p');p.textContent=`매주 금요일 ${row.local_time.slice(0,5)} · 관리자 볼 ${row.ball_seconds/60}분 · Gold ×${row.multiplier} ${row.gold_seconds/60}분 · ${row.enabled?'반복 중':'꺼짐'}`;$('weeklyList').append(p);}
  for(const [key,label] of [['admin_ball_event','관리자 볼'],['gold_event','Gold']]){const own=key==='gold_event'?'weekly_gold_event':'weekly_ball_event';const event=snapshot[own]??snapshot[key];if(event?.source!=='weekly')continue;const p=document.createElement('p');p.textContent=`${label} 다음/현재 시작: ${new Date(event.starts_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false})} (한국 시간)`;$('weeklyList').append(p);}
 }
 async function change(mode){if(pending)return;if(!confirm(mode==='enable'?'매주 금요일 오전 7시·오후 9시 30분 반복 이벤트를 켤까요?':'매주 반복 예약과 현재 반복 이벤트를 끌까요? 수동 이벤트는 유지됩니다.'))return;pending=true;render();try{const data=await WakppuAuth.invoke('admin_weekly_events',{mode});window.WakppuEventSchedule.update(data);window.WakppuGoldEvent.update(data);window.WakppuAdminBallEvent.update(data);$('weeklyStatus').textContent=mode==='enable'?'매주 반복 예약을 켰습니다.':'매주 반복 예약을 껐습니다.';}catch(error){$('weeklyStatus').textContent=error.message;}finally{pending=false;render();}}
 $('weeklyEnable').onclick=()=>change('enable');$('weeklyDisable').onclick=()=>change('disable');
 window.WakppuWeeklyEvents={update:data=>{snapshot=data;render();}};render();
})();
