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
  function play({ball,wrap,svg,effects,center,radius,valid,reward,respawn,speed=1}){
    const profile=profiles[ball.design.motif],reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
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
    const contraction=['core','embers','convergence'].includes(profile.kind);
    const charge=animate(svg,reduced?[{opacity:1},{opacity:.5}]:[{transform:'scale(1)',opacity:1},{transform:contraction?'scale(.68)':'scale(1.08)',opacity:.8}],duration*.26);
    at(duration*.26,()=>{
      phase('release');charge.cancel();svg.style.opacity='0';
      if(profile.kind==='halves'&&!reduced){
        for(let side=0;side<2;side++){
          const n=node('wax-half',profile.colors[side],radius*2);n.style.clipPath=side?'inset(0 0 0 50%)':'inset(0 50% 0 0)';
          animate(n,[{opacity:.9,transform:'translate(-50%,-50%) rotate(0deg)'},{opacity:0,transform:'translate(calc(-50% + '+(side?radius:-radius)+'px),-35%) rotate('+(side?45:-45)+'deg)'}],duration*.65);
        }
      }
      const count=reduced?5:profile.kind==='convergence'?36:profile.kind==='clouds'?12:24;
      for(let i=0;i<count;i++){
        const angle=i/count*Math.PI*2,kind=profile.kind;
        const type=kind==='convergence'?['cloud','crystal','ember','ray'][i%4]:kind==='souls'?'wisp':kind==='flames'?'flame':kind==='clouds'?'cloud':kind==='crystals'?'crystal':kind==='rays'?'ray':['embers','core'].includes(kind)?'ember':'mote';
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
        animate(n,frames,duration*.65,reduced?0:(i%4)*25);
      }
      if(!reduced&&['rays','core','crystals','spiral','convergence'].includes(profile.kind)){
        for(let i=0;i<(profile.kind==='convergence'?4:2);i++){
          const n=node('ring',profile.colors[i%profile.colors.length],radius*1.5);n.style.backgroundColor='transparent';
          animate(n,[{opacity:0,transform:'translate(-50%,-50%) scale(.25)'},{opacity:.55,offset:.2,transform:'translate(-50%,-50%) scale(.8)'},{opacity:0,transform:'translate(-50%,-50%) scale('+(1.8+i*.2)+')'}],duration*.55,i*100);
        }
      }
    });
    at(duration*.62,()=>{phase('reward');if(!paid){paid=true;reward();}});
    at(duration,()=>{phase('complete');cancel();respawn();});
    return {cancel};
  }
  window.WakppuTranscendent={play,profiles};
})();
