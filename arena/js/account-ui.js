'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const client = new window.WaxArena.AccountClient();
  const dialog = $('account-dialog');
  const form = $('account-form');
  let mode = 'login', busy = true;
  function status(message) { $('account-message').textContent = message; }
  function render() {
    const logged = !!client.session;
    for (const id of ['fight-button','ai-mode-button','confirm-battle']) $(id).disabled = busy;
    $('account-open').disabled = busy || !['lobby','modes'].includes(window.WaxArena.getScreen());
    $('account-open').title = ['lobby','modes'].includes(window.WaxArena.getScreen()) ? '계정 관리' : '계정 변경은 로비에서 가능합니다.';
    $('account-entry').disabled = $('account-open').disabled;
    $('account-entry').title = $('account-open').title;
    $('account-entry-label').textContent = logged ? '계정 관리' : '로그인';
    $('account-entry-signup').hidden = logged;
    $('account-entry').setAttribute('aria-label', logged ? '계정 관리' : '로그인 / 회원가입');
    $('account-fields').hidden = logged || !client.configured;
    $('account-actions').hidden = !logged;
    $('account-tabs').hidden = logged || !client.configured;
    $('account-nickname-row').hidden = mode !== 'signup';
    $('account-nickname').required = mode === 'signup';
    $('account-email').required = true;
    $('account-password-row').hidden = mode === 'reset';
    $('account-password').required = mode !== 'reset';
    $('account-password').minLength = mode === 'signup' ? 8 : 1;
    $('account-password').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    $('account-verify').hidden = mode !== 'login' || logged;
    $('account-submit').textContent = mode === 'signup' ? '가입하기' : mode === 'reset' ? '재설정 메일 받기' : '로그인';
    for (const button of dialog.querySelectorAll('button:not(#account-close)')) button.disabled = busy;
    $('account-submit').disabled = busy || !client.configured;
    for (const button of document.querySelectorAll('[data-account-mode]')) button.setAttribute('aria-pressed', String(button.dataset.accountMode === mode));
    $('account-description').textContent = !client.configured ? '온라인 계정 서버를 준비 중입니다. 게스트 플레이는 계속 이용할 수 있습니다.' : logged ? '골드와 전적을 계정에 저장합니다. 게스트 기록은 따로 보관됩니다.' : '다른 기기에서도 같은 이메일로 로그인하면 골드와 전적을 이어갑니다.';
  }
  async function attach() {
    const store = new window.WaxArena.CloudProgressStore(client);
    const nickname = client.session.user.user_metadata?.nickname;
    window.WaxArena.useAccountProgress(store, typeof nickname === 'string' && nickname.trim() ? nickname.slice(0,20) : '온라인 공');
    await store.refresh();
  }
  function openAccount() {
    if (busy || !['lobby','modes'].includes(window.WaxArena.getScreen())) return;
    status(''); render(); dialog.showModal();
  }
  $('account-open').addEventListener('click', openAccount);
  $('account-entry').addEventListener('click', () => {
    if (!client.session) mode = 'login';
    openAccount();
  });
  $('account-close').addEventListener('click', () => { dialog.close(); $('account-password').value = ''; });
  dialog.addEventListener('close', () => { $('account-password').value = ''; });
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  for (const button of document.querySelectorAll('[data-account-mode]')) button.addEventListener('click', () => { mode = button.dataset.accountMode; status(''); $('account-password').value = ''; render(); });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    busy = true; render(); status('처리 중…');
    try {
      const email = $('account-email').value.trim(), password = $('account-password').value;
      if (mode === 'reset') { await client.resetPassword(email); status('등록된 이메일이라면 재설정 링크가 발송됩니다. 메일을 확인해 주세요.'); }
      else if (mode === 'signup') {
        if (!$('account-nickname').value.trim()) throw new Error('닉네임을 입력해 주세요.');
        const signedIn = await client.signUp(email, password, $('account-nickname').value.trim());
        if (signedIn) { await attach(); status('가입했습니다.'); }
        else { mode = 'login'; status('이메일의 인증 링크를 눌러 가입을 완료한 뒤 로그인해 주세요.'); }
      } else { await client.signIn(email, password); await attach(); status('로그인했습니다.'); }
    } catch (error) { status(error.message); }
    finally { $('account-password').value = ''; busy = false; render(); }
  });
  $('account-verify').addEventListener('click', async () => {
    if (busy || !form.reportValidity()) return;
    busy = true; render(); status('인증 메일 요청 중…');
    try { await client.resendVerification($('account-email').value.trim(), $('account-password').value); status('인증 메일을 보냈습니다. 메일의 링크를 눌러주세요.'); }
    catch (error) { status(error.message); }
    finally { busy = false; $('account-password').value = ''; render(); }
  });
  $('account-logout').addEventListener('click', async () => {
    busy = true; render();
    try {
      if (window.WaxArena.getProgress().issue === 'volatile') throw new Error('저장하지 못한 기록이 있습니다. 동기화를 먼저 눌러주세요.');
      await client.signOut(); window.WaxArena.useAccountProgress(null); status('로그아웃했습니다.');
    } catch (error) { status(error.message); }
    finally { busy = false; render(); }
  });
  $('account-sync').addEventListener('click', async () => {
    busy = true; render(); status('기록 동기화 중…');
    await window.WaxArena.syncAccountProgress();
    status(window.WaxArena.getProgress().issue ? '동기화하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.' : '최신 기록을 가져왔습니다.');
    busy = false; render();
  });
  window.addEventListener('arena-screen-change', render);
  window.addEventListener('online', () => { if (client.session) void window.WaxArena.syncAccountProgress(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && client.session && !busy) void window.WaxArena.syncAccountProgress(); });
  window.addEventListener('storage', event => {
    // Another tab may have saved matches; server is the canonical record.
    if (client.session && (event.key === 'wax-ball-arena.cloud.v1.' + client.session.user.id || event.key === null)) void window.WaxArena.syncAccountProgress();
  });
  render();
  void (async () => {
    try {
      await client.restore();
      if (client.session) await attach();
    } catch (error) { client.clear(); status(error.message); if (client.configured && $('orientation-gate').hidden) dialog.showModal(); }
    finally { busy = false; render(); }
  })();
})();
