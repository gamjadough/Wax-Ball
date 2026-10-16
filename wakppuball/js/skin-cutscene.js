// Presentation only. Does NOT draw/grant a skin or spend Gold.
// Original SVG composition; audio derived from the credited Kenney CC0 samples.
(() => {
 let state=null,context=null,bytes=null,buffers=null;
 const paths=['sounds/eternity/legendary-late.mp3','sounds/eternity/transcendent-final.mp3'];
 function unlockAudio(){try{const AC=window.AudioContext||window.webkitAudioContext;if(AC){context||=new AC();context.resume().catch(()=>{});}preload();}catch{}}
 function preload(){return bytes||=(Promise.all(paths.map(async src=>{const r=await fetch(src);if(!r.ok)throw new Error('audio unavailable');return r.arrayBuffer();})).catch(()=>null));}
 function stopAudio(s){s.sources.forEach(source=>{try{source.stop();source.disconnect();}catch{}});s.sources=[];}
 function sound(s){
  try{
   const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)return;
   context||=new AudioContext();context.resume().catch(()=>{});
   const anchor=context.currentTime;
   const decoded=buffers||=(preload().then(data=>data?Promise.all(data.map(b=>context.decodeAudioData(b.slice(0)))):null).catch(()=>null));
   decoded.then(data=>{
    if(!data||state!==s||s.result)return;
    for(const [index,delay,rate,volume] of [[0,s.reduced?.45:2.5,.8,.2],[1,s.reduced?.9:3.65,.72,s.reduced?.3:.65]]){
     const when=anchor+delay;if(context.currentTime>when+.2)continue;
     const source=context.createBufferSource(),gain=context.createGain();source.buffer=data[index];source.playbackRate.value=rate;gain.gain.value=volume*(window.WakppuSettings?.effectVolume()??1);source.connect(gain);gain.connect(context.destination);source.onended=()=>{source.disconnect();gain.disconnect();};s.sources.push(source);s.gains.push({gain,volume});source.start(Math.max(context.currentTime,when));
    }
   }).catch(()=>{});
  }catch{/* Visuals and skip remain available if audio is blocked. */}
 }
 function art(){
  const stars=Array.from({length:70},(_,i)=>`<circle cx="${(i*173+41)%1000}" cy="${(i*229+71)%1000}" r="${i%9===0?1.8:.6+i%3*.4}" opacity="${.15+i%6*.11}" fill="${i%3?'#c6c5f5':'#7adaf3'}"/>`).join('');
  return `<svg class="cutscene-sky" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${stars}<g stroke="#8275bf" stroke-width=".6" fill="none" opacity=".28"><path d="M82 301L190 204L314 245L401 128M738 841L829 706L943 729M84 774L201 674L264 812"/><circle cx="190" cy="204" r="6"/><circle cx="829" cy="706" r="7"/></g></svg><svg class="cutscene-portal" viewBox="0 0 240 240" aria-hidden="true"><g fill="none"><circle cx="120" cy="120" r="88" stroke="#35264f" stroke-width="20"/><circle cx="120" cy="120" r="86" stroke="#a58bd7" stroke-width=".8" stroke-dasharray="3 8"/><ellipse cx="120" cy="120" rx="108" ry="40" stroke="#6ac8e8" opacity=".6" transform="rotate(-32 120 120)"/><ellipse cx="120" cy="120" rx="104" ry="46" stroke="#aa82f0" opacity=".6" transform="rotate(34 120 120)"/><path class="cutscene-rift" d="M117 13L107 52L128 78L112 106L131 135L112 162L125 187L116 227M112 106L75 94L46 105M131 135L165 126L194 143" stroke="#b19ae8" stroke-width="3"/><path class="cutscene-rift-core" d="M117 13L107 52L128 78L112 106L131 135L112 162L125 187L116 227" stroke="#c3efff" stroke-width=".8"/></g></svg>`;
 }
 function showResult(s){
  if(state!==s||s.result)return;s.result=true;s.timers.forEach(clearTimeout);s.timers=[];stopAudio(s);
  s.root.dataset.phase='result';s.root.querySelector('.cutscene-skip').hidden=true;
  s.root.querySelector('.cutscene-footer').setAttribute('aria-hidden','false');
  s.root.querySelector('#cutsceneEquip').disabled=!s.canEquip;s.root.querySelector('#cutsceneConfirm').disabled=false;
  s.root.querySelector(s.canEquip?'#cutsceneEquip':'#cutsceneConfirm').focus();
 }
 function close(){
  if(!state)return;const s=state;state=null;s.timers.forEach(clearTimeout);stopAudio(s);s.root.remove();
  s.inert.forEach(([el,value])=>{if(el.isConnected)el.inert=value;});
  if(s.opener?.isConnected)s.opener.focus();
  s.onClose?.();
 }
 function open({onEquip,onClose,canEquip=true,production=false,opener=document.activeElement}={}){
  if(state)return false;
  const base=WAKPPU_BALLS.find(ball=>ball.id==='eternity');if(!base)return false;
  const root=document.createElement('section');root.id='skinCutscene';root.className='skin-cutscene';root.dataset.phase='dark';
  root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','cutsceneTitle');
  root.innerHTML=`<div class="cutscene-vignette" aria-hidden="true"></div><header class="cutscene-header"><span>ETERNITY <i> / </i> TRANSCENDENT</span><button class="btn small cutscene-skip" type="button">건너뛰기</button></header><div class="cutscene-stage">${art()}<div class="cutscene-verse"><p>시간이 끝나는 곳에서도,</p><p>무한은 깨지지 않는다.</p><span>BEYOND THE END OF TIME</span></div><div class="cutscene-impact" aria-hidden="true"></div><figure class="cutscene-ball" aria-hidden="true">${buildBallThumb(WakppuSkinSounds.appearance({...base,skinId:'transcendent'}))}</figure></div><footer class="cutscene-footer" aria-hidden="true"><span class="cutscene-rarity">초월 스킨</span><h2 id="cutsceneTitle">무한의 영겁</h2><p>영겁의 왁뿌볼 전용 · 로컬 연출 미리보기</p><div><button id="cutsceneEquip" class="btn primary" disabled type="button">장착하기</button><button id="cutsceneConfirm" class="btn" disabled type="button">확인</button></div><small>테스트용 연출 · Gold 차감·추가 지급 없음</small></footer>`;
  if(production){root.querySelector('.cutscene-footer p').textContent='영겁의 왁뿌볼 전용 스킨 획득';root.querySelector('.cutscene-footer small').textContent='서버에 지급 완료 · 연출을 건너뛰어도 스킨은 유지됩니다.';}
  if(!canEquip)root.querySelector('#cutsceneEquip').textContent='영겁 해금 후 장착';
  const s=state={root,opener,onEquip,onClose,canEquip,timers:[],sources:[],gains:[],result:false,reduced:window.WakppuSettings?.reduced()??matchMedia('(prefers-reduced-motion: reduce)').matches,inert:[...document.body.children].map(el=>[el,el.inert])};
  s.inert.forEach(([el])=>el.inert=true);document.body.append(root);
  root.dataset.reduced=String(s.reduced);
  function at(ms,phase){s.timers.push(setTimeout(()=>{if(state===s&&!s.result)root.dataset.phase=phase;},ms));}
  if(s.reduced){at(50,'verse');at(450,'rift');at(900,'arrival');}else{at(400,'verse');at(1700,'verse-two');at(2600,'rift');at(3650,'arrival');}
  s.timers.push(setTimeout(()=>showResult(s),s.reduced?1500:5200));
  root.querySelector('.cutscene-skip').onclick=()=>showResult(s);
  root.querySelector('#cutsceneConfirm').onclick=close;
  root.querySelector('#cutsceneEquip').onclick=async()=>{if(!s.result||state!==s||s.equipping||!s.canEquip)return;s.equipping=true;root.querySelector('#cutsceneEquip').disabled=true;root.querySelector('#cutsceneConfirm').disabled=true;try{await s.onEquip?.();if(state===s)close();}catch{if(state===s){s.equipping=false;root.querySelector('#cutsceneEquip').disabled=false;root.querySelector('#cutsceneConfirm').disabled=false;root.querySelector('.cutscene-footer p').textContent='장착에 실패했습니다. 다시 시도해주세요.';}}};
  root.addEventListener('keydown',e=>{
   if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(!s.equipping)s.result?close():showResult(s);}
   if(e.key==='Tab'){const nodes=[...root.querySelectorAll('button:not(:disabled)')].filter(el=>!el.hidden);if(nodes.length){const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}
  });
  root.querySelector('.cutscene-skip').focus();sound(s);return true;
 }
 window.addEventListener('pagehide',close);
 window.addEventListener('wakppu-settings-changed',()=>{state?.gains.forEach(({gain,volume})=>gain.gain.value=volume*(window.WakppuSettings?.effectVolume()??1));});
 window.addEventListener('wakppu-access-changed',()=>{if(window.wakppuServerBlocked)close();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&state)stopAudio(state);});
 window.WakppuSkinCutscene={open,close,preload,unlockAudio,get active(){return !!state;},get phase(){return state?.root.dataset.phase||null;}};
})();
