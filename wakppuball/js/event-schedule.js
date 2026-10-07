(function(root){
  'use strict';
  const MAX_DAYS=365;
  function koreaInstant(value){
    if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value))throw Error('시작 날짜와 시각을 입력하세요.');
    const full=value.length===16?value+':00':value;
    const instant=new Date(full+'+09:00');
    if(!Number.isFinite(instant.getTime())||new Date(instant.getTime()+9*3600000).toISOString().slice(0,19)!==full)throw Error('올바른 날짜와 시각을 입력하세요.');
    return instant.toISOString();
  }
  const korean=time=>new Date(time).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false});
  root.WakppuEventSchedule={koreaInstant};
  if(!root.document)return;
  const section=document.createElement('section');section.id='adminEventSchedule';
  section.innerHTML='<h3>🕒 시각 지정 이벤트 예약</h3><p>한국 시간(KST) 기준 · 1회 예약 · 최대 365일 뒤까지. 관리자나 플레이어가 접속하지 않아도 시작·종료 시각이 유지됩니다. 같은 종류의 예약/진행 이벤트는 하나만 설정할 수 있습니다.</p><label>이벤트 종류<select id="scheduleType"><option value="gold">전체 골드 타임</option><option value="ball">관리자 왁뿌볼</option></select></label><label>시작 날짜·시각 (한국 시간)<input id="scheduleAt" type="datetime-local" step="1" style="max-width:100%;min-width:0"></label><label>진행 시간 (분 · 최대 1,440분)<input id="scheduleMinutes" type="number" min="0.016666666666666666" max="1440" step="any" value="10"></label><label id="scheduleMultiplierLabel">Gold 배율 (1~1,000배)<input id="scheduleMultiplier" type="number" min="1" max="1000" step="1" value="10"></label><button id="scheduleCreate" class="btn" type="button">지정 시각에 예약</button><p id="scheduleStatus" role="status"></p><div id="scheduleList"></div>';
  document.getElementById('adminGoldEventInfo').closest('section').after(section);
  const $=id=>document.getElementById(id);let snapshot={},pending=false;
  $('scheduleType').onchange=()=>{$('scheduleMultiplierLabel').hidden=$('scheduleType').value!=='gold';};
  function render(){
    $('scheduleList').replaceChildren();
    for(const [type,label,key] of [['gold','전체 골드 타임','gold_event'],['ball','관리자 왁뿌볼','admin_ball_event']]){
      const event=snapshot[key];if(!event)continue;
      const now=Date.parse(snapshot.server_time),start=Date.parse(event.starts_at),end=Date.parse(event.ends_at);
      if(end<=now)continue;
      const row=document.createElement('p'),text=document.createElement('span'),button=document.createElement('button');
      text.textContent=`${label} · ${now<start?'예약':'진행 중'} · 시작 ${korean(start)} · 종료 ${korean(end)}${type==='gold'?' · Gold ×'+event.multiplier:''} (한국 시간) `;
      button.className='btn small';button.type='button';button.textContent=now<start?'예약 취소':'즉시 종료';button.disabled=pending;
      button.onclick=async()=>{
        if(pending||!confirm(`${label} ${button.textContent}하시겠습니까?`))return;
        pending=true;render();
        try{const result=await WakppuAuth.invoke('admin_event_schedule_cancel',{event_type:type,event_id:event.id});apply(result);$('scheduleStatus').textContent='예약 취소/종료 완료';}
        catch(error){$('scheduleStatus').textContent=error.message;}
        finally{pending=false;render();}
      };
      row.append(text,button);$('scheduleList').append(row);
    }
    if(!$('scheduleList').childElementCount)$('scheduleList').textContent='예약/진행 중인 이벤트가 없습니다.';
    $('scheduleCreate').disabled=pending;
  }
  function apply(data){snapshot={...snapshot,...data};root.WakppuGoldEvent.update(snapshot);root.WakppuAdminBallEvent.update(snapshot);render();}
  root.WakppuEventSchedule.update=data=>{snapshot=data;render();};
  $('scheduleCreate').onclick=async()=>{
    if(pending)return;
    try{
      const starts_at=koreaInstant($('scheduleAt').value),start=Date.parse(starts_at),now=Date.parse(snapshot.server_time);
      if(Number.isFinite(now)&&(start<=now||start>now+MAX_DAYS*86400000))throw Error('서버 현재 시각 이후부터 365일 이내로 예약하세요.');
      const raw=$('scheduleMinutes').value.trim(),seconds=Number(raw)*60,duration_seconds=Math.round(seconds);
      if(!raw||!Number.isFinite(seconds)||Math.abs(seconds-duration_seconds)>1e-6||duration_seconds<1||duration_seconds>86400)throw Error('진행 시간을 1초~24시간 범위로 입력하세요.');
      const event_type=$('scheduleType').value,multiplier=Number($('scheduleMultiplier').value);
      if(event_type==='gold'&&(!Number.isInteger(multiplier)||multiplier<1||multiplier>1000))throw Error('Gold 배율은 1~1,000 사이의 정수입니다.');
      if(!confirm(`${korean(start)} (한국 시간)에 ${event_type==='gold'?'Gold ×'+multiplier:'관리자 왁뿌볼'} 이벤트를 ${duration_seconds}초간 시작하도록 예약할까요?`))return;
      pending=true;render();
      apply(await WakppuAuth.invoke('admin_event_schedule',{event_type,starts_at,duration_seconds,...(event_type==='gold'?{multiplier}:{})}));
      $('scheduleStatus').textContent=`예약 완료 · ${korean(start)} (한국 시간)`;
    }catch(error){$('scheduleStatus').textContent=error.message;}
    finally{pending=false;render();}
  };
})(typeof window==='undefined'?globalThis:window);
