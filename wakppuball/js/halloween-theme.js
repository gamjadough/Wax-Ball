(() => {
  // Annual season: October 24 00:00 through November 14 23:59:59, Asia/Seoul.
  function activeAt(timestamp) {
    const korea = new Date(Number(timestamp) + 9 * 60 * 60 * 1000);
    const day = (korea.getUTCMonth() + 1) * 100 + korea.getUTCDate();
    return day >= 1024 && day <= 1114;
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const preview = local && new URLSearchParams(location.search).get('preview') === 'halloween';
  function update() {
    const active = preview || activeAt(Date.now());
    document.body.classList.toggle('halloween-theme', active);
    document.getElementById('halloweenScenery').hidden = !active;
  }
  window.WakppuHalloween = { activeAt, update };
  update();
  // Also switch automatically if the player leaves the game open across midnight.
  setInterval(update, 30000);
  document.addEventListener('visibilitychange', update);
})();
