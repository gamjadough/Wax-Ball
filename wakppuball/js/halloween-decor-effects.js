// Small, silent cosmetics. No overlay receives input and each burst has a bounded lifetime.
(() => {
 let account=null,equipped=null,owned={},companion=null,burst=null,timer=null,shattered=false,lastHit=-Infinity;
 const read=()=>window.WakppuItemGame?.read(),reduced=()=>window.WakppuSettings?.reduced()??false;
 const usable=()=>read()?.account===account&&read()?.ready&&!read()?.blocked&&!read()?.test&&!document.hidden;
 function clearBurst(){clearTimeout(timer);timer=null;burst?.remove();burst=null;}
 function clear(){clearBurst();companion?.remove();companion=null;}
 function render(){
  companion?.remove();companion=null;if(!usable()||shattered||equipped!=='little_ghost'||!owned.little_ghost)return;
  companion=document.createElement('div');companion.className='hdecor-companion';companion.setAttribute('aria-hidden','true');companion.innerHTML=WakppuHalloweenDecorData.art('little_ghost',true);document.getElementById('ballWrap').append(companion);
 }
 function sync(id,data){
  if(account!==id){clear();shattered=false;}account=id;owned=data?.owned||{};equipped=data?.equipped||null;
  if(!owned[equipped])equipped=null;if(!owned.bat_swarm)clearBurst();render();
 }
 function hit({final=false}={}){
  if(final){shattered=true;clear();return;}
  if(!usable()||equipped!=='pumpkin_ember'||!owned.pumpkin_ember||performance.now()-lastHit<160)return;
  lastHit=performance.now();clearBurst();burst=document.createElement('div');burst.className='hdecor-embers';burst.setAttribute('aria-hidden','true');
  burst.innerHTML=WakppuHalloweenDecorData.art('pumpkin_ember',true);document.getElementById('ballWrap').append(burst);timer=setTimeout(clearBurst,reduced()?180:420);
 }
 function use(){
  if(!usable()||!owned.bat_swarm||read().busy)return;clearBurst();burst=document.createElement('div');burst.className='hdecor-bats';burst.setAttribute('aria-hidden','true');
  const count=reduced()?1:innerWidth<600?2:3;for(let i=0;i<count;i++){const bat=document.createElement('div');bat.className='hdecor-bat';bat.style.setProperty('--i',i);bat.innerHTML=WakppuHalloweenDecorData.art('bat_swarm',true);burst.append(bat);}
  document.getElementById('stage').append(burst);timer=setTimeout(clearBurst,reduced()?1400:5000);
 }
 window.addEventListener('wakppu-auth-changed',e=>{if(e.detail?.user?.id!==account){clear();account=null;equipped=null;owned={};}});
 window.addEventListener('wakppu-account-restored',()=>{if(read()?.account!==account)clear();else render();});
 window.addEventListener('wakppu-settings-changed',()=>{clearBurst();render();});document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();else render();});window.addEventListener('pagehide',clear);window.addEventListener('pageshow',render);
 window.WakppuHalloweenDecor={sync,hit,use,stop:clearBurst,spawn:()=>{shattered=false;clearBurst();render();}};
})();
