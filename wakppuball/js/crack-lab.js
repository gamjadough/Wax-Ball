// Standalone browser challenge; never writes game progress or server rewards.
(() => {
  'use strict';
  const nav = document.querySelector('#game .bottom .actions');
  if (!nav) return;
  const key = 'wakppu-crack-lab:v1:best';
  const duration = 30_000;
  const spots = [[50, 24], [68, 34], [73, 55], [60, 72], [37, 71], [26, 53], [32, 34], [50, 49]];
  let score = 0, combo = 0, maxCombo = 0, hits = 0, current = -1;
  let deadline = 0, clock = 0, active = false, best = 0, blockKeyboardUntil = 0;
  try { best = Math.max(0, Number.parseInt(localStorage.getItem(key), 10) || 0); } catch {}

  const enter = document.createElement('button');
  enter.id = 'crackLabBtn';
  enter.className = 'btn';
  enter.type = 'button';
  enter.textContent = '🧪 실험실';
  enter.setAttribute('aria-haspopup', 'dialog');
  enter.setAttribute('aria-controls', 'crackLab');
  const menu = document.createElement('nav');
  menu.className = 'crack-lab-menu';
  menu.setAttribute('aria-label', '실험실 전용 메뉴');
  menu.innerHTML = '<div><strong>WAX LAB</strong><span>30초 균열 챌린지</span></div>';
  menu.append(enter);
  nav.after(menu);

  const dialog = document.createElement('dialog');
  dialog.id = 'crackLab';
  dialog.setAttribute('aria-labelledby', 'crackLabTitle');
  dialog.innerHTML = `
    <header class="lab-head">
      <div><p class="lab-kicker">WAX LAB / 01</p><h2 id="crackLabTitle">균열 챌린지</h2></div>
      <button class="btn small" data-lab-close type="button">돌아가기</button>
    </header>
    <div class="lab-body">
      <div class="lab-board" aria-label="실험실 전용 볼">
        <div class="lab-ball" aria-hidden="true"><svg class="lab-ball-art" viewBox="0 0 200 200"></svg></div>
        <div class="lab-effects" aria-hidden="true"></div>
        <button class="lab-target" type="button" aria-label="빛나는 균열 맞히기" hidden>
          <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 7l8 5-2 5 7-1 1 6 8 5M18 16l6-7M11 17l-6 6"/></svg>
        </button>
      </div>
      <div class="lab-info">
        <p class="lab-description">30초 동안 빛나는 균열을 눌러 콤보를 이어가세요. 빗맞히면 콤보가 끊겨요.</p>
        <dl class="lab-stats">
          <div><dt>남은 시간</dt><dd data-lab-time>30초</dd></div>
          <div><dt>점수</dt><dd data-lab-score>0</dd></div>
          <div><dt>콤보</dt><dd data-lab-combo>0</dd></div>
        </dl>
        <progress max="30" value="30" aria-label="남은 시간"></progress>
        <p class="lab-feedback" role="status" aria-atomic="true"></p>
        <p class="lab-streak" aria-hidden="true"></p>
        <button class="btn primary lab-start" type="button" autofocus>도전 시작</button>
        <p class="lab-best">내 최고 기록 <strong data-lab-best></strong> · 이 브라우저에 저장</p>
      </div>
    </div>`;
  document.body.append(dialog);
  const $ = selector => dialog.querySelector(selector);
  const board = $('.lab-board'), target = $('.lab-target'), start = $('.lab-start'), feedback = $('.lab-feedback');
  const timeOut = $('[data-lab-time]'), scoreOut = $('[data-lab-score]'), comboOut = $('[data-lab-combo]');
  const bestOut = $('[data-lab-best]'), bar = $('progress');

  const art = $('.lab-ball-art'), ballVisual = $('.lab-ball'), effects = $('.lab-effects'), streak = $('.lab-streak');
  const wax = typeof WAKPPU_BALLS !== 'undefined' && WAKPPU_BALLS.find(ball => ball.id === 'yellow');
  const sound = wax && typeof getSoundConfig === 'function' ? getSoundConfig(wax) : null;
  if (wax && typeof buildBallSvgInner === 'function') art.innerHTML = buildBallSvgInner(wax, 'crack-lab-wax');
  const artCracks = art.querySelector('[id="crack-lab-wax-cracks"]');
  const paths = ['M52 47l13 9-4 11 14 20-3 10 10 14','M74 87l21-5 12 9 11-11 21 4','M106 91l-5 20 13 14-3 20 12 14','M137 84l11-12 15-4 12-11','M80 110l-17 9-7 17-18 11','M106 119l20-3 16 12 18-1'];
  let squash, streakAnim;
  function primeSound() {
    if (!sound || typeof SoundManager === 'undefined') return;
    SoundManager.unlock();
    SoundManager.init(sound.sequence || sound.early || []);
  }
  function impactSound(index) {
    if (!sound || typeof SoundManager === 'undefined') return;
    const sequence = sound.sequence || sound.early;
    if (sequence?.length) SoundManager.play(sequence[Math.min(index, sequence.length - 1)], {
      pitch: sound.pitch, pitchRandom: sound.pitchRandom, volume: sound.volume, volumeRandom: sound.volumeRandom,
    });
  }
  function redrawCracks() {
    if (!artCracks) return;
    const n = combo ? Math.min(paths.length, 1 + Math.floor((combo - 1) / 2)) : 0;
    const d = paths.slice(0,n).join(' ');
    artCracks.innerHTML = n ? '<path d="'+d+'" fill="none" stroke="#603807" opacity=".9" stroke-width="2.4" stroke-linejoin="round"/><path d="'+d+'" transform="translate(1 1)" fill="none" stroke="#fff1aa" opacity=".76" stroke-width="1" stroke-linejoin="round"/>' : '';
  }
  function hitFeedback(earned) {
    const landmark = combo % 5 === 0;
    streak.textContent = combo + ' 콤보!  +' + earned + '점';
    streak.classList.toggle('lab-milestone', landmark);
    redrawCracks();
    if (window.WakppuSettings?.reduced?.() || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    squash?.cancel();
    squash = ballVisual.animate([{transform:'scale(1)'},{transform:landmark?'scale(1.085,.90)':'scale(1.05,.94)',offset:.24},{transform:'scale(.98,1.03)',offset:.64},{transform:'scale(1)'}],{duration:landmark?255:175,easing:'ease-out'});
    streakAnim?.cancel();
    streakAnim = streak.animate([{transform:'scale(.94)'},{transform:landmark?'scale(1.13)':'scale(1.06)',offset:.28},{transform:'scale(1)'}],{duration:280,easing:'ease-out'});
    const burst = document.createElement('span');
    burst.className = 'lab-burst'+(landmark?' lab-burst-strong':'');
    burst.style.left=spots[current][0]+'%';
    burst.style.top=spots[current][1]+'%';
    const count = landmark ? 10 : 5;
    for (let i=0;i<count;i++) {
      const chip=document.createElement('i');
      const angle=i/count*2*Math.PI + Math.random()*.4;
      const size=(landmark?45:27)+Math.random()*14;
      chip.style.setProperty('--dx',(Math.cos(angle)*size)+'px');
      chip.style.setProperty('--dy',(Math.sin(angle)*size)+'px');
      burst.append(chip);
    }
    if(effects.childElementCount>=8) effects.firstElementChild.remove();
    effects.append(burst);
    setTimeout(()=>burst.remove(),450);
  }


  function renderScore() {
    scoreOut.textContent = score.toLocaleString('ko-KR');
    comboOut.textContent = combo;
    bestOut.textContent = best.toLocaleString('ko-KR') + '점';
  }
  function showTime(remaining) {
    const seconds = Math.ceil(remaining / 1000);
    if (bar.value !== seconds) bar.value = seconds;
    const label = seconds + '초';
    if (timeOut.textContent !== label) timeOut.textContent = label;
  }
  function moveTarget() {
    const previous = current;
    const choices = spots.map((_, i) => i).filter(i => i !== previous && (previous < 0 ||
      Math.hypot(spots[i][0] - spots[previous][0], spots[i][1] - spots[previous][1]) >= 25));
    current = choices[Math.floor(Math.random() * choices.length)];
    target.style.setProperty('--target-x', spots[current][0] + '%');
    target.style.setProperty('--target-y', spots[current][1] + '%');
  }
  function stop() {
    active = false;
    clearTimeout(clock);
    target.hidden = true;
    board.classList.remove('lab-active');
    squash?.cancel(); streakAnim?.cancel();
    effects.replaceChildren();
  }
  function reset() {
    stop();
    score = combo = maxCombo = hits = 0;
    current = -1;
    streak.textContent = '';
    streak.classList.remove('lab-milestone');
    redrawCracks();
    renderScore();
    showTime(duration);
    feedback.textContent = '일반 모드의 Gold·망치·펫은 적용되지 않아요.';
    start.textContent = '도전 시작';
    start.hidden = false;
  }
  function finish() {
    if (!active) return;
    stop();
    showTime(0);
    const record = score > best;
    if (record) {
      best = score;
      try { localStorage.setItem(key, String(best)); } catch {}
    }
    renderScore();
    feedback.textContent = (record ? '신기록! ' : '도전 완료! ') + `균열 ${hits}번 · 최고 콤보 ${maxCombo}`;
    start.textContent = '다시 하기';
    start.hidden = false;
    start.focus({preventScroll:true});
  }
  function tick() {
    const remaining = Math.max(0, deadline - performance.now());
    showTime(remaining);
    if (remaining === 0) finish();
    else clock = setTimeout(tick, Math.min(remaining, 100));
  }
  function begin() {
    reset();
    primeSound();
    deadline = performance.now() + duration;
    active = true;
    blockKeyboardUntil = performance.now() + 250;
    board.classList.add('lab-active');
    moveTarget();
    target.hidden = false;
    start.hidden = true;
    feedback.textContent = '빛나는 균열을 맞혀보세요!';
    target.focus({preventScroll:true});
    tick();
  }
  function inTime() {
    if (!active) return false;
    if (performance.now() < deadline) return true;
    finish();
    return false;
  }
  let opening = false, ownsFullscreen = false;
  enter.addEventListener('click', async () => {
    if (dialog.open || opening) return;
    opening = true;
    reset();
    primeSound();
    const root = document.documentElement;
    if (!document.fullscreenElement && root.requestFullscreen) {
      // A dialog cannot itself enter native fullscreen. Enter on the root first,
      // then place the dialog in the top layer, above it.
      try {
        await root.requestFullscreen();
        ownsFullscreen = document.fullscreenElement === root;
      } catch {} // CSS keeps the view full-window even when native fullscreen is unavailable.
    }
    opening = false;
    dialog.showModal();
  });
  $('[data-lab-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    if (ownsFullscreen && document.fullscreenElement === document.documentElement) {
      document.exitFullscreen().catch(()=>{});
    }
    ownsFullscreen = false;
    stop();
    if (enter.getClientRects().length) enter.focus({preventScroll:true});
  });
  document.addEventListener('visibilitychange', () => {
    if (active && !document.hidden && performance.now() >= deadline) finish();
  });
  start.addEventListener('click', begin);
  target.addEventListener('keydown', event => {
    if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
  });
  target.addEventListener('click', event => {
    if (!inTime()) return;
    if (event.detail === 0 && performance.now() < blockKeyboardUntil) return;
    blockKeyboardUntil = performance.now() + 250;
    hits++;
    combo++;
    if (combo === 1) feedback.textContent = '';
    maxCombo = Math.max(maxCombo, combo);
    const earned = 10 + Math.min(20, 2 * (combo - 1));
    score += earned;
    impactSound((combo - 1) % 5);
    hitFeedback(earned);
    renderScore();
    // Keep focus on the same control for keyboard play; positions apply to touch/mouse.
    moveTarget();
  });
  board.addEventListener('click', event => {
    if (target.contains(event.target) || !inTime()) return;
    impactSound(0);
    if (combo) {
      combo = 0;
      streak.textContent = '';
      streak.classList.remove('lab-milestone');
      redrawCracks();
      renderScore();
      feedback.textContent = '빗맞혔어요. 콤보가 초기화됐어요.';
    }
  });
})();
