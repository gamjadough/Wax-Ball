// 접속 여부는 플레이·진행도와 분리하고 서버 시간을 기준으로 판정합니다.
(() => {
  let pending = false, lastUser = null, lastSent = 0;
  async function ping() {
    if (pending || document.hidden || !navigator.onLine || !window.WakppuAuth) return;
    pending = true;
    try {
      const session = (await WakppuAuth.session()).data.session;
      const id = session?.user?.id;
      if (!id) { lastUser = null; lastSent = 0; return; }
      if (id === lastUser && Date.now() - lastSent < 30000) return;
      await WakppuAuth.invoke('presence_ping');
      lastUser = id;
      lastSent = Date.now();
    } catch (_) { /* Retry after reconnecting; never interrupt the game. */ }
    finally { pending = false; }
  }
  setInterval(ping, 30000);
  for (const event of ['online','focus','wakppu-auth-changed','wakppu-account-restored']) window.addEventListener(event, ping);
  document.addEventListener('visibilitychange', ping);
  ping();
})();
