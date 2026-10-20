/* Original blood-moon Jack-o-lantern artwork and occultation breakup; no eternity FX. */
(() => {
 let serial=0;
 function art(uid){
  const eyes='M43 88Q61 70 83 86L85 103Q65 99 43 88Z M115 103L117 86Q139 70 157 88Q135 99 115 103Z';
  const mouth='M44 117Q58 122 68 121L75 110L85 129L97 120L105 132L118 116L126 125L137 112L142 121L156 115Q148 140 132 147L125 137L119 154L104 159L94 145L86 156Q58 148 44 117Z';
  const face=eyes+' M95 105L100 95L105 105Z '+mouth;
  const ridges=[-57,-38,-19,0,19,38,57].map((x,i)=>`<path d="M100 23C${100+x*.72} 35 ${100+x*1.3} 60 ${100+x*1.2} 105Q${100+x*1.1} 155 100 180" fill="none" stroke="${i%2?'#e7b39b':'#060a13'}" stroke-opacity="${i%2?.09:.5}" stroke-width="${i%2?2.2:4}"/>`).join('');
  const grain=Array.from({length:28},(_,i)=>`<path d="M${31+i*37%137} ${37+i*47%129}l${1+i%3} ${1+i%2}" stroke="${i%3?'#ffd4a3':'#000'}" stroke-opacity=".13" stroke-width=".65"/>`).join('');
  const phases=Array.from({length:8},(_,i)=>{const a=i*Math.PI/4,x=100+73*Math.sin(a),y=100-73*Math.cos(a);return `<g transform="translate(${x} ${y}) rotate(${i*45})"><path d="M0-4L2.5 0L0 4L-2.5 0Z" fill="#b78960"/><path d="M-4-7H4M-4 7H4" stroke="#c69165" stroke-width=".6" opacity=".7"/></g>`;}).join('');
  return {defs:`
   <radialGradient id="${uid}-pumpkin-body" cx=".31" cy=".24" r=".83"><stop stop-color="#8a5966"/><stop offset=".32" stop-color="#392e43"/><stop offset=".66" stop-color="#1c1729"/><stop offset="1" stop-color="#070c16"/></radialGradient>
   <radialGradient id="${uid}-blood-light" cx=".48" cy=".85" r=".9"><stop stop-color="#ffc27b"/><stop offset=".23" stop-color="#e97739"/><stop offset=".55" stop-color="#a82b2d"/><stop offset="1" stop-color="#250f22"/></radialGradient>
   <linearGradient id="${uid}-copper" x2=".8" y2="1"><stop stop-color="#ffe1ad"/><stop offset=".22" stop-color="#c39269"/><stop offset=".5" stop-color="#4b3340"/><stop offset=".73" stop-color="#bc7e55"/><stop offset="1" stop-color="#6e3a36"/></linearGradient>
   <radialGradient id="${uid}-wax-glint"><stop stop-color="#f7ddd3" stop-opacity=".55"/><stop offset=".45" stop-color="#e4bac4" stop-opacity=".15"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
   <linearGradient id="${uid}-umbra"><stop stop-color="#040814" stop-opacity="0"/><stop offset=".52" stop-color="#040814" stop-opacity=".7"/><stop offset="1" stop-color="#040814" stop-opacity=".95"/></linearGradient>
   <clipPath id="${uid}-eclipse-body"><circle cx="100" cy="100" r="81"/></clipPath><clipPath id="${uid}-carved-face"><path d="${face}"/></clipPath>`,
  art:`<g data-pumpkin-skin="eclipse" data-wax-material="polished" data-eclipse-art="blood-moon">
   <circle cx="100" cy="100" r="82" fill="url(#${uid}-pumpkin-body)"/>
   <g clip-path="url(#${uid}-eclipse-body)">${ridges}${grain}<ellipse cx="66" cy="54" rx="39" ry="28" fill="url(#${uid}-wax-glint)" transform="rotate(-32 66 54)"/>
   <g class="eclipse-surface-shadow"><ellipse cx="148" cy="96" rx="65" ry="88" fill="url(#${uid}-umbra)"/></g></g>
   <circle cx="100" cy="100" r="79" fill="none" stroke="#b47666" stroke-opacity=".35" stroke-width="1"/>
   <g fill="none" stroke="url(#${uid}-copper)" stroke-width=".9"><path d="M34 77A71 71 0 0 1 76 33M124 33A71 71 0 0 1 166 77M166 123A71 71 0 0 1 124 167M76 167A71 71 0 0 1 34 123"/><path d="M39 75A66 66 0 0 1 73 39M127 39A66 66 0 0 1 161 75M161 125A66 66 0 0 1 127 161M73 161A66 66 0 0 1 39 125" stroke-opacity=".4"/></g>${phases}
   <g data-eclipse-crown><path d="M88 42Q82 26 105 18L119 27Q100 26 106 42" fill="#171825" stroke="url(#${uid}-copper)" stroke-width="1.4"/><path d="M92 34L101 24M104 34L111 28" stroke="#d2a17b" stroke-width=".8"/>
   <path d="M78 50L85 43L89 57L100 40L111 57L115 43L122 50L116 70L84 70Z" fill="#241b2d" stroke="url(#${uid}-copper)" stroke-width="1"/>
   <circle cx="100" cy="58" r="13.5" fill="#090e1a" stroke="#a74738" stroke-width="1.4"/><path d="M101 45A13 13 0 1 0 110 67A13 13 0 0 1 101 45Z" fill="url(#${uid}-copper)"/><circle cx="100" cy="58" r="16.5" fill="none" stroke="#cc8662" stroke-opacity=".5" stroke-width=".55"/></g>
   <path d="M42 81Q59 65 79 76M121 76Q141 65 158 81" fill="none" stroke="#ad7367" stroke-opacity=".45" stroke-width="2"/>
   <path d="${face}" transform="translate(0 1.8)" fill="none" stroke="#b08080" stroke-opacity=".55" stroke-width="2.8"/>
   <path d="${face}" fill="url(#${uid}-blood-light)" stroke="#100e1a" stroke-width="3.2" stroke-linejoin="round"/>
   <g clip-path="url(#${uid}-carved-face)"><g data-pumpkin-energy class="eclipse-furnace" opacity=".8"><path d="M52 155Q67 110 84 123Q85 109 93 101Q89 131 105 137Q110 107 125 99Q119 136 147 122V168Z" fill="#ffbf78" fill-opacity=".45"/><path d="M49 91Q65 80 82 89M118 89Q135 80 151 91" fill="none" stroke="#ffc088" stroke-width="1.7"/></g><path d="${face}" transform="translate(0 3)" fill="none" stroke="#2d0e1b" stroke-opacity=".8" stroke-width="3"/></g>
   <path d="M70 163Q100 183 130 163L120 169L113 165L100 177L87 165L80 169Z" fill="#211724" stroke="url(#${uid}-copper)" stroke-width=".8"/>
  </g>`};
 }
 function decorate({svg,reduced=false}){
  const old=svg.querySelector('[data-eclipse-halo]');if(old)old.remove();
  const g=document.createElementNS('http://www.w3.org/2000/svg','g');g.dataset.eclipseHalo='';g.setAttribute('pointer-events','none');g.setAttribute('class','eclipse-corona-idle');g.style.animation=reduced?'none':'';
  g.innerHTML='<g fill="none"><circle cx="100" cy="100" r="86" stroke="#9b433b" stroke-width=".8" opacity=".45"/><path d="M22 65Q8 49 24 38Q10 56 30 51M170 147Q191 154 183 170Q184 156 171 161M51 179Q41 193 29 183Q44 188 45 175M143 23Q159 7 170 23Q158 13 156 29" stroke="#ce6b4c" stroke-width=".8" opacity=".55"/><path d="M15 100A85 85 0 0 1 57 27M143 173A85 85 0 0 0 185 100" stroke="#e6b789" stroke-width="1" opacity=".65"/></g>';
  svg.insertBefore(g,svg.querySelector('.hit'));
 }
 function visual({svg,effects,center,radius=130,speed=1,reduced=false}){
  const nodes=[],animations=[],token='eclipserun'+(++serial)+'-';
  const animate=(n,frames,duration,delay=0)=>animations.push(n.animate(frames,{duration:duration/speed,delay:delay/speed,easing:'cubic-bezier(.2,.7,.2,1)',fill:'both'}));
  const spawn=(kind,size,markup)=>{const n=document.createElement('div');n.className='pumpkin-skin-fx '+kind;n.dataset.pumpkinEffect='eclipse';n.setAttribute('aria-hidden','true');Object.assign(n.style,{left:center.x+'px',top:center.y+'px',width:size+'px',height:size+'px'});n.innerHTML=markup;effects.append(n);nodes.push(n);return n;};
  svg.style.transformOrigin='50% 50%';
  if(reduced)animate(svg,[{opacity:1},{opacity:0}],250);
  else{
   // No spinning/shrinking orb: an umbra crosses the intact carved surface first.
   animate(svg,[{opacity:1,offset:0},{opacity:1,offset:.72},{opacity:0,offset:1}],580);
   const size=radius*2.35,clip=token+'shadow';
   const shadow=spawn('eclipse-umbra',size,`<svg viewBox="0 0 200 200"><defs><clipPath id="${clip}"><circle cx="100" cy="100" r="82"/></clipPath></defs><g clip-path="url(#${clip})"><circle data-umbra-disc cx="100" cy="100" r="94" fill="#040812"/></g></svg>`);
   const disc=shadow.querySelector?.('[data-umbra-disc]')||shadow;
   animate(disc,[{transform:'translateX(-188px)'},{transform:'translateX(0)'}],350);
   animate(shadow,[{opacity:1,offset:0},{opacity:1,offset:.55},{opacity:0,offset:1}],1080);
   const corona=spawn('eclipse-corona',size*1.06,'<svg viewBox="0 0 200 200"><g fill="none"><circle cx="100" cy="100" r="78" stroke="#ab352b" stroke-width="5" opacity=".3"/><circle cx="100" cy="100" r="78" stroke="#df7243" stroke-width="1.5"/><path d="M26 75A78 78 0 0 1 106 22M174 125A78 78 0 0 1 94 178" stroke="#ffe0a5" stroke-width="2.2"/><path d="M24 75Q8 61 22 46Q16 62 31 59M176 125Q195 133 180 153Q188 137 170 140" stroke="#d9673c" stroke-width="1"/></g></svg>');
   animate(corona,[{opacity:0,offset:0,transform:'translate(-50%,-50%)'},{opacity:1,offset:.21,transform:'translate(-50%,-50%)'},{opacity:.9,offset:.55,transform:'translate(-50%,-50%)'},{opacity:0,offset:1,transform:'translate(-50%,-50%)'}],1000,240);
   const compact=matchMedia('(max-width: 600px), (max-height: 500px)').matches,count=compact?6:10;
   // Break the actual skin into clipped sectors, rather than unrelated generic polygons.
   const raw=(svg.querySelector?.('defs')?.outerHTML||'')+(svg.querySelector?.('[data-eclipse-art]')?.outerHTML||'<circle cx="100" cy="100" r="82" fill="#342235"/>');
   for(let i=0;i<count;i++){
    const a=(i/count)*Math.PI*2-.2,b=((i+1)/count)*Math.PI*2-.2,mid=(a+b)/2;
    const x=100+Math.cos(a)*130,y=100+Math.sin(a)*130,x2=100+Math.cos(b)*130,y2=100+Math.sin(b)*130;
    const sector=token+i+'-sector',prefix=token+i+'-';
    const snapshot=raw.replace(/(id="|url\(#)([^"\)]+)(?="|\))/g,(_,head,id)=>head+prefix+id);
    const n=spawn('eclipse-shell-sector',size,`<svg viewBox="0 0 200 200"><defs><clipPath id="${sector}"><path d="M100 100L${x} ${y}A130 130 0 0 1 ${x2} ${y2}Z"/></clipPath></defs><g clip-path="url(#${sector})">${snapshot}</g></svg>`);
    n.dataset.eclipseSector=String(i);
    const dx=Math.cos(mid)*radius*.63,dy=Math.sin(mid)*radius*.6+radius*.25;
    animate(n,[{opacity:0,offset:0,transform:'translate(-50%,-50%)'},{opacity:1,offset:.04,transform:'translate(-50%,-50%)'},{opacity:.85,offset:.45,transform:`translate(calc(-50% + ${dx*.5}px),calc(-50% + ${dy*.3}px)) rotate(${i%2?6:-6}deg)`},{opacity:0,offset:1,transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) rotate(${i%2?15:-15}deg)`}],700,430+i%3*15);
   }
   const ash=spawn('eclipse-embers',size*1.3,`<svg viewBox="0 0 200 200">${Array.from({length:compact?6:10},(_,i)=>`<path d="M${35+i*37%128} ${43+i*29%121}l${i%2?3:-3} -5" stroke="${i%3?'#c66544':'#f5c389'}" stroke-width="1.1" stroke-linecap="round"/>`).join('')}</svg>`);
   animate(ash,[{opacity:0,transform:'translate(-50%,-45%)'},{opacity:.8,offset:.15,transform:'translate(-50%,-50%)'},{opacity:0,transform:'translate(-50%,-70%)'}],720,450);
  }
  let stopped=false;return {cancel(){if(stopped)return;stopped=true;animations.forEach(a=>a.cancel());nodes.forEach(n=>n.remove());svg.style.opacity='';}};
 }
 window.WakppuEclipsePumpkin={art,decorate,visual};
})();
