(() => {
 const $=id=>document.getElementById(id),skins=WakppuPumpkinSkins,base=WakppuLimitedData.ball,key='wakppu-local-pumpkin-skin-preview-v1';
 const allSounds=new Set([...skins.profiles.flatMap(p=>p.sounds),...['early','mid','late','final'].flatMap(k=>base.sound[k])]);
 let selected='wisp',ball,clicks=0,busy=false,serial=0,effect=null,finalTimer=null,cracks=[];const osReduced=matchMedia('(prefers-reduced-motion: reduce)');
 try{const stored=localStorage.getItem(key);if(skins.profile(stored)||stored==='base')selected=stored;}catch{}
 const requested=new URLSearchParams(location.search).get('skin');if(skins.profile(requested))selected=requested;
 const reduced=()=>osReduced.matches||$('reduced').checked;
 window.WakppuSettings={effectVolume:()=>$('muted').checked?0:Number($('volume').value)/100,musicVolume:()=>0,reduced};
 window.WakppuAuth={local:true};
 // This workshop lives one URL level below the game; audio must resolve from the game root.
 SOUND_SETTINGS.folder='/sounds/';
 function stopSound(){for(const name of allSounds)SoundManager.stop(name);}
 function cancel(){++serial;clearTimeout(finalTimer);effect?.cancel();effect=null;skins.reset($('ballSvg'));stopSound();busy=false;}
 function draw(){
  const uid=makeUid(),svg=$('ballSvg');svg.innerHTML=buildBallSvgInner(ball,uid);cracks=[];
  const paths=['M100 99L70 73L65 49L46 39','M100 99L137 77L143 48L159 42','M100 99L125 128L119 157L138 173','M100 99L74 126L68 155L47 164','M74 126L42 119L27 99','M137 77L169 100L176 127'];
  const layer=svg.querySelector('[id$="-cracks"]');for(let i=0;i<paths.length;i++)for(const [color,width] of [[ball.design.crack.dark,3],[ball.design.crack.light,1.2]]){const n=document.createElementNS('http://www.w3.org/2000/svg','path');n.setAttribute('d',paths[i]);n.setAttribute('fill','none');n.setAttribute('stroke',color);n.setAttribute('stroke-width',width);n.setAttribute('pathLength','1');n.setAttribute('stroke-dasharray','1');n.dataset.previewCrack=String(i);layer.append(n);cracks.push({n,index:i});}
  update();
 }
 function update(){
  const p=Math.min(1,clicks/100);for(const {n,index} of cracks){const frac=Math.max(0,Math.min(1,(p-index*.06)/.6));n.setAttribute('stroke-dashoffset',String(1-frac));n.setAttribute('opacity',frac>0?'1':'0');}
  $('progress').value=clicks;$('progressText').textContent=busy?'마지막 균열 → 파괴 연출 → 재등장':`균열 ${clicks} / 100`;
  $('hit').disabled=busy;$('destroy').disabled=busy;$('hear').disabled=busy;
  document.documentElement.classList.toggle('preview-reduced',reduced());
 }
 function choose(id,persist=true){
  cancel();selected=skins.profile(id)?id:'base';ball=selected==='base'?base:skins.appearance(base,selected);clicks=0;
  const p=skins.profile(selected);document.documentElement.style.setProperty('--accent',p?.accent||'#ffbf6d');
  $('skinRank').textContent=p?`${p.rank} · 예정 ${p.price} 사탕 · 교환 미구현`:'기본 외형 · 비교용';$('skinName').textContent=p?.name||base.name;$('skinDescription').textContent=p?.description||'현재 운영 잭오랜턴의 외형과 파괴 효과';
  for(const b of document.querySelectorAll('[data-skin]'))b.setAttribute('aria-pressed',String(b.dataset.skin===selected));$('baseSkin').setAttribute('aria-pressed',String(selected==='base'));
  if(persist)try{localStorage.setItem(key,selected);}catch{}
  SoundManager.init(['early','mid','late','final'].flatMap(k=>getSoundConfig(ball)[k]));draw();$('status').textContent='공을 누르거나 균열·파괴 버튼으로 비교해보세요.';
 }
 function sound(final=false){const cfg=getSoundConfig(ball),p=clicks/100,stage=final?'final':p<.35?'early':p<.7?'mid':'late';SoundManager.play(cfg[stage][0],{pitch:cfg.pitch,pitchRandom:cfg.pitchRandom,volume:cfg.volume,volumeRandom:cfg.volumeRandom});}
 function shatter(){
  busy=true;clicks=100;update();const epoch=serial;finalTimer=setTimeout(()=>{
   if(epoch!==serial)return;sound(true);const stage=$('stage').getBoundingClientRect(),bounds=$('ballWrap').getBoundingClientRect();
   const options={ball,svg:$('ballSvg'),wrap:$('ballWrap'),effects:$('effects'),center:{x:bounds.x+bounds.width/2-stage.x,y:bounds.y+bounds.height/2-stage.y},radius:bounds.width*.43,reduced:reduced(),valid:()=>epoch===serial&&!document.hidden,reward:()=>{$('status').textContent='파괴 확인 · 미리보기이므로 실제 Gold·사탕은 바뀌지 않습니다.';},respawn:()=>{if(epoch===serial){busy=false;clicks=0;draw();}}};
   effect=selected==='base'?WakppuHalloweenEffects.play({...options,random:()=>1}):skins.play(options);
  },70);
 }
 function hit(){if(busy||document.hidden)return;SoundManager.unlock();clicks=Math.min(100,clicks+10);update();if(clicks===100)shatter();else{sound();skins.hit({ball,svg:$('ballSvg'),progress:clicks/100,reduced:reduced()});}}
 for(const p of skins.profiles){const button=document.createElement('button');button.className='skin-choice';button.type='button';button.dataset.skin=p.id;button.setAttribute('aria-pressed','false');button.innerHTML=buildBallThumb(skins.appearance(base,p.id))+`<span><strong>${p.name}</strong><small>${p.rank} · 예정 ${p.price} 사탕</small></span>`;button.onclick=()=>{SoundManager.unlock();choose(p.id);};$('skinChoices').append(button);}
 $('ballSvg').addEventListener('pointerdown',e=>{e.preventDefault();hit();});$('ballSvg').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();hit();}});$('hit').onclick=hit;
 $('baseSkin').onclick=()=>choose('base');$('destroy').onclick=()=>{if(busy)return;SoundManager.unlock();shatter();};$('reset').onclick=()=>choose(selected,false);
 document.querySelectorAll('[data-progress]').forEach(b=>b.onclick=()=>{cancel();clicks=Number(b.dataset.progress)*100;draw();skins.hit({ball,svg:$('ballSvg'),progress:clicks/100,reduced:reduced()});});
 $('hear').onclick=()=>{SoundManager.unlock();sound();};
 for(const id of ['muted','volume','reduced'])$(id).addEventListener('input',()=>{if(id==='reduced')choose(selected,false);update();window.dispatchEvent(new Event('wakppu-settings-changed'));});
 osReduced.addEventListener('change',()=>choose(selected,false));document.addEventListener('visibilitychange',()=>{if(document.hidden)choose(selected,false);});window.addEventListener('pagehide',cancel);
 window.WakppuPumpkinSkinPreview={read:()=>({selected,clicks,busy,baseReward:base.reward,required:base.clicks,local:true})};choose(selected,false);
})();
