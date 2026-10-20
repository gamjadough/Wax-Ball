// Cosmetic candidate assets. No ownership, inventory, price or server writes here.
(() => {
 const ballId='halloween-pumpkin-2026';
 const profiles=[
  {id:'wisp',name:'푸른 도깨비불',rank:'희귀',price:50,colors:['#61eeff','#176e95','#10213e'],accent:'#a2faff',description:'차가운 도깨비불 · 푸른 불씨가 퍼지며 소멸',sounds:['pumpkin/tap-2','eternity/rare-mid','eternity/rare-late','eternity/rare-final']},
  {id:'ghost',name:'유령의 잭오랜턴',rank:'영웅',price:100,colors:['#e0deff','#9295c2','#353650'],accent:'#e2e1ff',description:'호박 안에 숨어 있는 유령 · 형체가 빠져나오는 파괴',sounds:['pumpkin/tap-1','eternity/transcendent-early','eternity/legendary-mid','eternity/transcendent-final']},
  {id:'eclipse',name:'월식의 잭오랜턴',rank:'전설',price:200,colors:['#ed8472','#772c44','#1a1025'],accent:'#ff9b87',description:'붉은 달과 그림자 의식 · 수축 후 월식 고리로 파열',sounds:['eternity/hero-early','eternity/legendary-mid','eternity/transcendent-late','eternity/legendary-final']}
 ];
 const profile=id=>profiles.find(p=>p.id===id),ghostPath='M72 131V91C72 54 128 54 128 91V137L115 124L102 139L89 125L72 139Z';
 const gourd='M100 43C64 23 29 49 22 95C12 140 40 179 76 178Q100 190 124 178C160 181 187 142 178 98C174 51 138 25 100 43Z';
 const flame='M100 35C111 63 137 76 131 107C127 128 111 144 100 162C89 144 72 127 69 108C64 88 76 74 84 64C80 82 91 89 94 75C100 62 101 48 100 35Z';
 const hits=new WeakMap();
 function appearance(ball,id){const p=profile(id);if(ball.id!==ballId||!p)return ball;const [light,mid,dark]=p.colors;return {...ball,skinId:'pumpkin_'+id,sound:{...ball.sound,early:[p.sounds[0]],mid:[p.sounds[1]],late:[p.sounds[2]],final:[p.sounds[3]],pitch:id==='ghost'?.86:1,pitchRandom:.015,volume:.62,volumeRandom:.02},design:{...ball.design,art:'pumpkinSkin',pumpkinSkin:id,gloss:false,colors:{light,mid,dark},crack:{dark:'#0b111f',light:p.accent},chip:p.colors}};}
 function art(uid,ball){
  const p=profile(ball.design.pumpkinSkin);if(!p)return {defs:'',art:''};const [light,mid,dark]=p.colors;
  const ribs=[67,85,115,133].map(x=>`<path d="M100 44Q${x} 65 ${x} 119Q${x} 151 100 181"/>`).join('');
  const face='<path d="M49 93L79 76L83 103L63 99Z M117 103L121 76L151 93L137 100Z M51 124L68 128L78 117L91 134L100 124L111 135L123 118L132 129L149 123Q141 156 101 157Q68 156 51 124Z"/>';
  const details={
   wisp:`<g data-pumpkin-energy class="pumpkin-wisp-flame" fill="url(#${uid}-fire)" opacity=".78"><path d="${flame}" transform="translate(14 18) scale(.55)"/><path d="${flame}" transform="translate(76 18) scale(.55)"/><path d="${flame}" transform="translate(50 91) scale(.5 .35)"/></g><g class="pumpkin-wisp-orbit" fill="${light}"><path d="M43 69Q25 51 42 36Q34 54 47 51Q55 59 43 69Z"/><path d="M151 153Q164 130 178 147Q165 138 164 153Q158 166 151 153Z"/></g>`,
   ghost:`<g data-pumpkin-energy class="pumpkin-ghost-spirit" opacity=".7"><path d="${ghostPath}" fill="url(#${uid}-spirit)" stroke="#fff" stroke-opacity=".45"/><ellipse cx="89" cy="88" rx="5" ry="8" fill="#3e4269"/><ellipse cx="110" cy="88" rx="5" ry="8" fill="#3e4269"/><ellipse cx="100" cy="110" rx="6" ry="9" fill="#62658c"/></g><g fill="none" stroke="#ecedff" stroke-opacity=".38"><path d="M38 113Q24 77 57 58 M160 116Q178 76 146 57 M63 164Q100 178 139 162" stroke-width="2"/></g>`,
   eclipse:`<g class="pumpkin-eclipse-moon" opacity=".7"><circle cx="100" cy="78" r="43" fill="#fc8b77"/><circle cx="113" cy="65" r="40" fill="#33132d"/></g><g data-pumpkin-energy class="pumpkin-eclipse-seal" fill="none" stroke="${light}" opacity=".65"><circle cx="100" cy="105" r="68" stroke-width="1.5" stroke-dasharray="2 8"/><path d="M100 32L105 43L100 51L95 43Z M100 157L106 167L100 176L94 167Z M27 105L38 100L46 105L38 110Z M154 105L164 100L175 105L164 110Z"/></g><path d="M66 134L76 144L80 131 M119 132L124 144L134 134" fill="#fff1df"/>`
  };
  return {defs:`<radialGradient id="${uid}-pumpkin-body" cx=".35" cy=".3" r=".75"><stop stop-color="${light}"/><stop offset=".5" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/></radialGradient><linearGradient id="${uid}-fire" x2="0" y2="1"><stop stop-color="#e8ffff"/><stop offset=".4" stop-color="#79f6ff"/><stop offset="1" stop-color="#3479e0"/></linearGradient><linearGradient id="${uid}-spirit" x2="0" y2="1"><stop stop-color="#fff"/><stop offset=".6" stop-color="#d4dcff"/><stop offset="1" stop-color="#a8a7ec" stop-opacity=".2"/></linearGradient>`,
   art:`<g data-pumpkin-skin="${p.id}"><path d="${gourd}" fill="url(#${uid}-pumpkin-body)" stroke="${p.accent}" stroke-opacity=".65" stroke-width="1.2"/><g fill="none" stroke="${dark}" stroke-opacity=".45" stroke-width="2">${ribs}</g><path d="M90 45Q85 29 109 20L119 29Q100 29 105 45" fill="${p.id==='wisp'?'#8ce9c8':p.id==='ghost'?'#565e8d':'#39283c'}" stroke="${p.accent}" stroke-opacity=".45"/><g fill="${p.id==='ghost'?'#5c6089':'#071328'}" stroke="${p.accent}" stroke-width="1.5">${face}</g>${details[p.id]}<path d="M39 108Q34 63 74 51" fill="none" stroke="${p.accent}" stroke-opacity=".3" stroke-width="3"/></g>`};
 }
 function reset(svg){const run=hits.get(svg);run?.animations.forEach(a=>a.cancel());run?.node.remove();hits.delete(svg);}
 function hit({ball,svg,progress,reduced=false}){
  reset(svg);const p=profile(ball.design.pumpkinSkin);if(!p)return;
  const energy=svg.querySelector('[data-pumpkin-energy]');if(energy)energy.style.opacity=String(.35+Math.min(1,Math.max(0,progress))*.65);
  const node=document.createElementNS('http://www.w3.org/2000/svg','g');node.dataset.pumpkinImpact=p.id;node.setAttribute('pointer-events','none');
  node.innerHTML=p.id==='wisp'?'<path d="M55 117Q42 93 57 82Q49 99 65 103Z M140 115Q158 95 148 82Q146 100 135 105Z" fill="#a4faff"/>':p.id==='ghost'?'<ellipse cx="100" cy="114" rx="50" ry="31" fill="none" stroke="#e1e0ff" stroke-width="2"/>':'<circle cx="100" cy="105" r="72" fill="none" stroke="#ff9a81" stroke-width="2" stroke-dasharray="6 12"/>';
  svg.querySelector('[id$="-inner"]')?.append(node);const animations=[];
  if(!reduced)animations.push(node.animate([{opacity:.8,transform:'translateY(0)'},{opacity:0,transform:p.id==='ghost'?'translateY(-12px)':'translateY(-5px)'}],{duration:320,fill:'forwards'}));else node.setAttribute('opacity','.35');
  hits.set(svg,{node,animations});
 }
 function visual({ball,svg,effects,center,radius=130,speed=1,reduced=false}){
  const p=profile(ball.design.pumpkinSkin);if(!p)return null;reset(svg);
  const nodes=[],animations=[];const animate=(el,frames,duration,delay=0)=>{animations.push(el.animate(frames,{duration:duration/speed,delay:delay/speed,easing:'ease-out',fill:'both'}));};
  const spawn=(kind,size,markup)=>{const n=document.createElement('div');n.className='pumpkin-skin-fx '+kind;n.dataset.pumpkinEffect=p.id;n.setAttribute('aria-hidden','true');n.innerHTML=markup;Object.assign(n.style,{left:center.x+'px',top:center.y+'px',width:size+'px',height:size+'px'});effects.append(n);nodes.push(n);return n;};
  animate(svg,reduced?[{opacity:1},{opacity:0}]:p.id==='eclipse'?[{transform:'scale(1)',opacity:1},{transform:'scale(.55) rotate(-14deg)',opacity:.8,offset:.35},{transform:'scale(1.08)',opacity:0}]:[{transform:'scale(1)',opacity:1},{transform:p.id==='ghost'?'scale(.96)':'scale(1.12)',opacity:0}],reduced?250:p.id==='eclipse'?650:400);
  const compact=matchMedia('(max-width: 600px), (max-height: 500px)').matches,count=reduced?0:compact?8:16;
  for(let i=0;i<count;i++){
   const theta=i/count*Math.PI*2,reach=radius*(.7+(i%3)*.15),x=Math.cos(theta)*reach,y=Math.sin(theta)*reach;
   const shape=p.id==='wisp'?`<path d="${flame}" fill="${p.colors[i%3]}"/>`:p.id==='ghost'?`<path d="${ghostPath}" fill="${p.accent}" opacity=".75"/><circle cx="89" cy="88" r="5" fill="#515b86"/><circle cx="111" cy="88" r="5" fill="#515b86"/>`:`<path d="M100 17L151 77L130 157L78 176L45 98Z" fill="${p.colors[i%3]}" stroke="${p.accent}" stroke-width="4"/>`;
   const n=spawn('fragment',p.id==='ghost'?40:30,`<svg viewBox="0 0 200 200">${shape}</svg>`);
   const frames=[{opacity:0,transform:'translate(-50%,-50%) scale(.3)'},{opacity:.9,offset:.2,transform:`translate(calc(-50% + ${x*.35}px),calc(-50% + ${y*.35}px)) scale(1)`},{opacity:0,transform:`translate(calc(-50% + ${x}px),calc(-50% + ${p.id==='wisp'?y-radius*.45:p.id==='ghost'?-radius*.9:y}px)) rotate(${p.id==='eclipse'?i*37:0}deg) scale(${p.id==='ghost'?.6:.15})`}];
   animate(n,frames,p.id==='ghost'?1100:1000,p.id==='eclipse'?180:0);
  }
  if(!reduced&&p.id==='ghost'){
   const n=spawn('escaping-spirit',radius,`<svg viewBox="0 0 200 200"><path d="${ghostPath}" fill="#ececff"/><ellipse cx="89" cy="88" rx="5" ry="8" fill="#525d86"/><ellipse cx="111" cy="88" rx="5" ry="8" fill="#525d86"/><ellipse cx="100" cy="110" rx="5" ry="8" fill="#6973a1"/></svg>`);animate(n,[{opacity:0,transform:'translate(-50%,-30%) scale(.4)'},{opacity:.9,offset:.25,transform:'translate(-50%,-65%) scale(1)'},{opacity:0,transform:`translate(-50%,calc(-50% - ${radius}px)) scale(1.1)`}],1200);
  }
  if(!reduced&&p.id==='eclipse'){
   const n=spawn('eclipse-ring',radius*1.8,'<svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="74" fill="#1a0e26" fill-opacity=".35" stroke="#e78a77" stroke-width="2"/><circle cx="100" cy="100" r="65" fill="none" stroke="#d75058" stroke-width="4" stroke-dasharray="2 9"/></svg>');animate(n,[{opacity:0,transform:'translate(-50%,-50%) scale(.3) rotate(20deg)'},{opacity:.75,offset:.35,transform:'translate(-50%,-50%) scale(1) rotate(-20deg)'},{opacity:0,transform:'translate(-50%,-50%) scale(1.35) rotate(-55deg)'}],1100,100);
  }
  let stopped=false;return {cancel(){if(stopped)return;stopped=true;animations.forEach(a=>a.cancel());nodes.forEach(n=>n.remove());svg.style.opacity='';}};
 }
 // Preview scheduler mirrors the live pumpkin reward/respawn deadlines, without grants or scares.
 function play(options){const {valid,reward,respawn,speed=1,respawnSpeed=1,reduced=false}=options;const effect=visual(options),timers=[];let stopped=false,paid=false;
  function cancel(){if(stopped)return;stopped=true;timers.forEach(clearTimeout);effect?.cancel();}
  function at(ms,fn){timers.push(setTimeout(()=>{if(stopped)return;if(!valid()){cancel();return;}fn();},ms));}
  at((reduced?250:450)/speed,()=>{if(!paid){paid=true;reward();}});at((reduced?550:1300)/speed+1000/respawnSpeed,()=>{cancel();respawn();});return {cancel};
 }
 window.WakppuPumpkinSkins={ballId,profiles,profile,appearance,art,hit,reset,visual,play};
})();
