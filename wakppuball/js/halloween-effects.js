(() => {
const images=['images/scares/jackolantern.png','images/scares/ghost.png','images/scares/witch.png'];
let prepared=false;
function prepare(){if(prepared)return;prepared=true;void (async()=>{for(const src of images){const img=new Image();img.src=src;try{await img.decode();}catch{}}})();}
function chooseScare(random=Math.random){return random()<.3?Math.min(2,Math.floor(random()*images.length)):null;}
function showScare(index,valid,theme){
 const overlay=document.createElement('div');overlay.className='jackolantern-scare';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','잭오랜턴 깜짝 연출');
 const image=document.createElement('img');image.src=images[index];image.alt=['빛나는 잭오랜턴 얼굴','포효하는 유령','할로윈 마녀 괴물'][index];overlay.append(image);
 if(theme==='eclipse'){overlay.classList.add('jackolantern-scare-eclipse');overlay.setAttribute('aria-label','월식의 잭오랜턴 깜짝 연출');const moon=document.createElement('span');moon.className='scare-blood-moon';moon.setAttribute('aria-hidden','true');overlay.append(moon);}
 const close=document.createElement('button');close.className='jackolantern-scare-close';close.type='button';close.textContent='닫기';close.setAttribute('aria-label','깜짝 연출 닫기');overlay.append(close);
 const previous=document.activeElement;let timer,closed=false,started=false,finish;const done=new Promise(resolve=>{finish=resolve;});
 function cancel(){if(closed)return;closed=true;clearTimeout(timer);const focused=overlay.contains(document.activeElement);overlay.remove();if(started)SoundManager.stop('jackolantern-sting.wav');document.removeEventListener('keydown',key);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('wakppu-access-changed',blocked);window.removeEventListener('pagehide',cancel);if(focused&&previous?.isConnected)previous.focus({preventScroll:true});finish();}
 function key(e){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();cancel();}else if(e.key==='Tab'){e.preventDefault();close.focus();}}
 function hidden(){if(document.hidden)cancel();}function blocked(){if(!valid()||window.wakppuServerBlocked)cancel();}
 close.onclick=cancel;overlay.addEventListener('pointerdown',e=>e.stopPropagation());
 document.addEventListener('keydown',key);document.addEventListener('visibilitychange',hidden);window.addEventListener('wakppu-access-changed',blocked);window.addEventListener('pagehide',cancel);
 // A slow mobile connection must not play the sting over an empty image, or block play indefinitely.
 timer=setTimeout(cancel,2000);
 image.decode().then(()=>{if(closed)return;if(!valid()||document.hidden||window.wakppuServerBlocked){cancel();return;}clearTimeout(timer);started=true;document.body.append(overlay);close.focus({preventScroll:true});SoundManager.play('jackolantern-sting.wav',{pitch:theme==='eclipse'?.82:1,pitchRandom:0,volume:theme==='eclipse'?.85:1,volumeRandom:0});timer=setTimeout(cancel,1100);}).catch(cancel);return {cancel,done};
}
function startScare({valid,random=Math.random,theme}){if(!valid()||window.WakppuPumpkinInventory?.scareAllowed?.()===false)return null;const choice=chooseScare(random);return choice===null?null:showScare(choice,valid,theme);}
window.WakppuHalloweenEffects={prepare,chooseScare,startScare,play({wrap,svg,effects,center,valid,reward,respawn,speed=1,respawnSpeed=1,random=Math.random}){
 const nodes=[],animations=[],timers=[];let stopped=false,paid=false;const reduced=window.WakppuSettings?.reduced()??matchMedia('(prefers-reduced-motion: reduce)').matches;
 const scare=startScare({valid,random});
 function cancel(){stopped=true;scare?.cancel();timers.forEach(clearTimeout);animations.forEach(a=>a.cancel());nodes.forEach(n=>n.remove());delete wrap.dataset.halloweenPhase;}
 function later(ms,fn){timers.push(setTimeout(()=>{if(stopped)return;if(!valid()){cancel();return;}fn();},ms/speed));}
 wrap.dataset.halloweenPhase='shatter';
 animations.push(svg.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:reduced?'scale(1)':'scale(1.15)'}],{duration:(reduced?250:400)/speed,fill:'forwards'}));
 const compact=matchMedia('(max-width: 600px), (max-height: 500px)').matches,count=reduced?0:compact?6:12;
 for(let i=0;i<count;i++){const n=document.createElement('span');n.className='halloween-fx';n.setAttribute('aria-hidden','true');n.textContent=i%3===0?'👻':i%3===1?'🎃':'✨';n.style.left=center.x+'px';n.style.top=center.y+'px';effects.append(n);nodes.push(n);const angle=i*Math.PI*2/count;animations.push(n.animate([{opacity:1,transform:'translate(-50%,-50%) scale(.5)'},{opacity:0,transform:'translate('+Math.cos(angle)*(compact?80:120)+'px,'+(Math.sin(angle)*(compact?60:90)-60)+'px) scale(1.2) rotate('+(i*35)+'deg)'}],{duration:1100/speed,fill:'forwards',easing:'ease-out'}));}
 later(reduced?250:450,()=>{if(!paid){paid=true;reward();wrap.dataset.halloweenPhase='reward';}});
 later((reduced?550:1300)+1000*speed/respawnSpeed,()=>{Promise.resolve(scare?.done).then(()=>{if(stopped)return;if(!valid()){cancel();return;}cancel();respawn();});});return {cancel};
}};
})();
