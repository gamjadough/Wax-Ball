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
  const balls = { player: $('player-ball'), ai: $('ai-ball') };
  const effects = $('effects');
  const animations = new Set();
  // Bounded diagnostics stay in memory; combat logs are not player-facing UI.
  const debugLog = [];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const inputVerb = window.matchMedia('(pointer: coarse)').matches ? '터치' : '클릭';
  const SCREENS = Object.freeze({ LOBBY: 'lobby', BATTLE: 'battle', RESULT: 'result' });
  let screen = SCREENS.LOBBY;
  // No economy exists yet: display the actual initial balance without invented rewards.
  const wallet = { gold: 0 };
  $('gold-amount').firstChild.textContent = `${wallet.gold.toLocaleString()} `;
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
    $('battle-screen').hidden = screen === SCREENS.LOBBY;
    $('result').hidden = screen !== SCREENS.RESULT;
  }
  function returnToLobby() {
    if (screen === SCREENS.LOBBY) return;
    stopLoop();
    clearEffects();
    battle.reset(false);
    lastSecond = -1;
    $('elapsed').textContent = '00:00';
    $('menu-notice').textContent = '';
    showScreen(SCREENS.LOBBY);
    processEvents();
    $('fight-button').focus({ preventScroll: true });
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
    const point = center(side);
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      const length = 55 + Math.random() * 60;
      const node = effectNode(`particle ${side}`, point);
      animate(node, [{ transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(angle) * length}px, ${Math.sin(angle) * length + 45}px) rotate(${i * 53}deg) scale(.4)`, opacity: 0 }], { duration: 540, easing: 'cubic-bezier(.15,.6,.4,1)' }, true);
    }
  }
  function launch(side, target) {
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
      $(`${side}-hp`).replaceChildren(document.createTextNode(fighter.health.toLocaleString() + ' '));
      const max = document.createElement('small');
      max.textContent = `/ ${CONFIG.maxHealth.toLocaleString()}`;
      $(`${side}-hp`).append(max);
      if (battle.status !== STATES.RUNNING) $(`${side}-fill`).style.transition = 'none';
      $(`${side}-fill`).style.width = `${fighter.health / CONFIG.maxHealth * 100}%`;
      $(`${side}-health`).setAttribute('aria-valuenow', fighter.health);
      balls[side].dataset.hits = fighter.hits;
    }
    balls.player.disabled = screen !== SCREENS.BATTLE || battle.status !== STATES.RUNNING || battle.fighters.player.breaking;
    $('player-hint').textContent = battle.status === STATES.RUNNING ? (battle.fighters.player.breaking ? '파괴 중! 공격을 준비합니다' : `${inputVerb}해서 균열을 만드세요`) : `전투 시작 후 ${inputVerb}할 수 있습니다`;
    if (displayedStatus !== battle.status) {
      displayedStatus = battle.status;
      const running = battle.status === STATES.RUNNING;
      const waiting = battle.status === STATES.WAITING;
      $('battle-status').textContent = running ? 'BATTLE IN PROGRESS' : waiting ? 'READY' : 'MATCH FINISHED';
      $('ai-hint').textContent = running ? '● AI가 왁뿌볼을 파괴하고 있습니다' : '● AI 대기 중';
      if (!running) {
        const victory = battle.status === STATES.VICTORY;
        $('result-kicker').textContent = waiting ? 'READY TO FIGHT' : victory ? 'ARENA CONQUERED' : 'TRY ONE MORE TIME';
        $('result-title').textContent = waiting ? '아레나에 입장하세요' : victory ? 'VICTORY · 승리' : 'DEFEAT · 패배';
        $('result-description').textContent = waiting ? '5번의 타격으로 왁뿌볼을 파괴하고 공격하세요.' : `전투 시간 ${clock(battle.time)} · ${victory ? '상대의 왁뿌볼을 압도했습니다.' : '다시 도전해 아레나를 차지하세요.'}`;
        $('start-button').firstChild.textContent = waiting ? '전투 시작 ' : '다시 도전 ';
      }
    }
  }
  function processEvents() {
    for (const event of battle.drainEvents()) {
      if (event.round !== battle.round) continue;
      if (event.type === 'hit') {
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
        stopLoop();
        clearEffects();
        showScreen(SCREENS.RESULT);
        log(event.status === STATES.VICTORY ? '승리! 상대의 체력이 0이 되었습니다.' : '패배. 내 체력이 0이 되었습니다.');
      }
    }
    render();
    if (screen === SCREENS.RESULT && !$('result').contains(document.activeElement)) $('start-button').focus({ preventScroll: true });
  }
  function tick(timestamp) {
    frame = null;
    if (screen !== SCREENS.BATTLE || battle.status !== STATES.RUNNING) return;
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
    stopLoop();
    showScreen(SCREENS.BATTLE);
    lastSecond = -1;
    clearEffects();
    for (const side of ['player', 'ai']) $(`${side}-fill`).style.transition = 'none';
    battle.reset(true, difficultySelect.value);
    debugLog.length = 0;
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
  balls.player.addEventListener('click', () => { if (screen === SCREENS.BATTLE && battle.hit('player')) processEvents(); });
  $('fight-button').addEventListener('click', () => { if (screen === SCREENS.LOBBY) start(); });
  $('lobby-button').addEventListener('click', returnToLobby);
  $('leave-battle-button').addEventListener('click', returnToLobby);
  document.querySelectorAll('[data-unavailable]').forEach(button => button.addEventListener('click', () => {
    $('menu-notice').textContent = '아직 개발 안 함 ㅋㅋ';
    animate(button, [{ transform: 'scale(1)' }, { transform: 'scale(.92) rotate(-2deg)' }, { transform: 'scale(1)' }], { duration: 180 });
  }));
  $('start-button').addEventListener('click', start);
  $('rematch-button').addEventListener('click', start);
  document.addEventListener('visibilitychange', () => {
    stopLoop();
    if (!document.hidden && screen === SCREENS.BATTLE && battle.status === STATES.RUNNING) frame = requestAnimationFrame(tick);
  });
  window.addEventListener('pagehide', () => { stopLoop(); clearEffects(); });
  window.addEventListener('pageshow', () => {
    if (frame === null && !document.hidden && screen === SCREENS.BATTLE && battle.status === STATES.RUNNING) frame = requestAnimationFrame(tick);
  });
  log('아레나 준비 완료. 전투 시작을 눌러 입장하세요.');
  processEvents();
  // Read-only snapshots help debugging and a future transport adapter.
  window.WaxArena.getSnapshot = () => ({ status: battle.status, difficulty: battle.difficulty, aiHitIntervalMs: battle.aiHitIntervalMs, round: battle.round, time: battle.time, player: { ...battle.fighters.player }, ai: { ...battle.fighters.ai }, pendingCount: battle.pending.length });
  window.WaxArena.getDebugLog = () => debugLog.map(entry => ({ ...entry }));
  window.WaxArena.getScreen = () => screen;
})();
