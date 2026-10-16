// Regular events run silently; compatibility hook for cached clients.
window.WakppuWeeklyNotice={update(){},startsAt(event){return new Date(event.starts_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});}};
