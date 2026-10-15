'use strict';
(() => {
  const $ = id => document.getElementById('friend-' + id);
  let client = null, busy = false, controlBusy = false, generation = 0, lastClicks = {};
  const active = () => document.body.dataset.screen === 'friends';
  const message = text => { $('message').textContent = text; };
  for (const side of ['player','opponent']) $('' + side + '-ball').append(document.querySelector('#player-ball .cracks').cloneNode(true));
  function render() {
    $('create').disabled = $('join').disabled = busy;
    if (!client?.code) { $('setup').hidden = false; $('room').hidden = true; $('code').textContent = '--------'; $('back').textContent = '← 로비로 나가기'; return; }
    const s = client.snapshot();
    $('back').textContent = client.room?.startedAt && s.stage !== 'ended' && s.stage !== 'closed' ? '← 로비로 나가기 (기권)' : '← 로비로 나가기';
    $('setup').hidden = true; $('room').hidden = false;
    $('code').textContent = s.code;
    const labels = { connecting:'방에 연결하는 중…', closed:'방이 종료되었거나 만료되었습니다. 로비에서 새 방을 만들어 주세요.', waiting:'코드를 친구에게 보내주세요. 우정 파괴 대기 중.', ready:'둘 다 준비 완료! 방장이 시작 버튼을 눌러주세요.', countdown:`${s.countdown}초 후 우정에 금 갑니다!`, paused:'잠깐! 연결·화면 상태를 확인하고 있어요. 둘 다 돌아오면 이어집니다.', playing:'내 공을 5번 두드리면 친구에게 10 피해!', ended:s.won ? '승리! 우정은… 무사하지?' : '패배! 공만 깨진 거 맞지?' };
    if (s.stage === 'ready' && (!s.me?.ready || !s.other?.ready)) labels.ready = '각자 준비 완료를 누르면 시작할 수 있어요.';
    const status = !s.connected && s.stage !== 'closed' ? '서버 연결 중… 연결이 돌아오면 자동으로 이어집니다.' : labels[s.stage];
    if ($('status').textContent !== status) $('status').textContent = status;
    for (const [which, p, hp] of [['player',s.me,s.playerHp],['opponent',s.other,s.opponentHp]]) {
      $(which + '-name').textContent = p?.name || '입장 대기';
      $(which + '-hp').textContent = (hp ?? 1000).toLocaleString();
      $(which + '-fill').style.width = (hp ?? 1000) / 10 + '%';
      $(which + '-health').setAttribute('aria-valuenow', hp ?? 1000);
      $(which + '-ready').textContent = !p ? '친구 대기' : !p.online ? '연결 끊김' : !p.active ? '다른 화면 보는 중' : p.ready ? '준비 완료 ✓' : '준비 전';
      const clicks = p?.clicks || 0, ball = $(which + '-ball');
      ball.dataset.hits = clicks % 5;
      $(which + '-hits').textContent = `${clicks % 5} / 5 타격 · ${Math.floor(clicks / 5)}번 들이받음`;
      if (lastClicks[which] != null && clicks > lastClicks[which] && clicks % 5 === 0) {
        ball.classList.add('breaking'); setTimeout(() => ball.classList.remove('breaking'), 160);
      }
      lastClicks[which] = clicks;
    }
    $('player-ball').disabled = s.stage !== 'playing' || !s.connected || s.hitting || !client.active();
    $('ready').hidden = !['waiting','ready'].includes(s.stage);
    $('ready').disabled = !s.connected || controlBusy;
    $('ready').textContent = s.me?.ready ? '준비 취소' : '준비 완료';
    $('start').hidden = s.side !== 'host' || s.stage !== 'ready';
    $('start').disabled = controlBusy || !s.me?.ready || !s.other?.ready || !s.connected || !s.me?.active || !s.other?.active || !s.other?.online;
    $('claim').hidden = !s.canClaim; $('claim').disabled = !s.connected || controlBusy;
    $('play-hint').textContent = s.stage === 'ended' ? '' : client.room?.startedAt ? '대전 중 로비로 나가면 기권합니다. 연결이 끊긴 상대는 20초 후 종료할 수 있어요.' : '준비 완료 → 방장이 시작 · 방은 1시간 후 만료됩니다.';
    $('result').hidden = s.stage !== 'ended';
    $('result-title').textContent = s.won ? '내 공이 이겼다! ㅋㅋ' : '친구 공이 더 독했다…';
    $('result-note').textContent = `${client.room?.forfeit ? '기권으로 종료되었습니다. ' : ''}골드·기존 전적에 영향을 주지 않는 친구 연습 대전입니다.`;
    const seconds = client.room?.startedAt ? Math.max(0, Math.floor((client.now() - client.room.startedAt - 3000) / 1000)) : 0;
    if (s.stage !== 'ended') $('clock').textContent = `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`;
  }
  async function connect(join) {
    if (busy || !active()) return;
    if (!$('name').reportValidity()) return;
    busy = true; const ticket = ++generation;
    const next = new window.WaxArena.FriendRoom(); client = next; lastClicks = {};
    next.onChange = () => { if (client === next && active()) render(); };
    next.onError = text => { if (client === next && active()) message(text); };
    message('친구 대전 서버에 연결 중…'); render();
    try {
      if (join) await next.join($('code-input').value, $('name').value);
      else await next.create($('name').value);
      if (ticket !== generation) return;
      message('방 코드만 친구에게 알려주세요. 개인정보는 필요 없어요.');
    } catch (error) {
      if (ticket !== generation) return;
      message(error.message.includes('permission') || error.code ? '방에 연결하지 못했습니다. 방 코드와 인터넷 연결을 확인해 주세요.' : error.message);
      void next.leave(); client = null;
    } finally { if (ticket === generation) { busy = false; render(); } }
  }
  function leave() {
    ++generation; busy = false; controlBusy = false;
    const previous = client; client = null;
    if (previous) void previous.leave();
    window.WaxArena.returnFromFriends();
  }
  const action = method => async () => {
    if (!client || !active() || method !== 'hit' && controlBusy) return;
    const target = client;
    if (method !== 'hit') { controlBusy = true; render(); }
    try { await target[method](); } catch { if (client === target) message('요청을 처리하지 못했습니다. 연결 상태를 확인해 주세요.'); }
    finally { if (client === target) { controlBusy = false; render(); } }
  };
  $('create').addEventListener('click', () => void connect(false));
  $('connect').addEventListener('submit', event => { event.preventDefault(); void connect(true); });
  $('code-input').addEventListener('input', () => { $('code-input').value = $('code-input').value.toUpperCase().replace(/\s/g,''); });
  $('back').addEventListener('click', leave); $('again').addEventListener('click', leave);
  for (const method of ['ready','start','claim']) $(method).addEventListener('click', action(method));
  $('player-ball').addEventListener('click', action('hit'));
  $('copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(client.code); message('방 코드를 복사했습니다. 친구에게 보내주세요!'); }
    catch { const range = document.createRange(); range.selectNodeContents($('code')); getSelection().removeAllRanges(); getSelection().addRange(range); message('방 코드를 선택했습니다. 길게 누르거나 복사해서 친구에게 보내주세요.'); }
  });
  function presence() { if (client) void client.setActive().catch(() => {}); render(); }
  document.addEventListener('visibilitychange', presence);
  window.addEventListener('arena-orientation-change', presence);
  window.addEventListener('arena-screen-change', () => {
    if (!active()) { if (client) { const old = client; client = null; ++generation; busy = false; void old.leave(); } return; }
    if (!$('name').value) $('name').value = document.getElementById('profile-name')?.textContent?.trim().slice(0,20) || '들이받는 공';
    message(''); render();
  });
  setInterval(() => { if (active() && client) render(); }, 100);
})();
