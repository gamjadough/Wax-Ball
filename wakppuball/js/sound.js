/* ==========================================================================
   sound.js  —  효과음 재생
   --------------------------------------------------------------------------
   - sounds/ 폴더의 mp3 파일을 불러와서 재생해요. (예: sounds/tap1.mp3)
   - 같은 소리도 재생할 때마다 피치와 볼륨을 아주 조금씩 랜덤으로 바꿔요.
   - 음원 파일이 없어도 오류 없이 실행돼요.
       · SOUND_SETTINGS.usePlaceholderSound = true  → 기본 tap/crack/break만 합성음으로 대체해요
       · 전용 음원은 준비될 때까지 다른 소리로 대체하지 않고, 일시 오류 후 다시 로딩해요
   ========================================================================== */

/* 왁뿌볼 하나의 최종 사운드 설정 (기본값 + 그 볼의 개별 설정) */
function getSoundConfig(ball) {
  const skin=ball.id==='eternity'?window.WakppuSkinSounds?.config(ball.skinId):null;
  return Object.assign({}, DEFAULT_SOUNDS, ball.sound || {}, skin ? {...skin,pitch:1,pitchRandom:.025,volume:.65,volumeRandom:.04} : {});
}

const SoundManager = (() => {
  const pools = {};      // 소리 이름 → { items: [Audio...], next: 0, ok: false }
  let ctx = null;        // 임시 합성음용 AudioContext
  let noiseBuffer = null;
  let effectsBus=null,musicBus=null,activated=false,pageActive=true;
  let bgm=null,bgmStarting=false,musicSource=null,musicAttempt=0;
  const mediaVolumes=new WeakMap();

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const audible=()=>pageActive&&!document.hidden&&!window.wakppuServerBlocked;
  const effectLevel=()=>audible()?(window.WakppuSettings?.effectVolume()??1):0;
  const musicLevel=()=>!window.WakppuAuth?.local&&audible()?(window.WakppuSettings?.musicVolume()??0):0;

  // Reuse the shared Halloween track. One player, loaded only when enabled.
  function stopMusic(){
    musicAttempt++;bgmStarting=false;bgm?.pause();
  }
  function startBgm(){
    if(!bgm){
      bgm=new Audio();bgm.id='backgroundMusic';bgm.loop=true;bgm.preload='none';bgm.hidden=true;
      bgm.src='sounds/halloween-waltz.mp3';document.body.append(bgm);
    }
    if(ctx&&!musicSource&&ctx.createMediaElementSource){
      try{musicSource=ctx.createMediaElementSource(bgm);musicSource.connect(musicBus);}catch{}
    }
    bgm.volume=musicSource?1:musicLevel();
    if(!bgm.paused||bgmStarting)return;
    const attempt=++musicAttempt;bgmStarting=true;
    try{Promise.resolve(bgm.play()).catch(()=>{}).finally(()=>{if(attempt===musicAttempt)bgmStarting=false;});}
    catch{bgmStarting=false;}
  }
  function syncAudio(){
    const level=effectLevel();
    if(effectsBus)effectsBus.gain.value=level;
    for(const pool of Object.values(pools))for(const audio of pool.items){
      audio.volume=(mediaVolumes.get(audio)||0)*level;if(level===0)audio.pause();
    }
    if(musicBus)musicBus.gain.value=musicLevel();
    if(!activated||musicLevel()===0){stopMusic();return;}
    startBgm();
  }
  window.addEventListener('wakppu-settings-changed',syncAudio);
  window.addEventListener('wakppu-access-changed',syncAudio);
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden&&activated&&ctx?.state==='suspended')ctx.resume().then(syncAudio).catch(()=>{});
    syncAudio();
  });
  window.addEventListener('pagehide',()=>{pageActive=false;syncAudio();});
  window.addEventListener('pageshow',()=>{pageActive=true;syncAudio();});
  document.addEventListener('keydown',event=>{if(!event.repeat)unlock();},true);

  /* ---------- 음원 로딩 · 일시 오류 복구 ---------- */
  // These legacy names intentionally use procedural audio when no file exists.
  // A dedicated asset must never turn into a generic tap while loading or retrying.
  const placeholderNames=new Set(['tap1','tap2','tap3','crack1','crack2','break']);
  const playAttempts=new WeakMap();
  function failed(pool,audio,generation){
    if(pool.generation!==generation)return;
    pool.ready.delete(audio);pool.ok=pool.ready.size>0;
    if(pool.ok)return;
    clearTimeout(pool.timer);
    if(pool.state==='error')return;
    pool.state='error';pool.failures++;
    pool.retryAt=Date.now()+Math.min(30000,1000*2**Math.min(pool.failures-1,5));
  }
  function load(pool){
    if(pool.state==='loading'||pool.ok||Date.now()<pool.retryAt)return;
    const generation=++pool.generation;pool.state='loading';
    for(const audio of pool.items){audio.pause();audio.removeAttribute?.('src');audio.load?.();}
    pool.items=[];pool.ready.clear();pool.next=0;let expanded=false;
    function add(probe=false){
      const audio=new Audio();audio.preload='auto';pool.items.push(audio);
      audio.addEventListener('canplay',()=>{
        if(generation!==pool.generation)return;
        clearTimeout(pool.timer);pool.ready.add(audio);pool.ok=true;pool.state='ready';pool.failures=0;
        if(probe&&!expanded){expanded=true;for(let i=1;i<SOUND_SETTINGS.poolSize;i++)add();}
      });
      audio.addEventListener('error',()=>failed(pool,audio,generation));audio.src=pool.src;return audio;
    }
    const probe=add(true);
    pool.timer=setTimeout(()=>{if(!pool.ok)failed(pool,probe,generation);},10000);
  }
  function init(names){
    for(const name of names){
      let pool=pools[name];
      if(!pool){pool=pools[name]={name,src:SOUND_SETTINGS.folder+name+(/\.(?:mp3|wav|ogg)$/i.test(name)?'':SOUND_SETTINGS.extension),items:[],ready:new Set(),next:0,ok:false,state:'idle',retryAt:0,failures:0,generation:0,timer:null};}
      // Missing legacy samples are expected; avoid repeated 404 requests for them.
      if(pool.state==='idle'||(!placeholderNames.has(name)&&pool.state==='error'))load(pool);
    }
  }

  /* ---------- 브라우저 정책상 첫 터치 때 오디오를 깨워야 해요 ---------- */
  function unlock() {
    activated=true;
    if(!audible()||(effectLevel()===0&&musicLevel()===0))return;
    if (!ctx||ctx.state==='closed') {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC){syncAudio();return;}
      try{
        if(musicSource){stopMusic();musicSource.disconnect();musicSource=null;bgm.remove();bgm=null;}
        ctx = new AC();noiseBuffer=null;
        effectsBus=ctx.createGain();effectsBus.connect(ctx.destination);
        musicBus=ctx.createGain();musicBus.connect(ctx.destination);
        ctx.onstatechange=syncAudio;
      }catch{ctx=null;syncAudio();return;}
    }
    if (ctx.state === 'suspended') ctx.resume().then(syncAudio).catch(()=>{});
    syncAudio();
  }

  /* ---------- 재생 ---------- */
  // opts: { pitch, pitchRandom, volume, volumeRandom }
  function play(name, opts) {
    if(effectLevel()===0)return;
    const rate = clamp(opts.pitch * (1 + rand(-opts.pitchRandom, opts.pitchRandom)), 0.5, 2);
    const vol = clamp(opts.volume * (1 + rand(-opts.volumeRandom, opts.volumeRandom)), 0, 1);

    init([name]);const pool=pools[name];
    if(pool?.ok){
      const ready=pool.items.filter(audio=>pool.ready.has(audio));
      if(ready.length){
        const audio=ready[pool.next++%ready.length],generation=pool.generation,attempt=(playAttempts.get(audio)||0)+1;playAttempts.set(audio,attempt);
        const rejected=error=>{
          if(playAttempts.get(audio)!==attempt||error?.name==='AbortError'||error?.name==='NotAllowedError')return;
          failed(pool,audio,generation);
        };
        try{
          audio.pause();audio.currentTime=0;mediaVolumes.set(audio,vol);audio.volume=vol*effectLevel();
          audio.preservesPitch=false;audio.mozPreservesPitch=false;audio.webkitPreservesPitch=false;audio.playbackRate=rate;
          const promise=audio.play();if(promise?.catch)promise.catch(rejected);
        }catch(error){rejected(error);}
        return;
      }
    }
    if(placeholderNames.has(name)&&SOUND_SETTINGS.usePlaceholderSound&&opts.fallback!==false)synth(name,rate,vol);
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
    if (!ctx||ctx.state!=='running'||!effectsBus) return;
    const t = ctx.currentTime + 0.005;
    const out = ctx.createGain();
    out.gain.value = vol;
    out.connect(effectsBus);
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

  function stop(name){for(const a of pools[name]?.items||[]){a.pause();a.currentTime=0;}}
  return { init, unlock, play, stop, ready:name=>!!pools[name]?.ok };
})();
