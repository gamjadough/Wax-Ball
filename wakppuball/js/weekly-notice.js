(() => {
  const notice=document.createElement('aside');notice.id='weeklyEventNotice';notice.className='weekly-event-notice';notice.hidden=true;
  notice.setAttribute('aria-label','금요일 정기 이벤트');
  const title=document.createElement('strong');title.textContent='📅 금요일 정기 이벤트';notice.append(title);
  const rows={};
  for(const kind of ['gold','ball']){const row=document.createElement('p');row.hidden=true;notice.append(row);rows[kind]=row;}
  const info=document.querySelector('.bottom .info'),layout=document.createElement('div');layout.className='ball-info-row';
  info.before(layout);layout.append(notice,info);
  window.WakppuWeeklyNotice={update(kind,text){
    const row=rows[kind];if(!row)return;
    if(row.textContent!==text)row.textContent=text;row.hidden=!text;
    notice.hidden=Object.values(rows).every(r=>r.hidden);
    layout.classList.toggle('has-weekly-event',!notice.hidden);
  },startsAt(event){return new Date(event.starts_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});}};
})();
