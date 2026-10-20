// Cosmetic candidate assets. No ownership, inventory, price or server writes here.
(() => {
 const ballId='halloween-pumpkin-2026';
 const profiles=[
  {id:'wisp',name:'푸른 도깨비불',rank:'희귀',price:50,colors:['#b5eee0','#257d83','#092d43'],accent:'#a2faff',description:'차가운 도깨비불 · 푸른 불씨가 퍼지며 소멸',sounds:['pumpkin/tap-2','eternity/rare-mid','eternity/rare-late','eternity/rare-final']},
  {id:'ghost',name:'유령의 잭오랜턴',rank:'영웅',price:100,colors:['#fff3e1','#b0a6be','#48415f'],accent:'#e2e1ff',description:'호박 안에 숨어 있는 유령 · 형체가 빠져나오는 파괴',sounds:['pumpkin/tap-1','eternity/transcendent-early','eternity/legendary-mid','eternity/transcendent-final']},
  {id:'eclipse',name:'월식의 잭오랜턴',rank:'전설',price:200,colors:['#c47b86','#54233e','#141323'],accent:'#f1bc85',description:'흑자주 왁스와 금빛 월식 문양 · 수축 후 달의 고리로 파열',sounds:['eternity/hero-early','eternity/legendary-mid','eternity/transcendent-late','eternity/legendary-final']}
 ];
 const profile=id=>profiles.find(p=>p.id===id),ghostPath='M72 131V91C72 54 128 54 128 91V137L115 124L102 139L89 125L72 139Z';
 const flame='M100 35C111 63 137 76 131 107C127 128 111 144 100 162C89 144 72 127 69 108C64 88 76 74 84 64C80 82 91 89 94 75C100 62 101 48 100 35Z';
 const hits=new WeakMap(),seams=new WeakMap();
 const tiers={wisp:{compact:6,full:10,tips:2},ghost:{compact:8,full:14,tips:3},eclipse:{compact:10,full:18,tips:4}};
 function appearance(ball,id){const p=profile(id);if(ball.id!==ballId||!p)return ball;const [light,mid,dark]=p.colors;return {...ball,skinId:'pumpkin_'+id,sound:{...ball.sound,early:[p.sounds[0]],mid:[p.sounds[1]],late:[p.sounds[2]],final:[p.sounds[3]],pitch:id==='ghost'?.86:1,pitchRandom:.015,volume:.62,volumeRandom:.02},design:{...ball.design,art:'pumpkinSkin',pumpkinSkin:id,gloss:true,colors:{light,mid,dark},crack:{dark:'#0b111f',light:p.accent},chip:p.colors}};}
 function art(uid,ball){return window.WakppuPumpkinSkinArt.render(uid,ball,profile(ball.design.pumpkinSkin));}
 function syncCracks({ball,svg,cracks,progress,reduced=false}){
  const p=profile(ball.design.pumpkinSkin);if(!p||p.id==='wisp')return;
  let run=seams.get(svg);
  if(!run||run.cracks!==cracks){
   run?.group.remove();const group=document.createElementNS('http://www.w3.org/2000/svg','g');group.setAttribute('class','pumpkin-seams pumpkin-seams-'+p.id);group.setAttribute('pointer-events','none');group.dataset.pumpkinSeams=p.id;
   const paths=[];
   for(const cr of cracks.filter(c=>c.weight===1)){
    const add=(color,scale)=>{const n=document.createElementNS('http://www.w3.org/2000/svg','path');for(const [k,v]of Object.entries({d:cr.d,class:'crack',fill:'none',stroke:color,'stroke-linecap':'round','stroke-linejoin':'round',pathLength:'1','stroke-dasharray':'1 1'}))n.setAttribute(k,v);n.dataset.pumpkinSeam=p.id;group.append(n);paths.push({cr,n,scale});};
    if(p.id==='ghost')add('#d8cbff',1.7);
    else{add('#d86e43',1.5);add('#ffe6ab',.28);}
   }
   svg.querySelector('[id$="-cracks"]')?.append(group);run={cracks,group,paths};seams.set(svg,run);
  }
  const onset=p.id==='ghost'?.25:.5,energy=Math.max(0,(progress-onset)/(1-onset));
  run.group.style.opacity=String(energy*(p.id==='ghost'?.2:.55));run.group.style.animation=reduced?'none':'';
  for(const {cr,n,scale}of run.paths){n.style.strokeDashoffset=String(1-cr.frac);n.style.strokeWidth=String((.8+progress*1.9)*scale);n.style.visibility=cr.frac>.001?'visible':'hidden';}
 }
 function reset(svg){const run=hits.get(svg);run?.animations.forEach(a=>a.cancel());run?.node.remove();hits.delete(svg);}
 function hit({ball,svg,cracks=[],progress,reduced=false}){
  reset(svg);const p=profile(ball.design.pumpkinSkin);if(!p)return;
  const energy=svg.querySelector('[data-pumpkin-energy]');if(energy)energy.style.opacity=String(.35+Math.min(1,Math.max(0,progress))*.65);
  const node=document.createElementNS('http://www.w3.org/2000/svg','g');node.dataset.pumpkinImpact=p.id;node.setAttribute('pointer-events','none');
  // Small accents originate at real growing crack tips, never at a second invented crack.
  const tips=reduced?[]:cracks.filter(c=>c.frac>.001&&c.frac<1).slice(0,tiers[p.id].tips);
  node.innerHTML=tips.map(cr=>{const point=cr.dark.getPointAtLength(cr.dark.getTotalLength()*cr.frac),x=point.x,y=point.y;
   if(p.id==='wisp')return `<circle data-crack-tip cx="${x}" cy="${y}" r="1.6" fill="#baffef"/>`;
   if(p.id==='ghost')return `<path data-crack-tip d="M${x-2} ${y+4}Q${x-6} ${y-3} ${x+1} ${y-10}Q${x-1} ${y-3} ${x+3} ${y-2}Q${x+5} ${y+2} ${x-2} ${y+4}Z" fill="#e8dfff" fill-opacity=".7"/>`;
   return `<path data-crack-tip d="M${x} ${y-4}L${x+1.4} ${y-1}L${x+4} ${y}L${x+1.4} ${y+1}L${x} ${y+4}L${x-1.4} ${y+1}L${x-4} ${y}L${x-1.4} ${y-1}Z" fill="#ffe6ab"/>`;
  }).join('');
  svg.querySelector('[id$="-inner"]')?.append(node);const animations=[];
  if(!reduced){
   animations.push(node.animate([{opacity:.55,transform:'translateY(0)'},{opacity:0,transform:p.id==='ghost'?'translateY(-12px)':'translateY(-5px)'}],{duration:320,fill:'forwards'}));
   svg.style.transformOrigin='50% 50%';animations.push(svg.animate([{transform:'scale(1)'},{transform:'scale(1.018,.965)',offset:.3},{transform:'scale(1)'}],{duration:210,easing:'ease-out'}));
  }else node.setAttribute('opacity','.25');
  hits.set(svg,{node,animations});
 }
 function visual({ball,svg,effects,center,radius=130,speed=1,reduced=false}){
  const p=profile(ball.design.pumpkinSkin);if(!p)return null;reset(svg);
  const nodes=[],animations=[];const animate=(el,frames,duration,delay=0)=>{animations.push(el.animate(frames,{duration:duration/speed,delay:delay/speed,easing:'ease-out',fill:'both'}));};
  const spawn=(kind,size,markup)=>{const n=document.createElement('div');n.className='pumpkin-skin-fx '+kind;n.dataset.pumpkinEffect=p.id;n.setAttribute('aria-hidden','true');n.innerHTML=markup;Object.assign(n.style,{left:center.x+'px',top:center.y+'px',width:size+'px',height:size+'px'});effects.append(n);nodes.push(n);return n;};
  animate(svg,reduced?[{opacity:1},{opacity:0}]:p.id==='eclipse'?[{transform:'scale(1)',opacity:1},{transform:'scale(.55) rotate(-14deg)',opacity:.8,offset:.35},{transform:'scale(1.08)',opacity:0}]:[{transform:'scale(1)',opacity:1},{transform:p.id==='ghost'?'scale(.96)':'scale(1.12)',opacity:0}],reduced?250:p.id==='eclipse'?650:400);
  const compact=matchMedia('(max-width: 600px), (max-height: 500px)').matches,count=reduced?0:tiers[p.id][compact?'compact':'full'];
  for(let i=0;i<count;i++){
   const theta=i/count*Math.PI*2,reach=radius*(.7+(i%3)*.15),x=Math.cos(theta)*reach,y=Math.sin(theta)*reach;
   const shape=p.id==='wisp'?`<path d="${flame}" fill="${p.colors[i%3]}"/>`:p.id==='ghost'?`<path d="${ghostPath}" fill="${p.accent}" opacity=".75"/><circle cx="89" cy="88" r="5" fill="#515b86"/><circle cx="111" cy="88" r="5" fill="#515b86"/>`:`<path d="M38 49Q88 17 146 42L161 103L121 167Q85 133 51 119Z" fill="${p.colors[i%3]}" stroke="#e6b66b" stroke-width="3"/><path d="M61 51Q103 37 137 52L147 96" fill="none" stroke="#ffe6b1" stroke-opacity=".55" stroke-width="3"/>`;
   const n=spawn('fragment',p.id==='ghost'?40:30,`<svg viewBox="0 0 200 200">${shape}</svg>`);
   const frames=[{opacity:0,transform:'translate(-50%,-50%) scale(.3)'},{opacity:.9,offset:.2,transform:`translate(calc(-50% + ${x*.35}px),calc(-50% + ${y*.35}px)) scale(1)`},{opacity:0,transform:`translate(calc(-50% + ${x}px),calc(-50% + ${p.id==='wisp'?y-radius*.45:p.id==='ghost'?-radius*.9:y}px)) rotate(${p.id==='eclipse'?i*37:0}deg) scale(${p.id==='ghost'?.6:.15})`}];
   animate(n,frames,p.id==='ghost'?1100:1000,p.id==='eclipse'?180:0);
  }
  if(!reduced&&p.id==='ghost'){
   const n=spawn('escaping-spirit',radius,`<svg viewBox="0 0 200 200"><path d="${ghostPath}" fill="#ececff"/><ellipse cx="89" cy="88" rx="5" ry="8" fill="#525d86"/><ellipse cx="111" cy="88" rx="5" ry="8" fill="#525d86"/><ellipse cx="100" cy="110" rx="5" ry="8" fill="#6973a1"/></svg>`);animate(n,[{opacity:0,transform:'translate(-50%,-30%) scale(.4)'},{opacity:.9,offset:.25,transform:'translate(-50%,-65%) scale(1)'},{opacity:0,transform:`translate(-50%,calc(-50% - ${radius}px)) scale(1.1)`}],1200);
  }
  if(!reduced&&p.id==='eclipse'){
   const moon=spawn('eclipsed-moon',radius*1.3,'<svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="70" fill="#1c1028"/><path d="M112 32A70 70 0 1 0 157 142A65 65 0 0 1 112 32Z" fill="#d8a767" opacity=".8"/></svg>');animate(moon,[{opacity:0,transform:'translate(-50%,-50%) scale(.35)'},{opacity:.8,offset:.4,transform:'translate(-50%,-50%) scale(1)'},{opacity:0,transform:'translate(-50%,-50%) scale(1.1)'}],1000,100);
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
 window.WakppuPumpkinSkins={ballId,profiles,tiers,profile,appearance,art,syncCracks,hit,reset,visual,play};
})();
