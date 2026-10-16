// Cosmetic hit overlays only: never change damage, rewards, timers or inventory.
(() => {
 const animations=new WeakMap(),ns='http://www.w3.org/2000/svg';
 function reset(svg){(animations.get(svg)||[]).forEach(a=>a.cancel());animations.delete(svg);}
 function hit({ball,svg,progress}){
  reset(svg);
  const rank=ball.id==='eternity'?ball.design.skin:null;
  if(!['rare','hero','legendary'].includes(rank))return;
  const inner=svg.querySelector('[id$="-inner"]');if(!inner)return;
  let layer=inner.querySelector('[data-skin-impact]');
  if(!layer){layer=document.createElementNS(ns,'g');layer.dataset.skinImpact=rank;layer.setAttribute('pointer-events','none');inner.append(layer);}
  const p=Math.max(0,Math.min(1,progress)),length=18+48*p;
  if(rank==='rare'){
   layer.innerHTML=Array.from({length:6},(_,i)=>`<path transform="rotate(${i*60} 100 100)" d="M100 100L100 ${100-length}M100 ${110-length}L91 ${101-length}M100 ${119-length}L109 ${110-length}" fill="none" stroke="#e4ffff" stroke-width="${1+p}" opacity=".85"/>`).join('');
  }else if(rank==='hero'){
   layer.innerHTML=Array.from({length:7},(_,i)=>`<circle cx="${65+i*11}" cy="${110-i%3*17}" r="${1+p*2}" fill="${i%2?'#ffdc76':'#ff6e2c'}"/>`).join('');
  }else if(rank==='legendary'){
   layer.innerHTML=`<circle cx="100" cy="100" r="${35+p*29}" fill="none" stroke="#fff0b7" stroke-width="2" stroke-dasharray="4 9"/><path d="M68 100H132M100 68V132" stroke="#eac47c" opacity=".55"/>`;
  }
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const frames=rank==='hero'?[{opacity:1,transform:'translateY(0px)'},{opacity:.25,transform:'translateY(-13px)'}]:rank==='legendary'?[{opacity:1,transform:'rotate(12deg)'},{opacity:.3,transform:'rotate(-18deg)'}]:[{opacity:.35},{opacity:1,offset:.35},{opacity:.7}];
  layer.style.transformOrigin='100px 100px';animations.set(svg,[layer.animate(frames,{duration:320,fill:'forwards'})]);
 }
 function syncCracks({ball,svg,cracks,progress}){
  if(ball.id!=='eternity'||ball.design.skin!=='transcendent')return;
  const layer=svg.querySelector('[id$="-cracks"]');if(!layer)return;
  const p=Math.max(0,Math.min(1,progress));
  layer.dataset.skinImpact='transcendent';layer.dataset.glowPhase=p>=.95?'inward':p>=.4?'pulse':'faint';
  layer.style.setProperty('--seam-strength',String(.2+p*.8));layer.style.setProperty('--seam-period',(1.9-p)+'s');
  let particles=layer.querySelector('[data-skin-light-particles]');
  if(!particles){particles=document.createElementNS(ns,'g');particles.setAttribute('pointer-events','none');layer.append(particles);}
  const visible=cracks.filter(cr=>cr.weight===1&&cr.frac>.01),count=p<.4?0:Math.min(6,Math.floor(p*7),visible.length);
  particles.dataset.skinLightParticles=String(count);particles.replaceChildren();
  for(let i=0;i<count;i++){
   const crack=visible[i],point=crack.dark.getPointAtLength(crack.dark.getTotalLength()*crack.frac*.72);
   const dot=document.createElementNS(ns,'circle');dot.setAttribute('class','skin-light-particle');dot.setAttribute('cx',point.x);dot.setAttribute('cy',point.y);dot.setAttribute('r',.8+p);dot.setAttribute('fill',i%2?'#d6b1ff':'#b5f5ff');
   const dx=100-point.x,dy=100-point.y,distance=Math.max(1,Math.hypot(dx,dy));
   dot.style.setProperty('--particle-in-x',dx*.4+'px');dot.style.setProperty('--particle-in-y',dy*.4+'px');
   dot.style.setProperty('--particle-out-x',-dx/distance*12+'px');dot.style.setProperty('--particle-out-y',-dy/distance*12+'px');dot.style.animationDelay=-i*.23+'s';particles.append(dot);
  }
 }
 window.WakppuSkinEffects={hit,reset,syncCracks};
})();
