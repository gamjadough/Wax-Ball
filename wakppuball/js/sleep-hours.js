(() => {
  const offset=9*60*60*1000;
  function at(ms){
    const kst=new Date(ms+offset),hour=kst.getUTCHours();
    const midnight=Date.UTC(kst.getUTCFullYear(),kst.getUTCMonth(),kst.getUTCDate())-offset;
    const active=hour>=23||hour<6;
    const next_open_at=midnight+(hour<6?6:30)*3600000;
    const next_change_at=active?next_open_at:midnight+23*3600000;
    return {active,next_change_at:new Date(next_change_at).toISOString(),next_open_at:new Date(next_open_at).toISOString()};
  }
  window.WakppuSleepHours={at};
})();
