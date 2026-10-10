window.WakppuHalloweenEffects={play({wrap,svg,effects,center,valid,reward,respawn,speed=1,respawnSpeed=1}){
 const nodes=[],animations=[],timers=[];let stopped=false,paid=false;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 function cancel(){stopped=true;timers.forEach(clearTimeout);animations.forEach(a=>a.cancel());nodes.forEach(n=>n.remove());delete wrap.dataset.halloweenPhase;}
 function later(ms,fn){timers.push(setTimeout(()=>{if(stopped)return;if(!valid()){cancel();return;}fn();},ms/speed));}
 wrap.dataset.halloweenPhase='shatter';
 animations.push(svg.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:reduced?'scale(1)':'scale(1.15)'}],{duration:(reduced?250:400)/speed,fill:'forwards'}));
 for(let i=0;i<(reduced?3:12);i++){const n=document.createElement('span');n.className='halloween-fx';n.setAttribute('aria-hidden','true');n.textContent=i%3===0?'👻':i%3===1?'🎃':'✨';n.style.left=center.x+'px';n.style.top=center.y+'px';effects.append(n);nodes.push(n);const angle=i*Math.PI*2/12;animations.push(n.animate([{opacity:1,transform:'translate(-50%,-50%) scale(.5)'},{opacity:0,transform:'translate('+Math.cos(angle)*120+'px,'+(Math.sin(angle)*90-60)+'px) scale(1.2) rotate('+(i*35)+'deg)'}],{duration:(reduced?400:1100)/speed,fill:'forwards',easing:'ease-out'}));}
 later(reduced?250:450,()=>{if(!paid){paid=true;reward();wrap.dataset.halloweenPhase='reward';}});
 later((reduced?550:1300)+1000*speed/respawnSpeed,()=>{cancel();respawn();});return {cancel};
}};
