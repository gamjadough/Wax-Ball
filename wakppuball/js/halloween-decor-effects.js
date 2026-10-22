// Original vector companions; one compositor-driven pet, no gameplay input interception.
(() => {
 let account=null,equipped=null,owned={},companion=null,walk=null,timer=null,paused=false,x=8,y=8,lastHit=0;
 const read=()=>window.WakppuItemGame?.read(),reduced=()=>window.WakppuSettings?.reduced()??false;
 const usable=()=>read()?.account===account&&read()?.ready&&!read()?.blocked&&!read()?.test&&!document.hidden;
 function stop(){clearTimeout(timer);timer=null;if(walk){try{walk.commitStyles?.();}catch{}walk.cancel();walk=null;}paused=true;companion?.classList.add('hpet-paused');}
 function clear(){stop();companion?.remove();companion=null;}
 function roam(){
  clearTimeout(timer);if(!usable()){clear();return;}if(!companion||paused||reduced())return;
  const stage=document.getElementById('stage'),w=stage.clientWidth,h=stage.clientHeight,size=companion.offsetWidth;
  const nx=Math.random()<.5?8:Math.max(8,w-size-8),ny=Math.max(4,Math.min(h-size-4,h*(.28+Math.random()*.5))),ms=5000+Math.random()*2500;
  walk?.cancel();walk=companion.animate([{transform:'translate('+x+'px,'+y+'px)'},{transform:'translate('+nx+'px,'+ny+'px)'}],{duration:ms,easing:'ease-in-out',fill:'forwards'});x=nx;y=ny;
  timer=setTimeout(roam,ms+600);
 }
 function render(){
  if(!usable()||!owned[equipped]){clear();return;}
  if(companion?.dataset.pet===equipped)return;
  clear();paused=false;companion=document.createElement('div');companion.className='hdecor-companion hpet-'+equipped;companion.dataset.pet=equipped;companion.setAttribute('aria-hidden','true');companion.innerHTML=WakppuHalloweenDecorData.art(equipped,true);
  const stage=document.getElementById('stage');stage.append(companion);x=8;y=Math.max(4,Math.min(stage.clientHeight-companion.offsetWidth-4,stage.clientHeight*.55));companion.style.transform='translate('+x+'px,'+y+'px)';roam();
 }
 function sync(id,data){if(account!==id)clear();account=id;owned=data?.owned||{};equipped=data?.equipped||null;if(!owned[equipped])equipped=null;render();}
 function hit({final=false}={}){if(!usable()||!companion||reduced()||performance.now()-lastHit<220)return;lastHit=performance.now();const art=companion.firstElementChild;art.getAnimations().forEach(a=>a.cancel());art.animate([{transform:'scale(1)'},{transform:'scale('+ (final?'1.2':'1.08')+') rotate(-5deg)'},{transform:'scale(1)'}],{duration:final?500:260,easing:'ease-out'});}
 window.addEventListener('wakppu-auth-changed',()=>{clear();account=null;equipped=null;owned={};});
 window.addEventListener('wakppu-account-restored',render);window.addEventListener('wakppu-settings-changed',()=>{clear();render();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();else render();});window.addEventListener('pagehide',clear);window.addEventListener('pageshow',render);
 window.addEventListener('resize',()=>{clear();render();});
 window.WakppuHalloweenDecor={sync,hit,stop,use:render,spawn:render,timing:base=>WakppuHalloweenDecorData.timing(base,usable()&&owned[equipped]?equipped:null)};
})();
