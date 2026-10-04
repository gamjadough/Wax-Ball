/* ==========================================================================
   game.js  —  왁뿌볼 게임 본체
   --------------------------------------------------------------------------
   흐름:  클릭 → 소리 재생 + 눌림 애니메이션 + 금 늘리기
          → 마지막 클릭이면 깨짐 연출 + 골드 획득 → 새 왁뿌볼 등장
   숫자(HP, 데미지, 진행도)는 화면에 표시하지 않아요.
   ========================================================================== */
(() => {
  'use strict';

  /* ---------- 연출 시간 (밀리초) ---------- */
  const RESPAWN_DELAY_MS = 1000;   // 깨진 뒤 새 왁뿌볼이 나오기까지 걸리는 시간

  /* ---------- 화면 요소 ---------- */
  const $ = (id) => document.getElementById(id);
  const svgEl = $('ballSvg');
  const wrap = $('ballWrap');
  const stage = $('stage');
  const effects = $('effects');
  const flashEl = $('flash');
  const hintEl = $('hint');
  const goldEl = $('goldValue');
  const nameEl = $('ballName');
  const gradeEl = $('ballGrade');
  const unlockBtn = $('unlockBtn');
  const collectionBtn = $('collectionBtn');
  const modal = $('collection');
  const grid = $('collectionGrid');
  const closeBtn = $('collectionClose');
  const rebirthBtn = $('rebirthBtn');
  const rankingBtn = $('rankingBtn');
  const rebirthModal = $('rebirth');
  const rankingModal = $('ranking');
  const rebirthText = $('rebirthText');
  const rebirthConfirm = $('rebirthConfirm');
  const rankingStatus = $('rankingStatus');
  const rankingList = $('rankingList');
  const hammerBtn = $('hammerBtn');
  const hammerUseBtn = $('hammerUseBtn');

  const NS = 'http://www.w3.org/2000/svg';

  /* ---------- 게임 상태 ---------- */
  const state = {
    gold: 0,
    rebirths: 0,
    unlocked: WAKPPU_BALLS.map((b, i) => i === 0),  // 처음엔 첫 번째(노란색)만 해금
    selected: 0,        // 지금 깨고 있는 왁뿌볼 번호
    clicks: 0,          // 현재 왁뿌볼을 누른 횟수 (화면엔 표시 안 함)
    busy: false,        // 깨지는 연출 중에는 true
    uid: '',            // 현재 SVG 의 id 접두어
    cracks: [],         // 현재 왁뿌볼의 금 목록
    respawnTimer: null,
    lastSound: null,    // 같은 소리가 연달아 나오지 않게 기억
    hammerOwned: false,
    hammerLevel: 0,
  };

  const HAMMERS = [
    { name: '나무 망치', cracks: 3, cost: 100 },
    { name: '강화 나무 망치', cracks: 5, cost: 500 },
    { name: '단단한 나무 망치', cracks: 8, cost: 2000 },
    { name: '철제 보강 망치', cracks: 12, cost: 10000 },
    { name: '강철 망치', cracks: 18, cost: 50000 },
    { name: '중형 강철 망치', cracks: 27, cost: 250000 },
    { name: '강화 강철 망치', cracks: 40, cost: 1000000 },
    { name: '특수 합금 망치', cracks: 60, cost: 5000000 },
    { name: '고급 합금 망치', cracks: 90, cost: 25000000 },
    { name: '최종 망치', cracks: 135, cost: 100000000 },
  ];

  /* ---------- 브라우저 자동 저장 ---------- */
  const SAVE_KEY = 'wax-ball:wakppuball:save';
  const SAVE_VERSION = 3;

  function saveProgress() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        version: SAVE_VERSION,
        gold: state.gold,
        rebirths: state.rebirths,
        unlocked: state.unlocked,
        selected: state.selected,
        hammerOwned: state.hammerOwned,
        hammerLevel: state.hammerLevel,
      }));
    } catch (error) {
      // 저장소가 차단되거나 가득 차도 현재 플레이는 계속합니다.
      console.warn('왁뿌볼 진행 상황을 저장하지 못했습니다.', error);
    }
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || ![1, 2, SAVE_VERSION].includes(saved.version) ||
          !Number.isSafeInteger(saved.gold) || saved.gold < 0 ||
          !Array.isArray(saved.unlocked) || saved.unlocked[0] !== true ||
          !saved.unlocked.every((value) => typeof value === 'boolean')) return;

      // 볼이 추가되어도 기존 해금은 유지하고 새 볼은 잠긴 상태로 시작합니다.
      const unlocked = WAKPPU_BALLS.map((_, index) => saved.unlocked[index] === true);
      // 해금은 순서대로만 가능하므로 중간에 잠긴 볼이 있는 데이터는 복구하지 않습니다.
      let locked = false;
      for (const open of unlocked) {
        if (!open) locked = true;
        else if (locked) return;
      }
      const selected = Number.isInteger(saved.selected) &&
        saved.selected >= 0 && saved.selected < unlocked.length &&
        unlocked[saved.selected] ? saved.selected : 0;
      state.gold = saved.gold;
      state.rebirths = Number.isSafeInteger(saved.rebirths) && saved.rebirths >= 0 ? saved.rebirths : 0;
      state.unlocked = unlocked;
      state.selected = selected;
      state.hammerOwned = saved.hammerOwned === true;
      state.hammerLevel = state.hammerOwned && Number.isInteger(saved.hammerLevel) && saved.hammerLevel >= 1 && saved.hammerLevel <= HAMMERS.length ? saved.hammerLevel : (state.hammerOwned ? 1 : 0);
    } catch (error) {
      // 손상된 데이터나 저장소 접근 오류가 있어도 게임을 시작할 수 있습니다.
      console.warn('왁뿌볼 저장 데이터를 불러오지 못했습니다.', error);
    }
  }

  /* ---------- 작은 도우미 함수 ---------- */
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const fmt = (n) => n.toLocaleString('ko-KR');
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function mk(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  /* 시드가 있는 랜덤 (금 모양을 볼마다 다르게 만들기 위해) */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ==========================================================================
     1. 금(crack) 만들기
     --------------------------------------------------------------------------
     볼이 나올 때 금 전체를 미리 설계해 두고,
     클릭할수록 각 금이 조금씩 "자라나게" 보여줘요.
       start~end : 그 금이 자라는 진행도 구간 (0~1)
     ========================================================================== */

  /* 지그재그로 뻗는 선 */
  function jaggedLine(x, y, ang, len, rng) {
    const pts = [{ x, y }];
    let a = ang, d = 0;
    while (d < len) {
      a += (rng() - 0.5) * 1.0;
      const s = (8 + rng() * 4) * (0.75 + rng() * 0.5);
      x += Math.cos(a) * s;
      y += Math.sin(a) * s;
      d += s;
      pts.push({ x, y });
      a = ang + (a - ang) * 0.55;   // 원래 방향쪽으로 다시 살짝 끌어당김
    }
    return pts;
  }

  const toPath = (pts) => 'M' + pts.map((p) => p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' L');

  function designCracks(shape, total, rng) {
    const list = [];
    const mainCount = clamp(4 + Math.floor(total / 5), 5, 10);   // 큰 금 개수
    const baseAngle = rng() * Math.PI * 2;

    for (let i = 0; i < mainCount; i++) {
      const ang = baseAngle + (i / mainCount) * Math.PI * 2 + (rng() - 0.5) * 0.6;
      const r0 = rng() * 22, a0 = rng() * Math.PI * 2;
      const sx = shape.cx + Math.cos(a0) * r0;
      const sy = shape.cy + Math.sin(a0) * r0;

      // 첫 번째 금은 첫 클릭부터 바로 보이도록 진행도 0 이전에 시작
      const start = -0.06 + (i / mainCount) * 0.6 + rng() * 0.05;
      const dur = i === 0 ? 0.14 : 0.2 + rng() * 0.2;
      const end = Math.min(0.93, start + dur);
      const pts = jaggedLine(sx, sy, ang, 105, rng);
      list.push({ d: toPath(pts), start, end, weight: 1 });

      // 큰 금에서 갈라져 나가는 작은 금
      const branchCount = 1 + (rng() < 0.6 ? 1 : 0);
      for (let k = 0; k < branchCount; k++) {
        const idx = 2 + Math.floor(rng() * Math.max(1, pts.length - 5));
        const bp = pts[idx];
        const frac = idx / (pts.length - 1);
        const bAng = ang + (rng() < 0.5 ? -1 : 1) * (0.5 + rng() * 0.6);
        const bpts = jaggedLine(bp.x, bp.y, bAng, 28 + rng() * 40, rng);
        const bStart = Math.min(0.85, start + frac * (end - start) + 0.02 + rng() * 0.04);
        const bEnd = Math.min(0.95, bStart + 0.16 + rng() * 0.1);
        list.push({ d: toPath(bpts), start: bStart, end: Math.max(bEnd, bStart + 0.05), weight: 0.6 });
      }
    }
    return list;
  }

  /* 금을 SVG 에 그려 넣기 (처음엔 모두 숨김) */
  function drawCracks(layer, cracks, design) {
    const c = design.crack;
    cracks.forEach((cr) => {
      const common = {
        d: cr.d, pathLength: '1', fill: 'none',
        'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': '1 1',
      };
      // 넓고 흐린 그림자 → 어두운 금 → 밝은 가장자리 순서로 겹쳐서 깊이감을 만들어요
      cr.wide = mk('path', Object.assign({}, common, { class: 'crack', stroke: c.dark }));
      cr.dark = mk('path', Object.assign({}, common, { class: 'crack', stroke: c.dark }));
      cr.light = mk('path', Object.assign({}, common, {
        class: 'crack', stroke: c.light, 'stroke-opacity': '0.6', transform: 'translate(0.9 0.9)',
      }));
      [cr.wide, cr.dark, cr.light].forEach((el) => {
        el.style.strokeDashoffset = '1';
        el.style.visibility = 'hidden';
        layer.appendChild(el);
      });
    });
  }

  /* 진행도 v(0~1)에 맞춰 금을 자라게 하기 */
  function updateCracks(v) {
    state.cracks.forEach((cr) => {
      // v === 0 (아직 클릭 전)이면 금이 하나도 보이면 안 돼요
      const frac = v <= 0 ? 0 : clamp((v - cr.start) / (cr.end - cr.start), 0, 1);
      const vis = frac > 0.001 ? 'visible' : 'hidden';
      const off = String(1 - frac);
      const w = cr.weight * (0.8 + v * 1.9);          // 진행될수록 금이 굵어져요
      cr.wide.style.strokeWidth = (w * 2.6).toFixed(2);
      cr.wide.style.strokeOpacity = (0.08 + 0.22 * v).toFixed(2);
      cr.dark.style.strokeWidth = w.toFixed(2);
      cr.light.style.strokeWidth = (w * 0.45).toFixed(2);
      [cr.wide, cr.dark, cr.light].forEach((el) => {
        el.style.strokeDashoffset = off;
        el.style.visibility = vis;
      });
    });
  }

  /* ==========================================================================
     2. 왁뿌볼 등장시키기
     ========================================================================== */
  function spawnBall(animate) {
    clearTimeout(state.respawnTimer);
    const data = WAKPPU_BALLS[state.selected];
    const shape = SHAPES[data.design.shape] || SHAPES.circle;
    const uid = makeUid();

    state.uid = uid;
    state.clicks = 0;
    svgEl.innerHTML = buildBallSvgInner(data, uid);

    const layer = svgEl.querySelector('#' + uid + '-cracks');
    const rng = mulberry32((Math.random() * 4294967296) >>> 0);
    state.cracks = designCracks(shape, data.clicks, rng);
    drawCracks(layer, state.cracks, data.design);
    updateCracks(0);

    if (animate) {
      wrap.animate([
        { transform: 'scale(0.55)', opacity: 0 },
        { transform: 'scale(1.06)', opacity: 1, offset: 0.65 },
        { transform: 'scale(1)', opacity: 1 },
      ], { duration: 380, easing: 'ease-out' });
    }
    state.busy = false;
    if (state.hammerOwned) hammerUseBtn.disabled = false;
  }

  /* ==========================================================================
     3. 클릭 처리
     ========================================================================== */
  function onHit(clientX, clientY, damage = 1, isHammer = false) {
    if (state.busy) return;
    const data = WAKPPU_BALLS[state.selected];

    state.clicks = Math.min(data.clicks, state.clicks + damage);
    const total = data.clicks;
    const isFinal = state.clicks >= total;
    const v = state.clicks / total;      // 진행도 (화면엔 표시 안 함)

    hintEl.classList.add('gone');
    playHitSound(data, v, isFinal);      // ① 소리
    squish(clientX, v, isHammer);        // ② 눌림
    if (isFinal) {
      breakBall(data);                   // ③ 마지막: 깨짐
    } else {
      updateCracks(v);                   // ③ 금 늘리기
      const p = toStage(clientX, clientY);
      spawnChips(p.x, p.y, v < 0.35 ? 2 : 4, 1, data);
    }
  }

  function useHammer() {
    if (!state.hammerOwned || state.busy) return;
    const rect = wrap.getBoundingClientRect();
    onHit(rect.left + rect.width / 2, rect.top + rect.height / 2, HAMMERS[state.hammerLevel - 1].cracks, true);
  }

  function buyOrUpgradeHammer() {
    const nextLevel = state.hammerOwned ? state.hammerLevel + 1 : 1;
    const next = HAMMERS[nextLevel - 1];
    if (!next || state.gold < next.cost) return;
    state.gold -= next.cost;
    state.hammerOwned = true;
    state.hammerLevel = nextLevel;
    updateAll();
  }

  /* 진행도에 맞는 소리 고르기: 톡→딱→쩍→와작→(마지막) 파괴음 */
  function playHitSound(data, v, isFinal) {
    const cfg = getSoundConfig(data);
    let list;
    if (isFinal) list = cfg.final;
    else if (v < SOUND_PHASE_LIMITS.early) list = cfg.early;
    else if (v < SOUND_PHASE_LIMITS.mid) list = cfg.mid;
    else list = cfg.late;

    // 방금 낸 소리는 피해서 랜덤 선택 (같은 소리 반복 방지)
    let name = pick(list);
    if (list.length > 1) {
      let guard = 0;
      while (name === state.lastSound && guard++ < 8) name = pick(list);
    }
    state.lastSound = name;

    SoundManager.play(name, {
      pitch: cfg.pitch,
      pitchRandom: cfg.pitchRandom,
      volume: isFinal ? Math.min(1, cfg.volume * 1.15) : cfg.volume,
      volumeRandom: cfg.volumeRandom,
    });
  }

  /* 살짝 눌리는 애니메이션 */
  let squishAnim = null;
  function squish(clientX, v, isHammer = false) {
    const rect = wrap.getBoundingClientRect();
    const nx = clamp(((clientX - rect.left) / rect.width - 0.5) * 2, -1, 1);
    const press = (isHammer ? 0.12 : 0.06) + 0.03 * v;
    if (squishAnim) squishAnim.cancel();
    squishAnim = wrap.animate([
      { transform: 'scale(1,1) rotate(0deg)' },
      { transform: `scale(${1 + press * 0.7},${1 - press}) rotate(${(nx * 2.5).toFixed(2)}deg)`, offset: 0.3 },
      { transform: `scale(${1 - press * 0.25},${1 + press * 0.3}) rotate(${(-nx * 0.8).toFixed(2)}deg)`, offset: 0.65 },
      { transform: 'scale(1,1) rotate(0deg)' },
    ], { duration: 200, easing: 'ease-out' });
  }

  /* ==========================================================================
     4. 깨지는 연출
     ========================================================================== */
  function breakBall(data) {
    state.busy = true;
    // WebKit에서 마지막 균열을 한 프레임 이상 그린 뒤에만 SVG를 조각으로 교체합니다.
    svgEl.classList.add('instant');
    updateCracks(1);
    requestAnimationFrame(() => setTimeout(() => finishBreak(data), 110));
  }

  function finishBreak(data) {
    const shape = SHAPES[data.design.shape] || SHAPES.circle;
    makeShards(shape);
    wrap.classList.add('broken');
    const center = ballCenter();
    flash(data);
    spawnChips(center.x, center.y, 16, 3, data);
    // 파편이 실제로 보인 뒤 Gold를 지급하고, 끝난 뒤에만 다음 공을 만듭니다.
    setTimeout(() => {
      const reward = data.reward * rebirthMultiplier(state.rebirths);
      state.gold += reward;
      updateAll();
      floatText('+' + fmt(reward) + 'G', center.x, center.y - wrap.offsetHeight * 0.32);
    }, 260);
    clearTimeout(state.respawnTimer);
    state.respawnTimer = setTimeout(() => {
      wrap.classList.remove('broken');
      svgEl.classList.remove('instant');
      spawnBall(true);
    }, Math.max(RESPAWN_DELAY_MS, 1050));
  }

  /* 왁뿌볼을 조각으로 쪼개서 날리기 */
  function makeShards(shape) {
    const uid = state.uid;
    const defs = svgEl.querySelector('#' + uid + '-defs');
    const inner = svgEl.querySelector('#' + uid + '-inner');
    const hit = svgEl.querySelector('.hit');

    // 그림 본체를 defs 로 옮겨두고, 조각마다 <use> 로 가져다 써요
    defs.appendChild(inner);
    hit.remove();

    const S = 9;                          // 방향 개수
    const radii = [0, 34, 68, 140];       // 안쪽 → 바깥쪽 고리
    const startAng = Math.random() * Math.PI * 2;
    const P = [null];                     // P[고리][방향] = 꼭짓점 좌표
    for (let j = 1; j < radii.length; j++) {
      const ring = [];
      for (let i = 0; i < S; i++) {
        const a = startAng + (i / S) * Math.PI * 2 + (Math.random() - 0.5) * 0.28;
        const r = radii[j] + (j < 3 ? (Math.random() - 0.5) * 14 : 0);
        ring.push([shape.cx + Math.cos(a) * r, shape.cy + Math.sin(a) * r]);
      }
      P.push(ring);
    }
    const center = [shape.cx, shape.cy];

    const cells = [];
    for (let i = 0; i < S; i++) {
      const i2 = (i + 1) % S;
      cells.push({ pts: [center, P[1][i], P[1][i2]], ring: 0 });
      cells.push({ pts: [P[1][i], P[1][i2], P[2][i2], P[2][i]], ring: 1 });
      cells.push({ pts: [P[2][i], P[2][i2], P[3][i2], P[3][i]], ring: 2 });
    }

    let clipDefs = '', shardsHtml = '';
    cells.forEach((c, n) => {
      const points = c.pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
      clipDefs += `<clipPath id="${uid}-s${n}"><polygon points="${points}"/></clipPath>`;
      shardsHtml += `<g class="shard" clip-path="url(#${uid}-s${n})">
        <g clip-path="url(#${uid}-clip)"><use href="#${uid}-inner"/></g></g>`;
    });
    defs.insertAdjacentHTML('beforeend', clipDefs);
    const group = document.createElementNS(NS, 'g');
    group.innerHTML = shardsHtml;
    svgEl.appendChild(group);

    // 조각마다 바깥으로 튀며 회전하고 떨어지는 애니메이션
    group.querySelectorAll('.shard').forEach((el, n) => {
      const c = cells[n];
      const mx = c.pts.reduce((s, p) => s + p[0], 0) / c.pts.length;
      const my = c.pts.reduce((s, p) => s + p[1], 0) / c.pts.length;
      let dx = mx - shape.cx, dy = my - shape.cy;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;

      // 조각이 튀는 거리 (숫자를 줄이면 얌전하게, 늘리면 격렬하게)
      const power = rand(24, 58) * (c.ring === 0 ? 1.15 : 1);
      const tx = dx * power, ty = dy * power - rand(4, 12);
      const rot = rand(-120, 120);
      const fall = rand(50, 100);
      el.style.transformBox = 'view-box';
      el.style.transformOrigin = mx.toFixed(1) + 'px ' + my.toFixed(1) + 'px';
      el.animate([
        { transform: 'translate(0px,0px) rotate(0deg)', opacity: 1, easing: 'cubic-bezier(.15,.7,.3,1)' },
        { transform: `translate(${tx}px,${ty}px) rotate(${rot * 0.6}deg)`, opacity: 1, offset: 0.45, easing: 'ease-in' },
        { transform: `translate(${tx * 1.2}px,${ty + fall}px) rotate(${rot}deg)`, opacity: 0 },
      ], { duration: rand(650, 900), fill: 'forwards' });
    });
  }

  /* ==========================================================================
     5. 작은 이펙트들
     ========================================================================== */
  function toStage(clientX, clientY) {
    const r = stage.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }
  function ballCenter() {
    const r = wrap.getBoundingClientRect();
    return toStage(r.left + r.width / 2, r.top + r.height / 2);
  }

  /* 튀는 왁스 조각 */
  function spawnChips(x, y, count, power, data) {
    const colors = [].concat(data.design.chip);
    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      el.className = 'chip';
      const size = rand(3, 6.5) * (power > 1 ? 1.4 : 1);
      el.style.width = el.style.height = size + 'px';
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.background = pick(colors);
      const ang = Math.random() * Math.PI * 2;
      const dist = (16 + Math.random() * 30) * power;
      const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
      const rot = rand(-200, 200);
      el.animate([
        { transform: 'translate(-50%,-50%) translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) rotate(${rot * 0.6}deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(-50%,-50%) translate(${dx * 1.1}px,${dy + 34}px) rotate(${rot}deg)`, opacity: 0 },
      ], { duration: rand(450, 750), easing: 'ease-out' }).onfinish = () => el.remove();
      effects.appendChild(el);
    }
  }

  /* +골드 글자가 떠오르며 사라짐 */
  function floatText(text, x, y) {
    const el = document.createElement('div');
    el.className = 'float-text';
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    effects.appendChild(el);
    el.animate([
      { transform: 'translate(-50%,0) scale(0.8)', opacity: 0 },
      { transform: 'translate(-50%,-24px) scale(1.1)', opacity: 1, offset: 0.25 },
      { transform: 'translate(-50%,-78px) scale(1)', opacity: 0 },
    ], { duration: 1100, easing: 'ease-out' }).onfinish = () => el.remove();
  }

  /* 파괴 순간 짧은 섬광 */
  function flash(data) {
    const c = ballCenter();
    flashEl.style.left = c.x + 'px';
    flashEl.style.top = c.y + 'px';
    // Android에서 전체 화면에 가까운 흰 flash를 합성하면 깨져 보일 수 있어 볼 중심 빛만 사용합니다.
    const opacity = data.id === 'blackhole' ? 0.14 : (data.id === 'sun' ? 0.52 : 0.28);
    flashEl.animate([
      { opacity: 0, transform: 'translate(-50%,-50%) scale(0.5)' },
      { opacity, transform: 'translate(-50%,-50%) scale(1)', offset: 0.25 },
      { opacity: 0, transform: 'translate(-50%,-50%) scale(1.35)' },
    ], { duration: data.id === 'sun' ? 360 : 260, easing: 'ease-out' });
  }

  /* ==========================================================================
     6. 골드 · 해금 · 선택
     ========================================================================== */
  function nextLockedIndex() {
    return state.unlocked.indexOf(false);   // 없으면 -1
  }

  function selectBall(index) {
    if (!state.unlocked[index]) return;      // 해금 안 된 볼은 사용할 수 없어요
    state.selected = index;
    wrap.classList.remove('broken');
    svgEl.classList.remove('instant');
    spawnBall(true);                         // 진행 중이던 볼은 버리고 새로 시작
    updateAll();
  }

  function unlockBall(index) {
    if (index !== nextLockedIndex()) return; // 순서대로만 해금 가능
    const b = WAKPPU_BALLS[index];
    if (state.gold < b.price) return;
    state.gold -= b.price;
    state.unlocked[index] = true;
    selectBall(index);                       // 해금하면 바로 그 볼로 바꿔줘요
  }

  function nextRebirthCost() { return REBIRTH_COSTS[state.rebirths] ?? null; }

  function openRebirth() {
    const cost = nextRebirthCost();
    rebirthText.textContent = cost === null
      ? '최대 환생 달성! 25회 이후 환생은 아직 지원하지 않습니다.'
      : `${fmt(cost)}G를 모으면 환생할 수 있습니다. 환생하면 Gold와 해금한 왁뿌볼이 초기화되고, 보상 배율은 ×${fmt(rebirthMultiplier(state.rebirths + 1))}이 됩니다.`;
    rebirthConfirm.hidden = cost === null;
    rebirthConfirm.disabled = cost === null || state.gold < cost;
    rebirthModal.hidden = false;
  }
  function doRebirth() {
    const cost = nextRebirthCost();
    if (cost === null || state.gold < cost) return;
    state.gold = 0;
    state.rebirths += 1;
    state.unlocked = WAKPPU_BALLS.map((_, i) => i === 0);
    state.selected = 0;
    wrap.classList.remove('broken');
    spawnBall(true);
    rebirthModal.hidden = true;
    updateAll();
  }

  async function openRanking() {
    rankingModal.hidden = false;
    rankingList.innerHTML = '';
    rankingStatus.textContent = '온라인 랭킹을 불러오는 중…';
    try {
      const response = await fetch('/api/rankings', { credentials: 'include' });
      if (!response.ok) throw new Error('ranking unavailable');
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('invalid ranking');
      rankingStatus.hidden = true;
      rankingList.innerHTML = rows.map((row, i) => `<li><b>${i + 1}</b><span>${escapeHtml(row.nickname)}</span><em>${fmt(row.rebirths)}회</em><strong>${fmt(row.gold)}G</strong></li>`).join('');
    } catch (_) {
      rankingStatus.hidden = false;
      rankingStatus.textContent = '온라인 서버에 연결하면 모든 플레이어의 공용 랭킹이 표시됩니다.';
    }
  }
  function escapeHtml(value) { const div = document.createElement('div'); div.textContent = String(value || 'Player'); return div.innerHTML; }

  /* ==========================================================================
     7. 화면 갱신
     ========================================================================== */
  function updateAll() {
    const data = WAKPPU_BALLS[state.selected];

    goldEl.textContent = fmt(state.gold);
    goldEl.classList.remove('bump');
    void goldEl.offsetWidth;                 // 애니메이션 다시 시작용
    goldEl.classList.add('bump');

    nameEl.textContent = data.name;
    gradeEl.textContent = data.grade;
    gradeEl.style.setProperty('--grade', data.gradeColor);

    const cost = nextRebirthCost();
    rebirthBtn.textContent = `환생 ${state.rebirths}회 · ×${fmt(rebirthMultiplier(state.rebirths))}`;
    rebirthBtn.disabled = cost === null || state.gold < cost;

    const ni = nextLockedIndex();
    if (ni === -1) {
      unlockBtn.hidden = true;
    } else {
      const nb = WAKPPU_BALLS[ni];
      unlockBtn.hidden = false;
      unlockBtn.textContent = nb.name + ' 해금 · ' + fmt(nb.price) + 'G';
      unlockBtn.disabled = state.gold < nb.price;
    }

    if (!state.hammerOwned) {
      hammerUseBtn.hidden = true;
      hammerBtn.textContent = '🪵 나무 망치 구매 · 100G';
      hammerBtn.disabled = state.gold < HAMMERS[0].cost;
    } else {
      const hammer = HAMMERS[state.hammerLevel - 1];
      hammerUseBtn.hidden = false;
      hammerUseBtn.textContent = `🪵 Lv.${state.hammerLevel} 사용 · 균열 +${hammer.cracks}`;
      hammerUseBtn.disabled = state.busy;
      const next = HAMMERS[state.hammerLevel];
      hammerBtn.textContent = next
        ? `🪵 Lv.${state.hammerLevel + 1} 업그레이드 · ${fmt(next.cost)}G`
        : `🪵 Lv.10 · 최대 레벨 · 균열 +${hammer.cracks}`;
      hammerBtn.disabled = !next || state.gold < next.cost;
    }

    if (!modal.hidden) renderCollection();
    saveProgress();
  }

  /* ---------- 도감 ---------- */
  function renderCollection() {
    const ni = nextLockedIndex();
    grid.innerHTML = WAKPPU_BALLS.map((b, i) => {
      const open = state.unlocked[i];
      let action;
      if (open) {
        action = state.selected === i
          ? '<button class="btn small" disabled>사용 중</button>'
          : `<button class="btn small primary" data-action="select" data-index="${i}">선택</button>`;
      } else if (i === ni) {
        const can = state.gold >= b.price;
        action = `<button class="btn small primary" data-action="unlock" data-index="${i}" ${can ? '' : 'disabled'}>해금 · ${fmt(b.price)}G</button>`;
      } else {
        action = '<button class="btn small" disabled>잠김</button>';
      }
      return `<article class="card ${open ? '' : 'locked'} ${state.selected === i ? 'current' : ''}">
        <div class="thumb">${buildBallThumb(b)}</div>
        <div class="card-body">
          <span class="grade" style="--grade:${b.gradeColor}">${b.grade}</span>
          <h3>${b.name}</h3>
          <p class="meta">파괴 보상 +${fmt(b.reward)}G</p>
          ${action}
        </div>
      </article>`;
    }).join('');
  }

  function openCollection() {
    renderCollection();
    modal.hidden = false;
    closeBtn.focus();
  }
  function closeCollection() {
    modal.hidden = true;
    collectionBtn.focus();
  }

  /* ==========================================================================
     8. 이벤트 연결
     ========================================================================== */
  // Safari의 두 손가락 확대 제스처도 차단합니다.
  const preventZoom = (event) => event.preventDefault();
  document.addEventListener('gesturestart', preventZoom, { passive: false });
  document.addEventListener('gesturechange', preventZoom, { passive: false });
  document.addEventListener('touchstart', (event) => {
    if (event.touches.length > 1) event.preventDefault();
  }, { passive: false });

  // 첫 터치 때 오디오 깨우기 (브라우저 정책)
  document.addEventListener('pointerdown', () => SoundManager.unlock(), true);

  // 왁뿌볼 클릭 (볼 윤곽 안쪽만 반응)
  svgEl.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    onHit(e.clientX, e.clientY);
  });
  stage.addEventListener('contextmenu', (e) => e.preventDefault());

  unlockBtn.addEventListener('click', () => unlockBall(nextLockedIndex()));
  hammerUseBtn.addEventListener('click', useHammer);
  hammerBtn.addEventListener('click', buyOrUpgradeHammer);
  collectionBtn.addEventListener('click', openCollection);
  rebirthBtn.addEventListener('click', openRebirth);
  rebirthConfirm.addEventListener('click', doRebirth);
  rankingBtn.addEventListener('click', openRanking);
  closeBtn.addEventListener('click', closeCollection);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeCollection(); });
  [rebirthModal, rankingModal].forEach((dialog) => dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.hidden = true; }));
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => { $(button.dataset.close).hidden = true; }));
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!modal.hidden) closeCollection();
    rebirthModal.hidden = true;
    rankingModal.hidden = true;
  });

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const index = Number(btn.dataset.index);
    if (btn.dataset.action === 'select') selectBall(index);
    if (btn.dataset.action === 'unlock') unlockBall(index);
    closeCollection();
  });

  /* ==========================================================================
     9. 시작!
     ========================================================================== */
  // 사용할 소리 이름을 모두 모아서 미리 불러오기
  const soundNames = new Set();
  WAKPPU_BALLS.forEach((b) => {
    const cfg = getSoundConfig(b);
    ['early', 'mid', 'late', 'final'].forEach((k) => cfg[k].forEach((n) => soundNames.add(n)));
  });
  SoundManager.init(Array.from(soundNames));

  loadProgress();
  spawnBall(false);
  updateAll();
})();
