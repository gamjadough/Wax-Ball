'use strict';
(() => {
  const { Battle, CONFIG, STATES, AI_DIFFICULTIES } = window.WaxArena;
  const battle = new Battle();
  const $ = id => document.getElementById(id);
  const difficultySelect = $('ai-difficulty');
  for (const [value, settings] of Object.entries(AI_DIFFICULTIES)) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = `${settings.name} · ${(settings.aiHitIntervalMs / 1000).toFixed(2)}초마다 클릭`;
    difficultySelect.append(option);
  }
  difficultySelect.value = CONFIG.defaultDifficulty;
  const difficultyDialog = $('difficulty-dialog');
  const difficultyJokes = { entry: '입문 · AI가 공을 깨다 말고 딴생각합니다.', beginner: '초급 · 적당히 둥근 성격. 가볍게 한 판!', intermediate: '중급 · 슬슬 손가락에 진심인 공입니다.', advanced: '고급 · 저 공, 퇴근이 급한가 봅니다.' };
  function describeDifficulty() {
    const settings = AI_DIFFICULTIES[difficultySelect.value];
    $('difficulty-help').textContent = `${difficultyJokes[difficultySelect.value]} (${(settings.aiHitIntervalMs / 1000).toFixed(2)}초마다 타격)`;
  }
  difficultySelect.addEventListener('change', describeDifficulty);
  describeDifficulty();
  const balls = { player: $('player-ball'), ai: $('ai-ball') };
  const effects = $('effects');
  const animations = new Set();
  // Bounded diagnostics stay in memory; combat logs are not player-facing UI.
  const debugLog = [];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const inputVerb = window.matchMedia('(pointer: coarse)').matches ? '터치' : '클릭';
  const SCREENS = Object.freeze({ LOBBY: 'lobby', MODES: 'modes', LAB: 'lab', BATTLE: 'battle', RESULT: 'result' });
  const portraitQuery = window.matchMedia('(orientation: portrait) and (max-width: 900px), (orientation: portrait) and (pointer: coarse)');
  let orientationBlocked = portraitQuery.matches;
  let screen = SCREENS.LOBBY;
  const guestProgress = new window.WaxArena.ProgressStore();
  let progress = guestProgress;
  let matchId = null;
  let matchReward = null;
  function renderProgress() {
    const saved = progress.getSnapshot();
    $('gold-amount').textContent = `${saved.gold.toLocaleString()} G`;
    $('lab-gold').textContent = `${saved.gold.toLocaleString()} G`;
    const cloud = progress !== guestProgress;
    const issues = { unavailable: '저장 불가', corrupt: '기록 복구 필요', loading: '계정 불러오는 중', offline: '동기화 필요', pending: '저장 대기', volatile: '저장 불가 · 창 유지' };
    $('record-summary').textContent = `${saved.wins.toLocaleString()}승 · ${saved.losses.toLocaleString()}패${issues[saved.issue] ? ' · ' + issues[saved.issue] : ''}`;
    $('record-summary').title = saved.issue === 'unavailable' ? '저장할 수 없어 현재 화면에서만 유지됩니다.' : saved.issue === 'corrupt' ? '기존 저장 기록을 읽지 못했습니다. 새 대전 결과부터 다시 저장합니다.' : '골드와 전적은 이 브라우저에 저장됩니다.';
    $('result-reward').hidden = !matchReward;
    if (matchReward) {
      const confirmed = !cloud || saved.history.some(match => match.id === matchReward.id);
      $('result-reward').textContent = matchReward.result === STATES.VICTORY ? (confirmed ? `승리 보상 +${matchReward.reward} G` : '승리 · 보상 저장 대기') : '패배 · 골드 보상 없음';
      $('result-save-note').textContent = cloud ? (confirmed ? '골드와 전적을 온라인 계정에 저장했습니다.' : saved.issue === 'volatile' ? '저장 불가 · 창을 닫지 말고 로비에서 동기화해 주세요.' : '계정 저장 대기 · 로비에서 동기화해 주세요.') : saved.issue === 'unavailable' ? '저장 불가 · 현재 화면에서만 기록이 유지됩니다.' : '골드와 전적을 이 브라우저에 저장했습니다.';
    }
  }
  renderProgress();
  let frame = null;
  let lastFrame = null;
  let lastSecond = -1;
  let displayedStatus = null;
  function stopLoop() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    lastFrame = null;
  }
  function showScreen(next) {
    screen = next;
    document.body.dataset.screen = screen;
    $('lobby-screen').hidden = screen !== SCREENS.LOBBY;
    $('mode-screen').hidden = screen !== SCREENS.MODES;
    $('lab-screen').hidden = screen !== SCREENS.LAB;
    document.querySelector('.topbar').hidden = screen === SCREENS.LAB;
    document.querySelector('.page-footer').hidden = screen === SCREENS.LAB;
    $('battle-screen').hidden = screen !== SCREENS.BATTLE && screen !== SCREENS.RESULT;
    $('result').hidden = screen !== SCREENS.RESULT;
    window.dispatchEvent(new Event('arena-screen-change'));
    // Native modal dialogs trap focus; result controls use inert backgrounds.
    document.querySelectorAll('.battle-heading,.health-row,.arena-top,.arena-grid,.arena-bottom').forEach(node => { node.inert = screen === SCREENS.RESULT; });
  }
  function returnToLobby() {
    if (screen === SCREENS.LOBBY) return;
    const fromLab = screen === SCREENS.LAB;
    stopLoop();
    difficultyDialog.close();
    $('lab-dialog').close();
    clearEffects();
    battle.reset(false);
    lastSecond = -1;
    $('elapsed').textContent = '00:00';
    $('menu-notice').textContent = '';
    showScreen(SCREENS.LOBBY);
    processEvents();
    if (!orientationBlocked) $(fromLab ? 'lab-open' : 'fight-button').focus({ preventScroll: true });
  }
  function clock(ms) {
    const seconds = Math.floor(ms / 1000);
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  function animate(node, keyframes, options, remove = false) {
    const animation = node.animate(keyframes, { ...options, duration: reduceMotion ? 1 : options.duration });
    animations.add(animation);
    const cleanup = () => { animations.delete(animation); if (remove) node.remove(); };
    animation.onfinish = cleanup;
    animation.oncancel = cleanup;
  }
  function clearEffects() {
    for (const animation of animations) animation.cancel();
    animations.clear();
    effects.replaceChildren();
    for (const side of ['player', 'ai']) {
      balls[side].classList.remove('breaking');
      $(`${side}-side`).classList.remove('impacted');
    }
  }
  function center(side) {
    const ball = balls[side].getBoundingClientRect();
    const rect = effects.getBoundingClientRect();
    return { x: ball.left + ball.width / 2 - rect.left, y: ball.top + ball.height / 2 - rect.top };
  }
  function effectNode(className, point) {
    const node = document.createElement('span');
    node.className = className;
    node.style.left = `${point.x}px`;
    node.style.top = `${point.y}px`;
    effects.append(node);
    return node;
  }
  function shatter(side) {
    if (reduceMotion) return;
    const point = center(side);
    const count = inputVerb === '터치' ? 6 : 12;
    for (let i = 0; i < count; i++) {
      const angle = i * Math.PI * 2 / count;
      const length = 55 + Math.random() * 60;
      const node = effectNode(`particle ${side}`, point);
      animate(node, [{ transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(angle) * length}px, ${Math.sin(angle) * length + 45}px) rotate(${i * 53}deg) scale(.4)`, opacity: 0 }], { duration: 540, easing: 'cubic-bezier(.15,.6,.4,1)' }, true);
    }
  }
  function launch(side, target) {
    if (reduceMotion) return;
    const from = center(side);
    const to = center(target);
    const node = effectNode(`projectile ${side}`, from);
    animate(node, [{ transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 }, { offset: .15, opacity: 1 }, { transform: `translate(${to.x - from.x - 11}px, ${to.y - from.y - 11}px) scale(1.2)`, opacity: 1 }], { duration: CONFIG.projectileMs, easing: 'cubic-bezier(.4,0,.3,1)' }, true);
  }
  function damage(target, amount) {
    const point = center(target);
    const number = effectNode('damage-number', { x: point.x, y: point.y - 65 });
    number.textContent = `−${amount}`;
    animate(number, [{ transform: 'translate(-50%,0)', opacity: 1 }, { transform: 'translate(-50%,-45px)', opacity: 0 }], { duration: 850, easing: 'ease-out' }, true);
    const ring = effectNode('impact-ring', point);
    animate(ring, [{ transform: 'scale(.5)', opacity: 1 }, { transform: 'scale(3.4)', opacity: 0 }], { duration: 400, easing: 'ease-out' }, true);
    animate($(`${target}-side`), [{ backgroundColor: '#ffb17a25' }, { backgroundColor: '#ffb17a00' }], { duration: 220 });
  }
  function log(message, team = '') {
    debugLog.unshift({ round: battle.round, time: battle.time, message, team });
    if (debugLog.length > CONFIG.maxLogEntries) debugLog.length = CONFIG.maxLogEntries;
  }
  function render() {
    $('ai-difficulty-label').textContent = AI_DIFFICULTIES[battle.difficulty].name;
    for (const side of ['player', 'ai']) {
      const fighter = battle.fighters[side];
      const hpLabel = $(`${side}-hp`);
      if (hpLabel.dataset.health !== String(fighter.health)) {
        hpLabel.replaceChildren(document.createTextNode(fighter.health.toLocaleString() + ' '));
        const max = document.createElement('small');
        max.textContent = `/ ${CONFIG.maxHealth.toLocaleString()}`;
        hpLabel.append(max);
        hpLabel.dataset.health = fighter.health;
      }
      if (battle.status !== STATES.RUNNING) $(`${side}-fill`).style.transition = 'none';
      $(`${side}-fill`).style.width = `${fighter.health / CONFIG.maxHealth * 100}%`;
      $(`${side}-health`).setAttribute('aria-valuenow', fighter.health);
      balls[side].dataset.hits = fighter.hits;
    }
    balls.player.disabled = orientationBlocked || screen !== SCREENS.BATTLE || battle.status !== STATES.RUNNING || battle.fighters.player.breaking;
    $('player-hint').textContent = battle.status === STATES.RUNNING ? (battle.fighters.player.breaking ? '펑! 잠깐, 나 날아간다!' : `${inputVerb} 5번이면 들이받음 ㅋㅋ`) : `전투 시작 후 ${inputVerb}하세요`;
    if (displayedStatus !== battle.status) {
      displayedStatus = battle.status;
      const running = battle.status === STATES.RUNNING;
      const waiting = battle.status === STATES.WAITING;
      $('battle-status').textContent = running ? '● 하찮은 혈투 진행 중' : waiting ? '공들 대기 중' : '오늘의 공싸움 끝!';
      $('ai-hint').textContent = running ? '생각 없이 자동으로 두드리는 중' : 'AI도 쉬는 중';
      if (!running) {
        const victory = battle.status === STATES.VICTORY;
        $('result-kicker').textContent = waiting ? '세기의 하찮은 대결' : victory ? '상대 공이 먼저 퇴근함' : '공생은 원래 이런 거임';
        $('result-title').textContent = waiting ? '공 준비 중' : victory ? 'VICTORY · 내가 더 둥글다!' : 'DEFEAT · 공생무상…';
        $('result-description').textContent = waiting ? '5번 두드려서 상대에게 들이받으세요.' : `전투 시간 ${clock(battle.time)} · ${victory ? '골드 챙겼다! 다음 공도 들이받자.' : '괜찮아. 어차피 공이었어.'}`;
        $('start-button').firstChild.textContent = waiting ? '전투 시작 ' : '다시 도전 ';
      }
    }
  }
  function processEvents() {
    for (const event of battle.drainEvents()) {
      if (event.round !== battle.round) continue;
      if (event.type === 'hit') {
        const lines = event.side === 'player' ? ['어?', '어어?', '이거 맞아?', '나 지금 금 갔어.', '공중분해 출근!'] : ['삐빅.', '감정 없음.', '진짜 없다고.', '약간 열받음.', '들이받겠습니다.'];
        $(`${event.side}-speech`).textContent = lines[event.hits - 1];
        animate(balls[event.side], [{ transform: 'scale(1)' }, { transform: 'scale(.94) rotate(-3deg)' }, { transform: 'scale(1)' }], { duration: 120 });
      } else if (event.type === 'breaking') {
        balls[event.side].classList.add('breaking');
        shatter(event.side);
      } else if (event.type === 'destroyed') {
        balls[event.side].classList.remove('breaking');
        launch(event.side, event.target);
      } else if (event.type === 'damage') {
        damage(event.target, event.damage);
        log(`${event.side === 'player' ? '내' : 'AI'} 왁뿌볼 파괴 → ${event.target === 'ai' ? '상대' : '플레이어'}에게 ${event.damage} 피해`, event.side);
      } else if (event.type === 'ended') {
        if (matchId) {
          const reward = progress.recordResult(matchId, event.status, battle.difficulty, battle.time);
          if (reward) matchReward = reward;
          renderProgress();
        }
        stopLoop();
        clearEffects();
        showScreen(SCREENS.RESULT);
        log(event.status === STATES.VICTORY ? '승리! 상대의 체력이 0이 되었습니다.' : '패배. 내 체력이 0이 되었습니다.');
      }
    }
    render();
    if (!orientationBlocked && screen === SCREENS.RESULT && !$('result').contains(document.activeElement)) $('start-button').focus({ preventScroll: true });
  }
  function tick(timestamp) {
    frame = null;
    if (orientationBlocked || screen !== SCREENS.BATTLE || battle.status !== STATES.RUNNING) return;
    // Pause when hidden; avoid a burst of background AI attacks on return.
    const delta = lastFrame === null ? 0 : Math.min(timestamp - lastFrame, 100);
    lastFrame = timestamp;
    battle.advance(delta);
    const second = Math.floor(battle.time / 1000);
    if (lastSecond !== second) { lastSecond = second; $('elapsed').textContent = clock(battle.time); }
    if (battle.events.length) processEvents();
    if (battle.status === STATES.RUNNING && !document.hidden) frame = requestAnimationFrame(tick);
  }
  function start() {
    if (orientationBlocked || document.hidden) return;
    difficultyDialog.close();
    stopLoop();
    showScreen(SCREENS.BATTLE);
    lastSecond = -1;
    clearEffects();
    for (const side of ['player', 'ai']) $(`${side}-fill`).style.transition = 'none';
    battle.reset(true, difficultySelect.value);
    matchId = window.crypto?.randomUUID ? window.crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => { const digit = Math.floor(Math.random() * 16); return (character === 'x' ? digit : digit & 3 | 8).toString(16); });
    matchReward = null;
    renderProgress();
    debugLog.length = 0;
    $('player-speech').textContent = '때려봐. 나 공이야.';
    $('ai-speech').textContent = '나한테 왜 이러는데.';
    $('elapsed').textContent = '00:00';
    log('전투 시작. 내 왁뿌볼을 클릭하세요!');
    processEvents();
    // Commit the reset width before re-enabling damage transitions. A rematch
    // must not carry the previous round's partly empty animated health bar.
    for (const side of ['player', 'ai']) {
      void $(`${side}-fill`).offsetWidth;
      $(`${side}-fill`).style.transition = '';
    }
    if (!document.hidden) frame = requestAnimationFrame(tick);
    balls.player.focus({ preventScroll: true });
  }
  balls.player.addEventListener('click', () => { if (!orientationBlocked && !document.hidden && screen === SCREENS.BATTLE && battle.hit('player')) processEvents(); });
  function openDifficulty() {
    if (orientationBlocked || (screen !== SCREENS.LOBBY && screen !== SCREENS.MODES)) return;
    describeDifficulty();
    difficultyDialog.showModal();
    difficultySelect.focus();
  }
  $('fight-button').addEventListener('click', openDifficulty);
  $('ai-mode-button').addEventListener('click', openDifficulty);
  $('confirm-battle').addEventListener('click', () => { if (difficultyDialog.open) start(); });
  $('mode-open').addEventListener('click', () => { if (!orientationBlocked) { showScreen(SCREENS.MODES); $('ai-mode-button').focus(); } });
  $('mode-back').addEventListener('click', returnToLobby);
  $('lab-open').addEventListener('click', () => {
    if (orientationBlocked || screen !== SCREENS.LOBBY) return;
    showScreen(SCREENS.LAB);
    renderProgress();
    $('lab-back').focus({ preventScroll: true });
  });
  $('lab-back').addEventListener('click', returnToLobby);
  const labCopy = {
    upgrade: { title: '강화 실험실', intro: '더 세질 수도, 공중분해될 수도.', warning: '강화에 실패하면 왁뿌볼이 파괴될 수 있어요.', button: '강화 실험 준비 중', speech: '성공하면 내 덕. 터지면 공 탓.' },
    draw: { title: '왁뿌볼 뽑기', intro: '어떤 공이 나올지는 박사도 모름.', warning: '새로운 왁뿌볼을 만나는 실험을 준비 중입니다.', button: '뽑기 실험 준비 중', speech: '이번 공은… 아마 둥글 겁니다.' }
  };
  for (const button of document.querySelectorAll('[data-lab-action]')) button.addEventListener('click', () => {
    if (orientationBlocked || screen !== SCREENS.LAB) return;
    const mode = button.dataset.labAction, copy = labCopy[mode];
    $('lab-dialog').dataset.mode = mode;
    $('lab-dialog-title').textContent = copy.title;
    $('lab-dialog-intro').textContent = copy.intro;
    $('lab-risk').textContent = copy.warning;
    $('lab-future-action').textContent = copy.button;
    $('lab-scientist-speech').textContent = copy.speech;
    $('lab-upgrade-details').hidden = mode !== 'upgrade';
    $('lab-draw-details').hidden = mode !== 'draw';
    $('lab-dialog').showModal();
    $('lab-dialog-close').focus();
  });
  $('lab-dialog-close').addEventListener('click', () => $('lab-dialog').close());
  $('lobby-button').addEventListener('click', returnToLobby);
  $('leave-battle-button').addEventListener('click', returnToLobby);
  document.querySelectorAll('[data-unavailable]').forEach(button => button.addEventListener('click', () => {
    if (orientationBlocked) return;
    $(screen === SCREENS.MODES ? 'mode-notice' : 'menu-notice').textContent = '아직 개발 안 함 ㅋㅋ · 지금은 AI 대전만 가능!';
    animate(button, [{ transform: 'scale(1)' }, { transform: 'scale(.92) rotate(-2deg)' }, { transform: 'scale(1)' }], { duration: 180 });
  }));
  $('start-button').addEventListener('click', start);
  $('rematch-button').addEventListener('click', start);
  document.addEventListener('visibilitychange', () => {
    stopLoop();
    if (!orientationBlocked && !document.hidden && screen === SCREENS.BATTLE && battle.status === STATES.RUNNING) frame = requestAnimationFrame(tick);
  });
  window.addEventListener('pagehide', () => { stopLoop(); clearEffects(); });
  window.addEventListener('storage', event => {
    if (event.key === window.WaxArena.PROGRESS_STORAGE_KEY || event.key === null) { progress.refresh(); renderProgress(); }
  });
  window.addEventListener('pageshow', () => {
    if (frame === null && !orientationBlocked && !document.hidden && screen === SCREENS.BATTLE && battle.status === STATES.RUNNING) frame = requestAnimationFrame(tick);
  });
  function updateOrientation() {
    const blocked = portraitQuery.matches;
    orientationBlocked = blocked;
    if (orientationBlocked && difficultyDialog.open) difficultyDialog.close();
    if (orientationBlocked && $('account-dialog').open) $('account-dialog').close();
    if (orientationBlocked && $('lab-dialog').open) $('lab-dialog').close();
    $('game-root').inert = orientationBlocked;
    document.body.classList.toggle('orientation-blocked', orientationBlocked);
    $('orientation-gate').hidden = !orientationBlocked;
    stopLoop();
    clearEffects();
    render();
    if (orientationBlocked) $('rotate-title').focus({ preventScroll: true });
    else {
      if (screen === SCREENS.BATTLE && battle.status === STATES.RUNNING && !document.hidden) frame = requestAnimationFrame(tick);
    const target = screen === SCREENS.BATTLE ? balls.player : screen === SCREENS.RESULT ? $('start-button') : screen === SCREENS.MODES ? $('ai-mode-button') : screen === SCREENS.LAB ? $('lab-back') : $('fight-button');
      if (target && !target.disabled) {
        target.focus({ preventScroll: true });
        // Let the orientation gate's hidden/inert styles settle before restoring
        // focus after a native modal was closed during rotation.
        if (screen === SCREENS.LAB) requestAnimationFrame(() => {
          if (!orientationBlocked && screen === SCREENS.LAB && !$('lab-dialog').open) $('lab-back').focus({ preventScroll: true });
        });
      }
    }
  }
  portraitQuery.addEventListener('change', updateOrientation);
  // Mobile browser bars can reduce the visible viewport without changing the
  // layout viewport. Size the game to the space the player can actually see.
  function sizeVisibleViewport() {
    const viewport = window.visualViewport;
    const useVisual = viewport && viewport.scale === 1;
    const height = Math.round(useVisual ? Math.min(innerHeight, viewport.height) : innerHeight);
    document.documentElement.style.setProperty('--app-height', `${height}px`);
    document.documentElement.style.setProperty('--viewport-top', `${useVisual ? viewport.offsetTop : 0}px`);
    const mobile = matchMedia('(pointer: coarse), (max-width: 950px)').matches;
    document.documentElement.classList.toggle('mobile-layout', mobile);
    document.documentElement.classList.toggle('viewport-tight', mobile && !portraitQuery.matches && height <= 280);
  }
  window.addEventListener('resize', sizeVisibleViewport);
  window.visualViewport?.addEventListener('resize', sizeVisibleViewport);
  window.visualViewport?.addEventListener('scroll', sizeVisibleViewport);
  sizeVisibleViewport();
  // Keep keyboard focus inside the result dialog, including reverse tabbing.
  $('result').addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const first = $('start-button'), last = $('lobby-button');
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  log('아레나 준비 완료. 전투 시작을 눌러 입장하세요.');
  processEvents();
  updateOrientation();
  // Read-only snapshots help debugging and a future transport adapter.
  window.WaxArena.getSnapshot = () => ({ status: battle.status, difficulty: battle.difficulty, aiHitIntervalMs: battle.aiHitIntervalMs, round: battle.round, time: battle.time, player: { ...battle.fighters.player }, ai: { ...battle.fighters.ai }, pendingCount: battle.pending.length });
  window.WaxArena.getDebugLog = () => debugLog.map(entry => ({ ...entry }));
  window.WaxArena.getScreen = () => screen;
  window.WaxArena.getProgress = () => progress.getSnapshot();
  window.WaxArena.useAccountProgress = (store, nickname = '게스트 공') => {
    if (![SCREENS.LOBBY, SCREENS.MODES].includes(screen)) return false;
    progress.onChange = () => {};
    progress = store || guestProgress;
    progress.onChange = renderProgress;
    if (!store) guestProgress.refresh();
    matchReward = null;
    $('profile-name').textContent = nickname;
    renderProgress();
    return true;
  };
  window.WaxArena.syncAccountProgress = () => Promise.resolve(progress.refresh());
})();
