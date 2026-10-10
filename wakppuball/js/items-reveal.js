/* Presentation only: the server has already paid and granted every result. */
(() => {
  const defs=WakppuItemData.list,ranks=WakppuItemData.ranks;
  let state=null,owner=null,timer=null,breaking=false,host;
  const key=id=>'wakppu-draw-reveal:'+id;
  const account=()=>window.WakppuItemGame?.read().account;
  const card=id=>{const d=defs.find(d=>d.id===id),r=ranks.find(r=>r.id===d.rank);return '<article class="draw-result '+d.rank+'" style="--item-color:'+r.color+'"><span>'+d.icon+'</span><strong>'+d.name+'</strong><small>'+r.name+'</small><p>'+WakppuItemData.description(d)+'</p></article>';};
  function persist(){try{if(state)localStorage.setItem(key(owner),JSON.stringify(state));else if(owner)localStorage.removeItem(key(owner));}catch{/* Storage disabled: server inventory is still safe. */}}
  function stop(){clearTimeout(timer);breaking=false;}
  function render(){
    if(!host)return;
    host.hidden=!state;
    if(!state){host.replaceChildren();WakppuItems.render();return;}
    const d=defs.find(d=>d.id===state.results[state.index]),r=ranks.find(r=>r.id===d.rank),steps=ranks.indexOf(r)+2;
    host.style.setProperty('--draw-color',r.color);
    host.style.setProperty('--reveal-duration',(200+ranks.indexOf(r)*125)+'ms');
    host.innerHTML='<p class="draw-progress" role="status">'+(state.index+1)+' / '+state.results.length+' · '+(state.revealed?'아이템 공개 완료':'왁뿌볼을 눌러 아이템을 꺼내세요')+'</p>'+
      (state.revealed?card(d.id)+'<button id="drawNext" class="btn">'+(state.index+1===state.results.length?'전체 결과 보기':'다음 왁뿌볼')+'</button>':
      '<button id="drawWaxBall" class="draw-wax-ball" aria-label="뽑기 왁뿌볼 깨기" style="--leak:'+state.taps/steps+'"><svg viewBox="0 0 240 240" aria-hidden="true"><defs><radialGradient id="drawWaxGradient" cx="32%" cy="24%"><stop stop-color="#fff4cd"/><stop offset=".62" stop-color="#c1a87a"/><stop offset="1" stop-color="#77684f"/></radialGradient></defs><circle class="draw-ball-shell" cx="120" cy="120" r="92" fill="url(#drawWaxGradient)"/><ellipse cx="87" cy="64" rx="35" ry="14" fill="#fff" opacity=".14" transform="rotate(-28 87 64)"/>'+["M88 37L110 80 90 109 120 130 107 179 129 211","M110 80L142 72 175 47","M120 130L157 119 187 140 213 141","M107 179L74 162 43 185","M90 109L57 99 29 120","M157 119L159 169 180 190"].slice(0,Math.ceil(state.taps/steps*6)).map(path=>'<path class="draw-ball-crack" d="'+path+'"/>').join('')+'</svg><span class="draw-wax-fragment"></span><span class="draw-wax-fragment"></span><span class="draw-wax-fragment"></span></button><p class="draw-touch-hint">톡, 톡… 균열 사이로 빛이 새어 나옵니다.</p>')+
      '<div class="draw-skip-actions">'+(!state.revealed?'<button id="drawSkipOne" class="btn small">현재 볼 스킵</button>':'')+'<button id="drawSkipAll" class="btn small">남은 연출 모두 스킵</button></div>';
    host.querySelector('#drawWaxBall')?.classList.toggle('draw-cracked',state.taps>0);
    WakppuItems.render();
  }
  function finish(){stop();const results=state.results;state=null;persist();document.querySelector('#drawResults').innerHTML=results.map(card).join('');render();WakppuItems.status(results.length+'개 아이템을 모두 확인했습니다. 인벤토리에서 사용할 수 있습니다.');}
  function reveal(skip=false){
    if(!state||state.revealed||breaking)return;
    const r=ranks.findIndex(r=>r.id===defs.find(d=>d.id===state.results[state.index]).rank);
    const done=()=>{breaking=false;if(!state||owner!==account())return;state.revealed=true;persist();render();if(!document.querySelector('#shop').hidden&&!document.querySelector('#shopDraw').hidden)document.querySelector('#drawNext').focus();};
    if(skip||matchMedia('(prefers-reduced-motion: reduce)').matches){done();return;}
    breaking=true;host.classList.add('draw-breaking');host.querySelector('#drawWaxBall').disabled=true;
    timer=setTimeout(()=>{host.classList.remove('draw-breaking');done();},200+r*125);
  }
  function restore(){
    if(owner===account()&&state)return;
    stop();host?.classList.remove('draw-breaking');state=null;owner=account();
    if(host)document.querySelector('#drawResults').replaceChildren();
    try{const saved=JSON.parse(localStorage.getItem(key(owner)));if(owner&&saved&&Array.isArray(saved.results)&&[1,3,5].includes(saved.results.length)&&saved.results.every(id=>defs.some(d=>d.id===id))&&Number.isInteger(saved.index)&&saved.index>=0&&saved.index<saved.results.length){state={results:saved.results,index:saved.index,taps:Math.max(0,Math.min(6,Number(saved.taps)||0)),revealed:!!saved.revealed};}}catch{}
    render();
  }
  function start(results,id){stop();owner=id;state={results:[...results],index:0,taps:0,revealed:false};persist();document.querySelector('#drawResults').replaceChildren();host.classList.remove('draw-breaking');render();host.scrollIntoView({block:'nearest'});}
  document.addEventListener('DOMContentLoaded',()=>{
    host=document.createElement('section');host.id='drawReveal';host.className='draw-reveal';host.hidden=true;
    document.querySelector('#drawResults').before(host);
    host.addEventListener('click',e=>{
      if(!state||owner!==account())return;
      if(e.target.closest('#drawSkipAll')){host.classList.remove('draw-breaking');finish();return;}
      if(e.target.closest('#drawSkipOne')){stop();host.classList.remove('draw-breaking');reveal(true);return;}
      if(e.target.closest('#drawNext')){if(state.index+1===state.results.length){finish();return;}state.index++;state.taps=0;state.revealed=false;persist();render();document.querySelector('#drawWaxBall').focus();return;}
      if(e.target.closest('#drawWaxBall')&&!breaking&&!state.revealed){
        state.taps++;persist();render();
        try{if(typeof SoundManager!=='undefined'){SoundManager.unlock();SoundManager.play(state.taps>1?'crack1':'tap1',{pitch:1,pitchRandom:.08,volume:.6,volumeRandom:.05});}}catch{}
        const rankIndex=ranks.findIndex(r=>r.id===defs.find(d=>d.id===state.results[state.index]).rank);
        if(state.taps>=rankIndex+2)reveal();else document.querySelector('#drawWaxBall').focus();
      }
    });
    restore();
  });
  window.WakppuDrawReveal={get pending(){return !!state;},start,restore};
})();
