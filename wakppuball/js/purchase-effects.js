// Cosmetic only. A single reusable layer follows the ball's own shape and hits.
(() => {
 'use strict';
 const sound='starlight/shimmer-v2.wav';
 let active=false,ball=null,layer=null,pulse=null,lastSound=-Infinity,fragments=[];
 const stopped=()=>document.hidden||window.wakppuServerBlocked;
 function ensure(){
  if(layer)return;
  const wrap=document.getElementById('ballWrap');if(!wrap)return;
  layer=document.createElement('div');layer.className='purchase-aura';layer.setAttribute('aria-hidden','true');
  layer.innerHTML='<svg viewBox="0 0 200 200"><g class="purchase-stars" fill="#fff9e8">'+[[39,48,3],[157,43,2],[178,105,2.5],[144,166,3],[44,159,2],[28,95,1.6]].map(([x,y,r],i)=>'<path style="--delay:'+(-i*.7)+'s" d="M'+x+' '+(y-r*2)+' Q'+x+' '+y+' '+(x+r)+' '+y+' Q'+x+' '+y+' '+x+' '+(y+r*2)+' Q'+x+' '+y+' '+(x-r)+' '+y+' Q'+x+' '+y+' '+x+' '+(y-r*2)+'Z"/>').join('')+'</g><g class="purchase-dust" fill="#fff"><circle cx="68" cy="36" r=".7"/><circle cx="166" cy="139" r=".8"/><circle cx="74" cy="173" r=".8"/></g></svg>';
  wrap.append(layer);
 }
 function tint(){
  const c=ball?.design?.colors;
  const color=ball?.id==='blackhole'?'#a9cfff':ball?.id==='whitehole'?'#b6e5ff':(c?.light||(Array.isArray(c)?c[2]:null)||'#e8d5aa');
  document.getElementById('ballWrap')?.style.setProperty('--aura-tint',color);
 }
 function clearMotion(){pulse?.cancel();pulse=null;fragments.forEach(a=>a.cancel());fragments=[];}
 function reset(){clearMotion();SoundManager.stop(sound);lastSound=-Infinity;}
 function setActive(next){
  if(active===!!next)return;active=!!next;
  if(active){ensure();tint();SoundManager.init([sound]);}else reset();
 }
 function spawn(next){ball=next;reset();document.getElementById('ballWrap')?.classList.remove('purchase-aura-broken');if(active){ensure();tint();}}
 function shatter({speed=1}={}){
  const wrap=document.getElementById('ballWrap');
  if(!active||!wrap||wrap.classList.contains('purchase-aura-broken'))return;
  ensure();clearMotion();wrap.classList.add('purchase-aura-broken');
  if(stopped()||window.WakppuSettings?.reduced())return;
  // The glow is removed immediately; its stars travel outward with the wax.
  pulse=layer.animate([{opacity:.9},{opacity:0}],{duration:650/speed,fill:'forwards',easing:'ease-out'});
  const size=wrap.getBoundingClientRect().width;
  layer.querySelectorAll('.purchase-stars path').forEach((star,i)=>{
   const angle=(-2.3+i*Math.PI/3),reach=size*.2;
   fragments.push(star.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${Math.cos(angle)*reach}px,${Math.sin(angle)*reach+size*.08}px) rotate(${i%2?40:-40}deg) scale(.1)`,opacity:0}],{duration:650/speed,fill:'forwards',easing:'ease-out'}));
  });
 }
 function hit({final=false}={}){
  if(!active||stopped())return;
  ensure();
  if(layer&&!window.WakppuSettings?.reduced()){
   pulse?.cancel();pulse=layer.animate([{opacity:.7,transform:'scale(.98)'},{opacity:1,transform:'scale(1.035)',offset:.25},{opacity:.7,transform:'scale(1)'}],{duration:360,easing:'ease-out'});
  }
  // One short, quiet voice: rapid taps cannot stack an increasingly loud chord.
  const now=performance.now();if(now-lastSound<280&&!final)return;
  if((window.WakppuSettings?.effectVolume()??1)===0)return;
  lastSound=now;SoundManager.stop(sound);SoundManager.play(sound,{pitch:final?1.12:1,pitchRandom:.015,volume:final?.20:.13,volumeRandom:0,fallback:false});
 }
 window.addEventListener('pagehide',reset);
 window.addEventListener('wakppu-settings-changed',()=>{if(window.WakppuSettings?.reduced())clearMotion();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
 window.addEventListener('wakppu-access-changed',()=>{if(window.wakppuServerBlocked)reset();});
 window.WakppuPurchaseEffects={setActive,spawn,hit,shatter};
})();
