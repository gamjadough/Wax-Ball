(() => {
  'use strict';
  const key='wakppuball:player-settings:v1';
  const systemMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const defaults={muted:false,sfx:true,sfxVolume:70,music:false,musicVolume:25,reduceEffects:false,flashes:true};
  let stored=true,settings={...defaults};
  function valid(input,fallback=defaults){
    const result={...fallback};
    if(!input||typeof input!=='object'||Array.isArray(input))return result;
    for(const name of Object.keys(defaults)){
      if(typeof defaults[name]==='boolean'&&typeof input[name]==='boolean')result[name]=input[name];
      if(typeof defaults[name]==='number'&&typeof input[name]==='number'&&Number.isFinite(input[name]))result[name]=Math.round(Math.max(0,Math.min(100,input[name])));
    }
    return result;
  }
  function load(){try{return valid(JSON.parse(localStorage.getItem(key)));}catch{return {...defaults};}}
  function reduced(){return settings.reduceEffects||systemMotion.matches;}
  function render(){
    document.documentElement.classList.toggle('reduced-effects',reduced());
    document.documentElement.classList.toggle('no-flashes',!settings.flashes||reduced());
    for(const name of Object.keys(defaults)){
      const input=document.querySelector('[data-setting="'+name+'"]');if(!input)continue;
      if(typeof defaults[name]==='boolean')input.checked=settings[name];else input.value=settings[name];
      const output=document.querySelector('[data-setting-output="'+name+'"]');if(output)output.textContent=settings[name]+'%';
    }
    const preview=document.querySelector('#settingsSoundPreview');
    if(preview)preview.disabled=settings.muted||!settings.sfx||settings.sfxVolume===0;
    const storageStatus=document.querySelector('#settingsStorageStatus');
    if(storageStatus)storageStatus.textContent=stored?'':'이 브라우저에서는 설정을 저장할 수 없어 이번 접속에만 적용돼요.';
  }
  function apply(){render();window.dispatchEvent(new CustomEvent('wakppu-settings-changed',{detail:{...settings}}));}
  function set(next){
    settings=valid(next,settings);
    try{localStorage.setItem(key,JSON.stringify(settings));stored=true;}catch{stored=false;}
    apply();
  }
  settings=load();
  window.WakppuSettings={read:()=>({...settings}),set,reduced,
    flashes:()=>settings.flashes&&!reduced(),
    effectVolume:()=>settings.muted||!settings.sfx?0:settings.sfxVolume/100,
    musicVolume:()=>settings.muted||!settings.music?0:settings.musicVolume/100};
  render();
  systemMotion.addEventListener?.('change',apply);
  window.addEventListener('storage',event=>{if(event.key===key||event.key===null){settings=load();apply();}});
  const modal=document.querySelector('#playerSettings'),button=document.querySelector('#settingsBtn');
  function close(){modal.hidden=true;if(!document.querySelector('#game').hidden)button.focus();}
  button.addEventListener('click',()=>{
    if(window.wakppuServerBlocked)return;
    modal.hidden=false;document.querySelector('#settingsClose').focus();
    if(typeof SoundManager!=='undefined')SoundManager.unlock();
  });
  document.querySelector('#settingsClose').addEventListener('click',close);
  modal.addEventListener('click',event=>{if(event.target===modal)close();});
  modal.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}
    if(event.key!=='Tab')return;
    const nodes=[...modal.querySelectorAll('button:not(:disabled),input:not(:disabled)')].filter(n=>n.getClientRects().length);
    const first=nodes[0],last=nodes.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  modal.addEventListener('input',event=>{
    const name=event.target.dataset.setting;if(!Object.hasOwn(defaults,name))return;
    set({[name]:event.target.type==='checkbox'?event.target.checked:Number(event.target.value)});
    if(typeof SoundManager!=='undefined')SoundManager.unlock();
  });
  document.querySelector('#settingsSoundPreview').addEventListener('click',()=>{
    if(typeof SoundManager==='undefined')return;
    SoundManager.unlock();SoundManager.play('tap1',{pitch:1,pitchRandom:0,volume:.7,volumeRandom:0});
  });
  document.querySelector('#settingsReset').addEventListener('click',()=>set(defaults));
  if(!window.AudioContext&&!window.webkitAudioContext){
    document.querySelector('[data-setting="music"]').disabled=true;
    document.querySelector('#settingsMusicNote').textContent='이 브라우저는 배경음악을 지원하지 않습니다.';
  }
})();
