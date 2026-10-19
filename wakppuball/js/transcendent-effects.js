(() => {
  const profiles={
    glow:{kind:'rays',colors:['#fff9db','#dcefff'],duration:1450},
    fire:{kind:'flames',colors:['#ff532f','#a70d29'],duration:1550},
    cloud:{kind:'clouds',colors:['#fff','#cfe8ff'],duration:1750},
    ember:{kind:'embers',colors:['#ff7837','#761827'],duration:1500},
    gem:{kind:'crystals',colors:['#fff4bb','#b9f5ff'],duration:1650},
    core:{kind:'core',colors:['#ff313c','#7c1738'],duration:1700},
    split:{kind:'halves',colors:['#f5edff','#251932'],duration:1650},
    orbit:{kind:'spiral',colors:['#fff3d5','#8676bb'],duration:1800},
    soul:{kind:'souls',colors:['#cbd4ea','#f7f4ff'],duration:1850},
    eternity:{kind:'convergence',colors:['#fff1c9','#ea9aa5','#bedfff','#c4aaff'],duration:2100}
  };
  const skinProfiles={
    rare:{kind:'ice',colors:['#d9ffff','#69d9f1','#419ccc'],duration:2100},
    hero:{kind:'flames',colors:['#ff9b32','#ffe8a3','#e74827'],duration:2100},
    legendary:{kind:'time',colors:['#ffe6a0','#c1954b'],duration:2100},
    transcendent:{kind:'void',colors:['#c4a2ff','#8ae9ff','#e5d5ff'],duration:2100}
  };
  function play({ball,wrap,svg,effects,center,radius,valid,reward,respawn,speed=1,respawnSpeed=1}){
    const profile=(ball.id==='eternity'&&skinProfiles[ball.design.skin])||profiles[ball.design.motif],reduced=window.WakppuSettings?.reduced()??matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timers=[],nodes=[],animations=[];let stopped=false,paid=false;
    const duration=(reduced?650:profile.duration)/speed;
    const phase=name=>{wrap.dataset.transcendentPhase=name;wrap.dispatchEvent(new CustomEvent('transcendent-phase',{detail:{id:ball.id,phase:name,kind:profile.kind}}));};
    function cancel(){if(stopped)return;stopped=true;timers.forEach(clearTimeout);animations.forEach(a=>a.cancel());nodes.forEach(n=>n.remove());delete wrap.dataset.transcendentPhase;svg.style.opacity='';}
    function at(ms,fn){timers.push(setTimeout(()=>{if(stopped)return;if(!valid()){cancel();return;}fn();},ms));}
    function animate(el,frames,ms,delay=0){const a=el.animate(frames,{duration:ms,delay,easing:'cubic-bezier(.15,.6,.25,1)',fill:'both'});animations.push(a);return a;}
    function node(type,color,size){
      const n=document.createElement('div');n.className='transcendent-fx '+type;n.dataset.kind=profile.kind;n.setAttribute('aria-hidden','true');
      Object.assign(n.style,{left:center.x+'px',top:center.y+'px',width:size+'px',height:size+'px',color,backgroundColor:color});
      effects.append(n);nodes.push(n);return n;
    }
    phase('charge');
    const contraction=['core','embers','convergence','void'].includes(profile.kind);
    const charge=animate(svg,reduced?[{opacity:1},{opacity:.5}]:[{transform:'scale(1)',opacity:1},{transform:profile.kind==='void'?'scale(.18) rotate(100deg)':contraction?'scale(.68)':'scale(1.08)',opacity:.8}],duration*.26);
    if(!reduced&&profile.kind==='time'){at(duration*.36,()=>phase('freeze'));at(duration*.55,()=>phase('rewind'));}
    if(!reduced&&profile.kind==='void')at(duration*.12,()=>phase('fold'));
    at(duration*.26,()=>{
      window.WakppuPurchaseEffects?.shatter({speed});
      phase('release');charge.cancel();svg.style.opacity='0';
      if(profile.kind==='halves'&&!reduced){
        for(let side=0;side<2;side++){
          const n=node('wax-half',profile.colors[side],radius*2);n.style.clipPath=side?'inset(0 0 0 50%)':'inset(0 50% 0 0)';
          animate(n,[{opacity:.9,transform:'translate(-50%,-50%) rotate(0deg)'},{opacity:0,transform:'translate(calc(-50% + '+(side?radius:-radius)+'px),-35%) rotate('+(side?45:-45)+'deg)'}],duration*.65);
        }
      }
      const skin=ball.id==='eternity'&&!!skinProfiles[ball.design.skin];
      const count=reduced?5:skin?(matchMedia('(max-width: 600px)').matches?16:24):profile.kind==='convergence'?36:profile.kind==='clouds'?12:24;
      for(let i=0;i<count;i++){
        const angle=i/count*Math.PI*2,kind=profile.kind;
        const type=kind==='ice'?'crystal':kind==='time'?'ray':kind==='void'?'star':kind==='convergence'?['cloud','crystal','ember','ray'][i%4]:kind==='souls'?'wisp':kind==='flames'?'flame':kind==='clouds'?'cloud':kind==='crystals'?'crystal':kind==='rays'?'ray':['embers','core'].includes(kind)?'ember':'mote';
        const size=reduced?8:type==='flame'?30:type==='wisp'?18:type==='cloud'?radius*.45:type==='ray'?radius*.32:type==='crystal'?20:type==='ember'?8:6;
        const n=node(type,profile.colors[i%profile.colors.length],size);
        const reach=radius*(reduced?.45:1.1+(i%4)*.17);
        const spiral=['spiral','souls','convergence'].includes(kind);
        let x=Math.cos(angle)*reach,y=Math.sin(angle)*reach;
        if(kind==='flames'){x=Math.cos(angle)*reach*.55;y=-reach*(.8+i/count);}
        if(kind==='embers'){x=Math.cos(angle)*reach;y=Math.sin(angle)*reach-radius*.3;}
        if(kind==='clouds'){x=Math.cos(angle)*reach;y=-radius*.3-Math.abs(Math.sin(angle))*reach*.6;}
        const frame=(scale,dx,dy,opacity,rotation)=>({opacity,transform:'translate(calc(-50% + '+dx+'px),calc(-50% + '+dy+'px)) rotate('+rotation+'deg) scale('+scale+')'});
        const frames=[frame(.25,0,0,0,0),{...frame(1,x*.3,y*.3,.8,i*15),offset:.2}];
        if(spiral)frames.push({...frame(1,Math.cos(angle+1.5)*reach*.7,Math.sin(angle+1.5)*reach*.7,.55,i*25),offset:.65});
        frames.push(frame(type==='cloud'?1.8:.1,x,y,0,i*35));
        if(!reduced&&kind==='ice'){
          frames.splice(0,frames.length,frame(.8,Math.cos(angle)*radius*.55,Math.sin(angle)*radius*.55,.9,0),frame(.5,x,y+radius*.6,0,i*40));
        }
        if(!reduced&&kind==='time'){
          frames.splice(0,frames.length,frame(.4,0,0,.9,0),{...frame(1,x*.7,y*.7,.9,30),offset:.15},{...frame(1,x*.7,y*.7,.9,30),offset:.45},{...frame(.7,Math.cos(angle-1.8)*reach*.3,Math.sin(angle-1.8)*reach*.3,.75,-120),offset:.75},frame(.1,0,0,0,-200));
        }
        if(!reduced&&kind==='void'){
          frames.splice(0,frames.length,frame(.7,x*.75,y*.75,.7,0),{...frame(.1,0,0,.9,120),offset:.4},{...frame(1,Math.cos(angle+1)*reach*.6,Math.sin(angle+1)*reach*.6,.9,180),offset:.65},frame(.1,x,y,0,220));
        }
        animate(n,frames,duration*.65,reduced?0:skin?(i%4)*15/speed:(i%4)*25);
      }
      if(!reduced&&['rays','core','crystals','spiral','convergence','time','void'].includes(profile.kind)){
        for(let i=0;i<(profile.kind==='convergence'?4:2);i++){
          const n=node('ring',profile.colors[i%profile.colors.length],radius*1.5);n.style.backgroundColor='transparent';
          const inward=profile.kind==='void';
          animate(n,[{opacity:0,transform:'translate(-50%,-50%) scale('+(inward?1.6:.25)+')'},{opacity:.55,offset:.2,transform:'translate(-50%,-50%) scale(.8)'},{opacity:0,transform:'translate(-50%,-50%) scale('+(inward?.05:1.8+i*.2)+')'}],duration*.55,skin?i*60/speed:i*100);
        }
      }
    });
    at(duration*.62,()=>{phase('reward');if(!paid){paid=true;reward();}});
    at(duration+1000/respawnSpeed,()=>{phase('complete');cancel();respawn();});
    return {cancel};
  }
  window.WakppuTranscendent={play,profiles,skinProfiles};
})();
