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
  adminEvent(uid) {
    return {defs:`<radialGradient id="${uid}-void"><stop stop-color="#160e18"/><stop offset=".8" stop-color="#08060c"/><stop offset="1" stop-color="#250c1c"/></radialGradient>`,art:`<circle cx="100" cy="100" r="82" fill="url(#${uid}-void)"/><g class="admin-ball-rune" fill="none" stroke="#b83350" stroke-width="1.5"><path d="M68 37L91 63 79 91 106 115 92 157M130 44L113 76 137 108 116 146M44 87L70 103 54 127M151 75L129 90"/><path d="M88 87L100 75 112 88 100 101Z"/><circle cx="100" cy="88" r="3" fill="#b83350"/></g>`};
  },
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

  /* ----- 사과 / 도넛 / 물: 코드만으로 그리는 추가 왁스 질감 ----- */
  apple(uid, ball) {
    const d = ball.design;
    return { defs: radialGrad(`${uid}-base`, d.colors), art: `<rect width="200" height="200" fill="url(#${uid}-base)"/>
      <path d="M100 45 C96 29 105 20 120 16" fill="none" stroke="#5a3516" stroke-width="8" stroke-linecap="round"/>
      <path d="M108 34 C132 15 157 29 151 53 C132 56 117 49 108 34Z" fill="#54a847"/>
      <ellipse cx="70" cy="70" rx="18" ry="9" fill="#fff" opacity=".22" filter="url(#${uid}-b4)"/>` };
  },
  donut(uid, ball) {
    const d = ball.design;
    return { defs: radialGrad(`${uid}-base`, d.colors), art: `<rect width="200" height="200" fill="url(#${uid}-base)"/>
      <circle cx="100" cy="100" r="64" fill="#f39aae"/><circle cx="100" cy="100" r="24" fill="#875029"/>
      <circle cx="100" cy="100" r="16" fill="#5b3420"/>
      <g stroke-linecap="round" stroke-width="5"><path d="M54 68l10 6" stroke="#fff0a0"/><path d="M133 58l7 11" stroke="#70dff1"/><path d="M145 126l-11 7" stroke="#fff"/><path d="M66 136l6-11" stroke="#9ee58b"/><path d="M90 53l2 12" stroke="#be75ed"/></g>` };
  },
  water(uid, ball) {
    const d = ball.design;
    return { defs: radialGrad(`${uid}-base`, d.colors), art: `<rect width="200" height="200" fill="url(#${uid}-base)"/>
      <path d="M-10 85 Q25 63 62 85 T135 85 T210 85 V110 Q175 89 135 110 T62 110 T-10 110Z" fill="#e1fcff" opacity=".42"/>
      <path d="M-10 128 Q35 105 77 128 T160 128 T210 128" fill="none" stroke="#e7fdff" stroke-width="8" opacity=".35"/>
      <ellipse cx="68" cy="60" rx="26" ry="11" fill="#fff" opacity=".38" filter="url(#${uid}-b4)"/>` };
  },
  emerald(uid, ball) {
    const P = '58,30 142,30 186,68 100,172 14,68';
    return { defs: '', art: `<polygon points="${P}" fill="#20ad80"/><polygon points="58,30 100,68 14,68" fill="#99ffe0"/><polygon points="142,30 186,68 100,68" fill="#55d8af"/><polygon points="14,68 100,68 100,172" fill="#15916d"/><polygon points="186,68 100,68 100,172" fill="#087356"/><path d="M58 30L142 30L186 68L100 172L14 68Z" fill="none" stroke="#dffff4" stroke-width="3"/>` };
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

  sun(uid) {
    const ray = (a, len) => `<path d="M100 100 L${100 + Math.cos(a) * len} ${100 + Math.sin(a) * len}" stroke="#ffd85e" stroke-width="7" stroke-linecap="round" opacity=".72"/>`;
    let rays = '';
    for (let i = 0; i < 18; i++) rays += ray(i * Math.PI * 2 / 18, i % 2 ? 103 : 116);
    return { defs: `<radialGradient id="${uid}-sun"><stop stop-color="#fffbd0"/><stop offset=".27" stop-color="#ffe45a"/><stop offset=".68" stop-color="#ff9a10"/><stop offset="1" stop-color="#d64505"/></radialGradient>`,
      art: `<g class="sun-rays">${rays}</g><circle cx="100" cy="100" r="83" fill="url(#${uid}-sun)"/><circle cx="76" cy="73" r="25" fill="#fff" opacity=".22" filter="url(#${uid}-b10)"/><path d="M36 114 Q67 91 94 114 T154 114" fill="none" stroke="#fff6a7" stroke-width="7" opacity=".25" filter="url(#${uid}-b4)"/>` };
  },

  blackhole(uid) {
    const ring = (r, color, opacity, rotate) => `<ellipse cx="100" cy="100" rx="${r}" ry="${Math.round(r * .34)}" transform="rotate(${rotate} 100 100)" fill="none" stroke="${color}" stroke-width="${Math.max(2, r / 15)}" opacity="${opacity}"/>`;
    return { defs: `<radialGradient id="${uid}-void"><stop stop-color="#040008" offset="0"/><stop stop-color="#12001f" offset=".48"/><stop stop-color="#5b157f" offset=".78"/><stop stop-color="#d49cff" offset="1"/></radialGradient>`,
      art: `<rect width="200" height="200" fill="#080014"/><circle cx="100" cy="100" r="83" fill="url(#${uid}-void)"/>${ring(85,'#f1c6ff','.58',-22)}${ring(66,'#7e3cc5','.7',34)}${ring(49,'#e7abff','.32',-8)}<circle cx="100" cy="100" r="32" fill="#010003"/><path d="M24 112 C54 50 144 155 178 74" fill="none" stroke="#bd82ff" stroke-width="6" opacity=".5" filter="url(#${uid}-b4)"/>` };
  },
  transcendent(uid,ball) {
    const d=ball.design,m=d.motif;
    const cloud='<g fill="#fff" opacity=".68"><ellipse cx="76" cy="85" rx="38" ry="15"/><ellipse cx="96" cy="74" rx="24" ry="18"/><ellipse cx="122" cy="126" rx="36" ry="13"/></g>';
    const core='<circle cx="100" cy="105" r="34" fill="#b81733" opacity=".7" filter="url(#'+uid+'-b10)"/><circle cx="100" cy="105" r="18" fill="#ff4b40"/><circle cx="94" cy="99" r="7" fill="#ffd998"/>';
    const crystal='<path d="M100 57 L132 90 L114 135 L87 138 L66 94 Z" fill="#e9fbff" opacity=".8" stroke="#fff2b0" stroke-width="2"/><path d="M100 57 L94 98 L132 90 M94 98 L114 135 M94 98 L66 94" fill="none" stroke="#92bdd6" stroke-width="2"/>';
    const particles=Array.from({length:16},(_,i)=>'<circle cx="'+(48+(i*37)%107)+'" cy="'+(48+(i*29)%108)+'" r="'+(1+i%3)+'" fill="#edf4ff" opacity="'+(.25+(i%4)*.15)+'"/>').join('');
    const orbit='<g><path d="M100 30 A70 70 0 0 1 100 170 Q145 110 100 100 Q55 90 100 30" fill="#fff3da" opacity=".75"/><path d="M100 30 A70 70 0 0 0 100 170 Q145 110 100 100 Q55 90 100 30" fill="#1b102c" opacity=".8"/></g>';
    const fire='<g fill="#f54b36" opacity=".72"><path d="M56 148 Q32 115 64 75 Q55 109 80 102 Q97 124 82 153 Z"/><path d="M107 152 Q83 114 120 47 Q104 93 144 88 Q172 115 142 153 Z"/></g>';
    const split='<path d="M100 18 A82 82 0 0 1 100 182 Z" fill="#120f1b" opacity=".9"/><path d="M100 18 V182" stroke="#bda8d7" stroke-width="2"/>';
    const glow='<circle cx="100" cy="100" r="59" fill="#fff" opacity=".16"/><ellipse cx="83" cy="78" rx="33" ry="40" fill="#fff" opacity=".35" filter="url(#'+uid+'-b10)"/>';
    const motifs={glow,fire,cloud,ember:core,gem:crystal,core:core+'<path d="M48 95 L74 107 M128 112 L153 139 M96 142 L85 165" stroke="#e84245" stroke-width="3" opacity=".6"/>',split,orbit,soul:particles,eternity:'<g opacity=".23">'+orbit+cloud+core+crystal+'</g>'+particles};
    return {defs:radialGrad(uid+'-wax',d.colors),art:'<circle cx="100" cy="100" r="82" fill="url(#'+uid+'-wax)" opacity=".84"/>'+'<g class="transcendent-idle '+m+'">'+motifs[m]+'</g><circle cx="100" cy="100" r="79" fill="none" stroke="'+d.colors.light+'" stroke-width="2" opacity=".4"/>'};
  },
  whitehole(uid) {
    return { defs:`<radialGradient id="${uid}-white-core" cx="44%" cy="40%" r="65%"><stop offset="0" stop-color="#fff"/><stop offset=".36" stop-color="#f3fdff"/><stop offset=".68" stop-color="#bfeafa"/><stop offset=".9" stop-color="#729ecb"/><stop offset="1" stop-color="#4d527f"/></radialGradient><radialGradient id="${uid}-white-light"><stop stop-color="#fff"/><stop offset=".5" stop-color="#f4fdff"/><stop offset="1" stop-color="#a8ecff" stop-opacity="0"/></radialGradient>`,
      art:`<rect width="200" height="200" fill="#3e4778"/><circle cx="100" cy="100" r="91" fill="url(#${uid}-white-core)"/><g fill="none" stroke-linecap="round"><ellipse cx="100" cy="100" rx="85" ry="36" stroke="#b5a8f4" stroke-width="5" transform="rotate(-25 100 100)" opacity=".8"/><ellipse cx="100" cy="100" rx="79" ry="29" stroke="#fff" stroke-width="3" transform="rotate(-25 100 100)" opacity=".9"/><ellipse cx="100" cy="100" rx="67" ry="53" stroke="#a7dfff" stroke-width="2" transform="rotate(37 100 100)"/><path d="M100 20 Q124 70 100 100 Q59 107 28 143 M178 59 Q137 83 100 100 Q104 142 139 177" stroke="#f3fdff" stroke-width="5" opacity=".6"/></g><circle cx="100" cy="100" r="49" fill="url(#${uid}-white-light)"/><circle cx="100" cy="100" r="22" fill="#fff"/><g fill="#fff"><circle cx="63" cy="56" r="2"/><circle cx="148" cy="119" r="2.5"/><circle cx="60" cy="147" r="1.5"/></g>` };
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
    part = d.art==='pumpkin'?{defs:`<radialGradient id="${uid}-pumpkin"><stop stop-color="#ffc16c"/><stop offset=".7" stop-color="#f47c18"/><stop offset="1" stop-color="#7e260e"/></radialGradient>`,art:`<rect width="200" height="200" fill="#3a173f"/><ellipse cx="100" cy="106" rx="79" ry="73" fill="url(#${uid}-pumpkin)"/><g fill="none" stroke="#973a10" stroke-width="3" opacity=".6"><ellipse cx="100" cy="106" rx="50" ry="73"/><ellipse cx="100" cy="106" rx="25" ry="73"/></g><path d="M87 40Q88 18 110 13L119 28Q100 24 105 42" fill="#539137"/><g class="pumpkin-flame" fill="#ffeaa1" stroke="#592038" stroke-width="5"><path d="M49 94L78 67L84 101Z M116 101L122 67L151 94Z M57 120L77 127L88 117L101 130L113 118L125 129L146 117Q139 156 103 159Q72 154 57 120Z"/></g><g class="pumpkin-ghost" fill="#ede0ff" opacity=".7"><path d="M28 52Q28 36 39 36Q52 36 52 53L49 62L43 56L36 63L29 59Z"/><circle cx="36" cy="48" r="2" fill="#47215a"/><circle cx="44" cy="48" r="2" fill="#47215a"/></g>`}:(ART[d.art] || ART.plain)(uid, ball);
  }

  const shade = d.art === 'blackhole' ? 0.65 : (d.art === 'planet' ? 0.5 : (d.art === 'diamond' ? 0.18 : 0.32));
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
