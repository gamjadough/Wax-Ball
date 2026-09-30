/* ==========================================================================
   ball-art.js  —  왁뿌볼 그림 만들기 (SVG)
   --------------------------------------------------------------------------
   - 이미지 파일 없이 코드로 왁뿌볼을 그려요. (가볍고 확대해도 깨끗해요)
   - 나중에 직접 그린 이미지로 바꾸고 싶다면:
       balls-data.js 에서 해당 볼에  image: 'images/파일이름.png'  를 지정하세요.
   - 새 디자인을 만들고 싶다면 아래 ART 객체에 함수를 하나 추가하면 돼요.
       (uid, ball) => ({ defs: '그라디언트 등', art: '그림 본체' })
   - 좌표는 모두 200 x 200 크기의 도화지(viewBox) 기준이에요.
   ========================================================================== */

let _uidSeq = 0;
/* SVG 안에서 쓰는 id 가 겹치지 않도록 매번 새 번호를 만들어요 */
function makeUid() {
  _uidSeq += 1;
  return 'w' + _uidSeq;
}

/* ---------- 왁뿌볼 모양 ----------
   path : 볼의 윤곽선 / cx, cy : 볼의 중심 / gloss : 반짝이는 하이라이트 위치 */
const SHAPES = {
  circle: {
    path: 'M18 100 a82 82 0 1 0 164 0 a82 82 0 1 0 -164 0 Z',
    cx: 100, cy: 100, gloss: [68, 58],
  },
  strawberry: {
    path: 'M100 178 C 62 162, 20 124, 20 84 C 20 46, 54 24, 100 34 C 146 24, 180 46, 180 84 C 180 124, 138 162, 100 178 Z',
    cx: 100, cy: 98, gloss: [60, 66],
  },
  chocolate: {
    path: 'M54 24 H146 A30 30 0 0 1 176 54 V146 A30 30 0 0 1 146 176 H54 A30 30 0 0 1 24 146 V54 A30 30 0 0 1 54 24 Z',
    cx: 100, cy: 100, gloss: [58, 56],
  },
  diamond: {
    path: 'M58 30 L142 30 L186 68 L100 172 L14 68 Z',
    cx: 100, cy: 96, gloss: null,
  },
};

/* ==========================================================================
   공통 부품
   ========================================================================== */

/* 볼 윤곽 자르기(clip) + 블러 + 입체감용 그림자 그라디언트 */
function commonDefs(uid, shape, shadeStrength) {
  const s = shadeStrength;
  return `
    <clipPath id="${uid}-clip"><path d="${shape.path}"/></clipPath>
    <filter id="${uid}-b2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2"/></filter>
    <filter id="${uid}-b4" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
    <filter id="${uid}-b10" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10"/></filter>
    <radialGradient id="${uid}-shade" cx="36%" cy="30%" r="80%">
      <stop offset="0%"   stop-color="#fff" stop-opacity="0.30"/>
      <stop offset="32%"  stop-color="#fff" stop-opacity="0"/>
      <stop offset="70%"  stop-color="#000" stop-opacity="${(s * 0.25).toFixed(3)}"/>
      <stop offset="100%" stop-color="#000" stop-opacity="${s}"/>
    </radialGradient>`;
}

/* 왁스 느낌의 입체 그림자 + 반짝이는 하이라이트 (그림 맨 위에 덮어요) */
function overlayMarkup(uid, shape, design) {
  let gloss = '';
  if (design.gloss !== false && shape.gloss) {
    const [gx, gy] = shape.gloss;
    gloss = `
      <ellipse cx="${gx}" cy="${gy}" rx="28" ry="14" transform="rotate(-32 ${gx} ${gy})"
               fill="#fff" opacity="0.55" filter="url(#${uid}-b4)"/>
      <ellipse cx="${gx - 6}" cy="${gy - 4}" rx="10" ry="4.5" transform="rotate(-32 ${gx - 6} ${gy - 4})"
               fill="#fff" opacity="0.7" filter="url(#${uid}-b2)"/>
      <ellipse cx="140" cy="150" rx="22" ry="7" transform="rotate(-38 140 150)"
               fill="#fff" opacity="0.16" filter="url(#${uid}-b4)"/>`;
  }
  return `<rect width="200" height="200" fill="url(#${uid}-shade)"/>${gloss}`;
}

function radialGrad(id, c) {
  return `<radialGradient id="${id}" cx="38%" cy="32%" r="75%">
    <stop offset="0%"  stop-color="${c.light}"/>
    <stop offset="55%" stop-color="${c.mid}"/>
    <stop offset="100%" stop-color="${c.dark}"/>
  </radialGradient>`;
}

/* ==========================================================================
   디자인별 그림 (ART)
   ========================================================================== */
const ART = {
  /* ----- 일반: 초록 기본 왁뿌볼 (무늬 없음) ----- */
  plain(uid, ball) {
    return {
      defs: radialGrad(`${uid}-base`, ball.design.colors),
      art: `<rect width="200" height="200" fill="url(#${uid}-base)"/>`,
    };
  },

  /* ----- 희귀: 딸기 (씨앗 + 표면의 오목한 질감 + 꼭지 잎) ----- */
  strawberry(uid, ball) {
    const d = ball.design;
    // y 높이에 따른 딸기의 절반 너비 (씨앗이 윤곽 밖으로 나가지 않게 계산)
    const halfWidth = (y) => y < 84
      ? 80 * Math.sqrt(Math.max(0, 1 - Math.pow((84 - y) / 54, 2)))
      : 80 * Math.pow(Math.max(0, 1 - (y - 84) / 94), 0.7);

    let seeds = '';
    for (let y = 56, row = 0; y <= 158; y += 16, row++) {
      for (let x = (row % 2 ? 34 : 44); x <= 170; x += 20) {
        if (Math.abs(x - 100) > halfWidth(y) - 10) continue;
        const tilt = ((x - 100) * 0.45).toFixed(1);
        seeds += `<g transform="translate(${x} ${y}) rotate(${tilt})">
          <ellipse cx="0.6" cy="1.4" rx="4.4" ry="6" fill="#6a0c1e" opacity="0.32"/>
          <ellipse rx="2.5" ry="3.9" fill="${d.seed}"/>
          <ellipse cx="-0.8" cy="-1.3" rx="0.9" ry="1.5" fill="#fff" opacity="0.75"/>
        </g>`;
      }
    }

    // 꼭지 잎: 줄기(100,44)에서 아래쪽으로 퍼지는 6장
    const leafAngles = [[0, 40], [36, 34], [72, 27], [108, 27], [144, 34], [180, 40]];
    let leaves = '';
    leafAngles.forEach(([a, len]) => {
      leaves += `<path transform="translate(100 44) rotate(${a}) scale(${len / 34})"
        d="M0 0 C 6 -10 20 -11 34 0 C 20 9 6 8 0 0 Z" fill="url(#${uid}-leaf)"
        stroke="${d.leaf[1]}" stroke-width="0.8" stroke-opacity="0.6"/>`;
    });

    return {
      defs: radialGrad(`${uid}-base`, d.colors) + `
        <linearGradient id="${uid}-leaf" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="${d.leaf[1]}"/><stop offset="100%" stop-color="${d.leaf[0]}"/>
        </linearGradient>`,
      art: `<rect width="200" height="200" fill="url(#${uid}-base)"/>
        ${seeds}
        ${leaves}
        <rect x="95" y="24" width="10" height="24" rx="5" fill="${d.leaf[1]}"/>
        <circle cx="100" cy="46" r="5" fill="${d.leaf[0]}"/>`,
    };
  },

  /* ----- 초희귀: 초콜릿 (네모 조각 무늬 + 위쪽이 녹아 흘러내리는 모습) ----- */
  chocolate(uid, ball) {
    const d = ball.design;
    // 3 x 3 초콜릿 조각
    let tiles = '';
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const x = 32 + c * 48, y = 32 + r * 48;
        tiles += `<rect x="${x}" y="${y}" width="40" height="40" rx="9" fill="url(#${uid}-tile)"/>
          <rect x="${x + 2}" y="${y + 2}" width="36" height="36" rx="7" fill="none"
                stroke="#e0a878" stroke-opacity="0.35" stroke-width="1.4"/>
          <rect x="${x + 6}" y="${y + 5}" width="15" height="4" rx="2" fill="#fff" opacity="0.2"/>`;
      }
    }
    // 녹아서 흘러내리는 초콜릿 (위쪽 띠 + 방울 3개)
    const melt = (fill, dx, dy, extra) => `<g transform="translate(${dx} ${dy})" ${extra || ''}>
      <rect x="18" y="14" width="164" height="30" fill="${fill}"/>
      <rect x="38" y="14" width="17" height="54" rx="8.5" fill="${fill}"/>
      <rect x="92" y="14" width="19" height="42" rx="9.5" fill="${fill}"/>
      <rect x="138" y="14" width="15" height="68" rx="7.5" fill="${fill}"/>
    </g>`;

    return {
      defs: `
        <linearGradient id="${uid}-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${d.colors.light}"/>
          <stop offset="55%" stop-color="${d.colors.mid}"/>
          <stop offset="100%" stop-color="#4a2410"/>
        </linearGradient>
        <linearGradient id="${uid}-melt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#7a4424"/><stop offset="100%" stop-color="#57301a"/>
        </linearGradient>`,
      art: `<rect width="200" height="200" fill="${d.colors.dark}"/>
        ${tiles}
        ${melt('#1e0d05', 1.5, 3.5, 'opacity="0.45"')}
        ${melt(`url(#${uid}-melt)`, 0, 0)}
        <rect x="28" y="20" width="144" height="4" rx="2" fill="#fff" opacity="0.22"/>
        <rect x="43" y="34" width="3.5" height="28" rx="1.7" fill="#fff" opacity="0.3"/>
        <rect x="98" y="30" width="3.5" height="18" rx="1.7" fill="#fff" opacity="0.3"/>
        <rect x="143" y="34" width="3.5" height="34" rx="1.7" fill="#fff" opacity="0.3"/>`,
    };
  },

  /* ----- 영웅: 무지개 (색이 자연스럽게 섞인 왁스 장난감 질감) ----- */
  rainbow(uid, ball) {
    const cols = ball.design.colors;
    const stops = cols.map((c, i) =>
      `<stop offset="${Math.round(i / (cols.length - 1) * 100)}%" stop-color="${c}"/>`).join('');
    return {
      // 볼 안쪽 범위(34~166)에 무지개 전체 색이 들어오도록 좌표를 고정해요
      defs: `<linearGradient id="${uid}-rb" gradientUnits="userSpaceOnUse" x1="34" y1="40" x2="166" y2="160">${stops}</linearGradient>`,
      art: `<rect width="200" height="200" fill="url(#${uid}-rb)"/>
        <circle cx="150" cy="56" r="26" fill="#7fe8ff" opacity="0.3" filter="url(#${uid}-b10)"/>
        <circle cx="60" cy="146" r="24" fill="#ff5fb0" opacity="0.3" filter="url(#${uid}-b10)"/>
        <path d="M-10 62 C 40 22, 90 112, 140 72 S 200 52, 220 82" stroke="#fff" stroke-opacity="0.16"
              stroke-width="14" fill="none" filter="url(#${uid}-b4)"/>
        <path d="M-10 134 C 50 94, 100 174, 150 128 S 200 124, 220 144" stroke="#fff" stroke-opacity="0.13"
              stroke-width="12" fill="none" filter="url(#${uid}-b4)"/>
        <path d="M-10 100 C 40 142, 100 60, 160 112 S 200 100, 220 96" stroke="#3a2a66" stroke-opacity="0.12"
              stroke-width="12" fill="none" filter="url(#${uid}-b4)"/>`,
    };
  },

  /* ----- 신화: 다이아몬드 (반투명 면 + 반사광 + 반짝임) ----- */
  diamond(uid, ball) {
    const P = { A: [58, 30], B: [142, 30], C: [186, 68], D: [14, 68], E: [100, 172],
                F: [54, 68], G: [100, 68], H: [146, 68], T: [100, 30] };
    // 각 면: [꼭짓점들, 색, 투명도]
    const facets = [
      ['DAF',  '#8fe3ff', 0.90], ['ATGF', '#e6faff', 0.82], ['TBHG', '#b4dcff', 0.86], ['BCH', '#7fcaff', 0.90],
      ['DFE',  '#52b6f2', 0.90], ['FGE',  '#93d6ff', 0.84], ['GHE',  '#62bdf0', 0.90], ['HCE', '#3f9ee3', 0.94],
    ];
    const pts = (keys) => keys.split('').map((k) => P[k].join(',')).join(' ');
    let facetSvg = '';
    facets.forEach(([keys, fill, op]) => {
      facetSvg += `<polygon points="${pts(keys)}" fill="${fill}" fill-opacity="${op}"
                    stroke="#fff" stroke-opacity="0.85" stroke-width="1.3" stroke-linejoin="round"/>`;
    });
    const sparkle = (x, y, s, delay) => `<g transform="translate(${x} ${y}) scale(${s})">
      <path class="gem-sparkle" style="animation-delay:${delay}s" fill="#fff"
            d="M0 -10 L2.2 -2.2 L10 0 L2.2 2.2 L0 10 L-2.2 2.2 L-10 0 L-2.2 -2.2 Z"/></g>`;

    return {
      defs: `<linearGradient id="${uid}-gbase" x1="0" y1="0" x2="1" y2="1">
               <stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#a9dcff"/>
             </linearGradient>`,
      art: `<rect width="200" height="200" fill="url(#${uid}-gbase)"/>
        ${facetSvg}
        <polygon points="62,34 94,34 64,62" fill="#fff" opacity="0.55"/>
        <polygon points="60,74 96,74 98,132" fill="#fff" opacity="0.24"/>
        <polygon points="112,36 138,36 140,60 112,60" fill="#fff" opacity="0.2"/>
        <g transform="skewX(-22)"><rect class="gem-shine" x="-60" y="-10" width="26" height="220" fill="#fff" opacity="0"/></g>
        <path d="${SHAPES.diamond.path}" fill="none" stroke="#4f9fd6" stroke-width="4" stroke-linejoin="round"/>
        ${sparkle(74, 48, 1.1, 0)}${sparkle(152, 56, 0.75, 0.9)}${sparkle(118, 116, 0.85, 1.7)}`,
    };
  },

  /* ----- 전설: 행성 (줄무늬 대기 + 폭풍 + 크레이터 + 대기 빛) ----- */
  planet(uid, ball) {
    const d = ball.design;
    // 물결 모양의 줄무늬 한 개
    const band = (y, h, amp) =>
      `M-10 ${y} C 30 ${y - amp}, 70 ${y + amp}, 110 ${y} S 190 ${y - amp}, 230 ${y + amp * 0.5} ` +
      `L 230 ${y + h} C 190 ${y + h + amp}, 150 ${y + h - amp}, 110 ${y + h} S 30 ${y + h + amp}, -10 ${y + h} Z`;
    const ys = [34, 62, 92, 122, 150];
    const hs = [24, 26, 24, 22, 22];
    let bands = '';
    (d.bands || []).forEach(([color, op], i) => {
      bands += `<path d="${band(ys[i], hs[i], 6 + (i % 2) * 3)}" fill="${color}" opacity="${op}" filter="url(#${uid}-b2)"/>`;
    });
    const crater = (x, y, r) => `<g>
      <circle cx="${x}" cy="${y}" r="${r}" fill="#000" opacity="0.22"/>
      <circle cx="${x + 1}" cy="${y + 1}" r="${r}" fill="none" stroke="#fff" stroke-opacity="0.26" stroke-width="1.4"/>
    </g>`;

    return {
      defs: radialGrad(`${uid}-base`, d.colors),
      art: `<rect width="200" height="200" fill="url(#${uid}-base)"/>
        <g transform="rotate(-14 100 100)">${bands}
          <ellipse cx="128" cy="108" rx="21" ry="11" fill="#ffd6f0" opacity="0.32" filter="url(#${uid}-b2)"/>
          <ellipse cx="128" cy="108" rx="14" ry="6.5" fill="none" stroke="#fff" stroke-opacity="0.4" stroke-width="1.6"/>
        </g>
        ${crater(68, 124, 10)}${crater(92, 152, 6)}${crater(142, 66, 7)}${crater(52, 78, 5)}
        <circle cx="100" cy="100" r="80" fill="none" stroke="#9fd8ff" stroke-opacity="0.55"
                stroke-width="4" filter="url(#${uid}-b2)"/>`,
    };
  },
};

/* ==========================================================================
   왁뿌볼 SVG 내용물 만들기
   --------------------------------------------------------------------------
   구조:
     <defs>       그라디언트/클립 등 부품
     <g.hit>      클릭을 받는 영역 (볼 윤곽 안쪽만)
       └ clip → #uid-inner : 그림 + 금(cracks) 층 + 하이라이트
   ========================================================================== */
function buildBallSvgInner(ball, uid) {
  const d = ball.design;
  const shape = SHAPES[d.shape] || SHAPES.circle;

  let part;
  if (ball.image) {
    // 직접 만든 이미지를 쓰는 경우
    part = { defs: '', art: `<image href="${ball.image}" x="0" y="0" width="200" height="200" preserveAspectRatio="xMidYMid meet"/>` };
  } else {
    part = (ART[d.art] || ART.plain)(uid, ball);
  }

  const shade = d.art === 'planet' ? 0.5 : (d.art === 'diamond' ? 0.18 : 0.32);
  const defs = commonDefs(uid, shape, shade) + part.defs;

  return `<defs id="${uid}-defs">${defs}</defs>
    <g class="hit"><g clip-path="url(#${uid}-clip)">
      <g id="${uid}-inner">
        ${part.art}
        <g id="${uid}-cracks"></g>
        ${overlayMarkup(uid, shape, d)}
      </g>
    </g></g>`;
}

/* 도감(작은 미리보기)용 SVG 문자열 */
function buildBallThumb(ball) {
  const uid = makeUid();
  return `<svg viewBox="0 0 200 200" aria-hidden="true">${buildBallSvgInner(ball, uid)}</svg>`;
}
