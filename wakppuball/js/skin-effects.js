// Cosmetic hit overlays only: never change damage, rewards, timers or inventory.
(() => {
 const animations=new WeakMap(),ns='http://www.w3.org/2000/svg';
 function reset(svg){(animations.get(svg)||[]).forEach(a=>a.cancel());animations.delete(svg);}
 function hit({ball,svg,progress}){
  reset(svg);
  const rank=ball.id==='eternity'?ball.design.skin:null;
  if(!['rare','hero','legendary','transcendent'].includes(rank))return;
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
  }else{
   layer.dataset.glowPhase=p>=.95?'inward':p>=.4?'pulse':'faint';
   layer.style.setProperty('--seam-strength',String(.2+p*.8));
   layer.style.setProperty('--seam-period',(1.9-p)+'s');
   const seam=Array.from({length:5},(_,i)=>{
    const d=`M100 100L${95-i%2*3} ${100-length*.28}L${104+i} ${100-length*.53}L${98-i%3*2} ${100-length*.78}L${102+i%2*4} ${100-length}M${104+i} ${100-length*.53}L${113+i} ${97-length*.61}`;
    const path=(stroke,width,opacity,cls='')=>`<path class="${cls}" d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" opacity="${opacity}" stroke-linecap="butt" stroke-linejoin="bevel"/>`;
    return `<g transform="rotate(${i*72} 100 100)">${path('#080b21',2.4+p*4,1)}<g class="skin-seam-light">${path('#ab74ff',1.9+p*3,.35)}${path('#6edfff',.8+p*1.3,.9)}${path('#f0f6ff',.25+p*.5,.95)}</g></g>`;
   }).join('');
   const count=p<.4?0:Math.min(6,Math.floor(p*7));
   const particles=Array.from({length:count},(_,i)=>`<g transform="rotate(${i*72+8} 100 100)"><circle class="skin-light-particle" cx="${99+i%3*3}" cy="${100-length*(.55+i%3*.12)}" r="${.8+p}" fill="${i%2?'#d6b1ff':'#b5f5ff'}" style="animation-delay:-${i*.23}s"/></g>`).join('');
   layer.innerHTML=`<g data-skin-seams="5">${seam}</g><g data-skin-light-particles="${count}">${particles}</g>`;
  }
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  if(rank==='transcendent')return; // CSS pulses only the light, never the dark shell.
  const frames=rank==='hero'?[{opacity:1,transform:'translateY(0px)'},{opacity:.25,transform:'translateY(-13px)'}]:rank==='legendary'?[{opacity:1,transform:'rotate(12deg)'},{opacity:.3,transform:'rotate(-18deg)'}]:[{opacity:.35},{opacity:1,offset:.35},{opacity:.7}];
  layer.style.transformOrigin='100px 100px';animations.set(svg,[layer.animate(frames,{duration:320,fill:'forwards'})]);
 }
 window.WakppuSkinEffects={hit,reset};
})();
