(() => {
  const timing=Object.freeze({charge:120,shatter:400,energy:480,complete:1320,reward:1380,respawn:1700});
  function play({wrap,svg,effects,center,radius,valid,shatter,reward,respawn,speed=1}){
    const timers=[],nodes=[],animations=[];let cancelled=false;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    function phase(name){wrap.dataset.whiteholePhase=name;wrap.dispatchEvent(new CustomEvent('whitehole-phase',{detail:name}));}
    function animate(el,frames,duration){const animation=el.animate(frames,{duration:duration/speed,easing:'ease-out',fill:'forwards'});animations.push(animation);}
    function element(className){const el=document.createElement('div');el.className=className;el.setAttribute('aria-hidden','true');el.style.left=center.x+'px';el.style.top=center.y+'px';effects.append(el);nodes.push(el);return el;}
    function at(time,run){timers.push(setTimeout(()=>{if(cancelled)return;if(!valid()){cancel();return;}run();},time/speed));}
    function cancel(){cancelled=true;timers.forEach(clearTimeout);animations.forEach(a=>a.cancel());nodes.forEach(el=>el.remove());wrap.classList.remove('whitehole-charging');svg.style.opacity='';delete wrap.dataset.whiteholePhase;}
    phase('crack');
    at(timing.charge,()=>{
      phase('charge');wrap.classList.add('whitehole-charging');
      const glow=element('whitehole-glow');glow.style.width=glow.style.height=radius*2.4+'px';
      animate(glow,[{opacity:0,transform:'translate(-50%,-50%) scale(.55)'},{opacity:reduced?.28:.85,offset:.45,transform:'translate(-50%,-50%) scale(1)'},{opacity:0,transform:'translate(-50%,-50%) scale(1.12)'}],1050);
    });
    at(timing.shatter,()=>{phase('shatter');wrap.classList.remove('whitehole-charging');shatter();});
    at(timing.energy,()=>{
      phase('energy');
      for(let i=0;i<(reduced?1:3);i++){
        const ring=element('whitehole-wave');ring.style.width=ring.style.height=radius*1.7+'px';
        animate(ring,[{opacity:0,transform:'translate(-50%,-50%) scale(.55)'},{opacity:reduced?.18:.7,offset:.15,transform:'translate(-50%,-50%) scale(.85)'},{opacity:0,transform:`translate(-50%,-50%) scale(${reduced?1:2.1+i*.3})`}],600+i*80);
      }
      for(let i=0;i<(reduced?6:32);i++){
        const angle=i/(reduced?6:32)*Math.PI*2,reach=radius*(1.4+Math.random()*.9);
        const particle=element('whitehole-particle');particle.style.background=i%3?'#e6faff':'#d5bbff';
        const x=Math.cos(angle)*reach,y=Math.sin(angle)*reach;
        animate(particle,[{opacity:0,transform:'translate(-50%,-50%) scale(.4)'},{opacity:.9,offset:.18,transform:`translate(calc(-50% + ${x*.25}px),calc(-50% + ${y*.25}px)) scale(1)`},{opacity:0,transform:`translate(calc(-50% + ${reduced?x*.3:x}px),calc(-50% + ${reduced?y*.3:y}px)) scale(.1)`}],600+Math.random()*160);
      }
    });
    at(timing.complete,()=>{phase('complete');svg.style.opacity='0';nodes.forEach(el=>el.remove());});
    at(timing.reward,()=>{phase('reward');reward();});
    at(timing.respawn,()=>{phase('respawn');respawn();});
    return {cancel};
  }
  window.WakppuWhitehole={play,timing};
})();
