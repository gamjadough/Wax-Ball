/* ==========================================================================
   sound.js  —  효과음 재생
   --------------------------------------------------------------------------
   - sounds/ 폴더의 mp3 파일을 불러와서 재생해요. (예: sounds/tap1.mp3)
   - 같은 소리도 재생할 때마다 피치와 볼륨을 아주 조금씩 랜덤으로 바꿔요.
   - 음원 파일이 없어도 오류 없이 실행돼요.
       · SOUND_SETTINGS.usePlaceholderSound = true  → 임시 합성음이 대신 나요
       · false                                       → 그냥 조용해요
   ========================================================================== */

/* 왁뿌볼 하나의 최종 사운드 설정 (기본값 + 그 볼의 개별 설정) */
function getSoundConfig(ball) {
  return Object.assign({}, DEFAULT_SOUNDS, ball.sound || {});
}

const SoundManager = (() => {
  const pools = {};      // 소리 이름 → { items: [Audio...], next: 0, ok: false }
  let ctx = null;        // 임시 합성음용 AudioContext
  let noiseBuffer = null;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ---------- 음원 파일 불러오기 ---------- */
  // names: 사용할 소리 이름 목록 (예: ['tap1', 'tap2', ...])
  function init(names) {
    names.forEach((name) => {
      const src = SOUND_SETTINGS.folder + name + SOUND_SETTINGS.extension;
      const pool = { items: [], next: 0, ok: false };
      pools[name] = pool;

      // 먼저 1개만 불러서 파일이 있는지 확인해요. (없으면 조용히 포기)
      const probe = new Audio();
      probe.preload = 'auto';
      probe.addEventListener('canplay', () => {
        if (pool.ok) return;
        pool.ok = true;
        pool.items.push(probe);
        // 파일이 확인되면 겹쳐 재생용으로 나머지를 추가
        for (let i = 1; i < SOUND_SETTINGS.poolSize; i++) {
          const a = new Audio(src);
          a.preload = 'auto';
          pool.items.push(a);
        }
      });
      probe.addEventListener('error', () => { pool.ok = false; });
      probe.src = src;
    });
  }

  /* ---------- 브라우저 정책상 첫 터치 때 오디오를 깨워야 해요 ---------- */
  function unlock() {
    if (!SOUND_SETTINGS.usePlaceholderSound) return;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  /* ---------- 재생 ---------- */
  // opts: { pitch, pitchRandom, volume, volumeRandom }
  function play(name, opts) {
    const rate = clamp(opts.pitch * (1 + rand(-opts.pitchRandom, opts.pitchRandom)), 0.5, 2);
    const vol = clamp(opts.volume * (1 + rand(-opts.volumeRandom, opts.volumeRandom)), 0, 1);

    const pool = pools[name];
    if (pool && pool.ok && pool.items.length) {
      const a = pool.items[pool.next];
      pool.next = (pool.next + 1) % pool.items.length;
      try {
        a.pause();
        a.currentTime = 0;
        a.volume = vol;
        // 재생 속도를 바꿀 때 피치도 같이 변하게 (자연스러운 변화용)
        a.preservesPitch = false;
        a.mozPreservesPitch = false;
        a.webkitPreservesPitch = false;
        a.playbackRate = rate;
        const p = a.play();
        if (p && p.catch) p.catch(() => {});
      } catch (e) { /* 재생 실패해도 게임은 계속 */ }
      return;
    }

    // 음원 파일이 없을 때
    if (SOUND_SETTINGS.usePlaceholderSound) synth(name, rate, vol);
  }

  /* ======================================================================
     임시 합성음 (음원 파일이 없을 때만 사용)
     ====================================================================== */
  function getNoise() {
    if (noiseBuffer) return noiseBuffer;
    const len = ctx.sampleRate;
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuffer;
  }

  // 짧은 잡음 덩어리 (딱, 쩍 같은 질감)
  function noise(dest, t, dur, o) {
    const src = ctx.createBufferSource();
    src.buffer = getNoise();
    const f = ctx.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.value = o.freq || 1500;
    f.Q.value = o.q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain || 0.8, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, Math.random() * 0.5, dur + 0.05);
  }

  // 짧은 톤 (톡 하는 몸통 소리)
  function tone(dest, t, dur, f0, f1, gain) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function synth(name, rate, vol) {
    if (!ctx) return;
    const t = ctx.currentTime + 0.005;
    const out = ctx.createGain();
    out.gain.value = vol;
    out.connect(ctx.destination);
    const variant = parseInt((name.match(/\d+$/) || ['1'])[0], 10) || 1;

    if (name.indexOf('break') === 0) {
      // 와작! 낮은 울림 + 긴 잡음 + 잔파편 소리
      tone(out, t, 0.28, 170 * rate, 45 * rate, 0.9);
      noise(out, t, 0.42, { type: 'lowpass', freq: 3800 * rate, q: 0.7, gain: 1.0 });
      noise(out, t, 0.16, { type: 'highpass', freq: 2200 * rate, q: 0.7, gain: 0.8 });
      for (let i = 0; i < 7; i++) {
        noise(out, t + 0.03 + Math.random() * 0.28, 0.04 + Math.random() * 0.04,
          { type: 'highpass', freq: (2500 + Math.random() * 2500) * rate, q: 0.8, gain: 0.5 });
      }
    } else if (name.indexOf('crack') === 0) {
      // 쩍 / 와작: 짧은 파열음이 여러 번 연달아
      noise(out, t, 0.13, { type: 'bandpass', freq: (900 + variant * 200) * rate, q: 0.9, gain: 0.7 });
      for (let i = 0; i < 3; i++) {
        noise(out, t + i * (0.025 + Math.random() * 0.02), 0.04 + Math.random() * 0.03,
          { type: 'highpass', freq: 2600 * rate, q: 0.8, gain: 0.85 - i * 0.2 });
      }
      tone(out, t, 0.06, 260 * rate, 140 * rate, 0.35);
    } else {
      // 톡 / 툭 / 딱: 짧고 가벼운 두드림
      const base = [1, 1.0, 0.8, 1.25][variant] || 1;
      noise(out, t, 0.05, { type: 'bandpass', freq: 1800 * rate * base, q: 1.2, gain: 0.85 });
      tone(out, t, 0.07, 430 * rate * base, 150 * rate, 0.6);
    }
  }

  return { init, unlock, play };
})();
