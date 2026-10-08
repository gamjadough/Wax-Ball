(() => {
  // Annual season: October 24 00:00 through November 14 23:59:59, Asia/Seoul.
  function activeAt(timestamp) {
    const korea = new Date(Number(timestamp) + 9 * 60 * 60 * 1000);
    const day = (korea.getUTCMonth() + 1) * 100 + korea.getUTCDate();
    return day >= 1024 && day <= 1114;
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const params=new URLSearchParams(location.search);
  const preview = local && (params.get('preview')==='halloween' || params.get('theme')==='halloween');
  let mode='auto',serverOffset=0;
  function update() {
    const active = preview || mode==='halloween' || (mode==='auto' && activeAt(Date.now()+serverOffset));
    document.body.classList.toggle('halloween-theme', active);
    document.getElementById('halloweenScenery').hidden = !active;
  }
  function accept(status) {
    if(['auto','default','halloween'].includes(status.background_mode))mode=status.background_mode;
    const time=Date.parse(status.server_time);
    if(Number.isFinite(time))serverOffset=time-Date.now();
    update();
  }
  window.WakppuHalloween = { activeAt, update, accept, get mode(){return mode;} };
  update();
  // Also switch automatically if the player leaves the game open across midnight.
  setInterval(update, 30000);
  document.addEventListener('visibilitychange', update);
})();
