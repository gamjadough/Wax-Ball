// Local preview adapter. Algorithms mirror game.js; parity is enforced by preview-cracks.test.mjs.
(() => {
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 const mk=(tag,attrs)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value]of Object.entries(attrs))n.setAttribute(key,value);return n;};
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
    const luminous=design.skin==='transcendent';
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
      if(luminous){
        cr.dark.setAttribute('stroke','#080b21');cr.wide.setAttribute('stroke','#ab74ff');
        cr.light.setAttribute('stroke','#6edfff');cr.light.setAttribute('stroke-opacity','.9');cr.light.removeAttribute('transform');
        cr.core=mk('path',Object.assign({},common,{class:'crack','data-seam-core':'',stroke:'#f0f6ff'}));
        cr.glow=mk('g',{class:'skin-seam-light'});layer.appendChild(cr.dark);
        [cr.wide,cr.light,cr.core].forEach(el=>cr.glow.appendChild(el));layer.appendChild(cr.glow);
      }
      [cr.wide, cr.dark, cr.light,cr.core].filter(Boolean).forEach((el) => {
        el.style.strokeDashoffset = '1';
        el.style.visibility = 'hidden';
        if(!luminous)layer.appendChild(el);
      });
    });
  }

  /* 진행도 v(0~1)에 맞춰 금을 자라게 하기 */
  function updateCracks(cracks, v) {
    cracks.forEach((cr) => {
      // v === 0 (아직 클릭 전)이면 금이 하나도 보이면 안 돼요
      const frac = v <= 0 ? 0 : clamp((v - cr.start) / (cr.end - cr.start), 0, 1);
      cr.frac=frac;
      const vis = frac > 0.001 ? 'visible' : 'hidden';
      const off = String(1 - frac);
      const w = cr.weight * (0.8 + v * 1.9);          // 진행될수록 금이 굵어져요
      cr.wide.style.strokeWidth = (w * 2.6).toFixed(2);
      cr.wide.style.strokeOpacity = (0.08 + 0.22 * v).toFixed(2);
      cr.dark.style.strokeWidth = w.toFixed(2);
      cr.light.style.strokeWidth = (w * 0.45).toFixed(2);
      if(cr.core){cr.wide.style.strokeOpacity='.3';cr.dark.style.strokeWidth=(w*1.6).toFixed(2);cr.light.style.strokeWidth=(w*.7).toFixed(2);cr.core.style.strokeWidth=(w*.23).toFixed(2);}
      [cr.wide, cr.dark, cr.light,cr.core].filter(Boolean).forEach((el) => {
        el.style.strokeDashoffset = off;
        el.style.visibility = vis;
      });
    });
  }
 window.WakppuPreviewCracks={design:designCracks,draw:drawCracks,update:updateCracks};
})();
