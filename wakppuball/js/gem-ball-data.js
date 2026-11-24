(() => {
 const sound={early:['materials/ice-keycap/early.wav','materials/ice-keycap/tap.wav'],mid:['materials/ice-keycap/mid.wav'],late:['materials/ice-keycap/late.wav'],final:['materials/ice-keycap/final.wav'],pitch:1,pitchRandom:0,volume:.7,volumeRandom:0};
 const specs=[
  ['blue-crystal-wax','푸른 수정 왁뿌볼',5000,100,5,'blue-crystal',['#b9f4ff','#248ad3','#102f66']],
  ['deepsea-crystal-wax','심해 수정 왁뿌볼',25000,150,8,'deepsea',['#99fff0','#14858f','#071e43']],
  ['aurora-crystal-wax','오로라 수정 왁뿌볼',100000,200,12,'aurora',['#dcfff9','#7966d8','#18274f']],
  ['stellar-crystal-core','별의 결정핵 왁뿌볼',500000,300,20,'stellar',['#fff6cf','#54a4f3','#17234f']]
 ];
 const balls=specs.map(([id,name,price,clicks,gemReward,variant,palette],i)=>({id,name,grade:'푸른젬',gradeColor:'#72d5ff',price,clicks,reward:0,gemReward,requiresBallId:i?specs[i-1][0]:null,unlockOrder:i+1,
  design:{art:'blueGem',motif:'blue_crystal',variant,shape:'circle',colors:{light:palette[0],mid:palette[1],dark:palette[2]},crack:{dark:palette[2],light:palette[0]},chip:palette},sound}));
 window.WakppuGemBallData={ball:balls[0],balls,get:id=>balls.find(b=>b.id===id)||null,has:id=>balls.some(b=>b.id===id)};
 window.WakppuGemBallArt=(uid,ball=balls[0])=>{
  const {light,mid,dark}=ball.design.colors,v=ball.design.variant||'blue-crystal';
  const crystal=(cx,cy,scale,rotate=0)=>`<g transform="translate(${cx} ${cy}) rotate(${rotate}) scale(${scale})"><path d="M0 -59L34 -31L43 15L10 60L-29 27L-32 -20Z" fill="url(#${uid}-gem-face)" stroke="${light}" stroke-width="1.5"/><path d="M0 -59L5 1L34 -31M5 1L43 15M5 1L10 60M5 1L-29 27M5 1L-32 -20" fill="none" stroke="${light}" opacity=".65"/><path d="M5 1L10 60L43 15Z" fill="${dark}" opacity=".45"/></g>`;
  let art=crystal(94,95,1);
  if(v==='deepsea')art=`<g fill="none" stroke="${light}" opacity=".18"><ellipse cx="100" cy="128" rx="63" ry="18"/><ellipse cx="100" cy="136" rx="49" ry="13"/></g>${crystal(82,98,.83,-14)}${crystal(121,101,.67,22)}<g fill="${light}" opacity=".6"><circle cx="55" cy="58" r="3"/><circle cx="145" cy="82" r="2"/><circle cx="136" cy="51" r="4"/></g>`;
  if(v==='aurora')art=`<g fill="none" stroke-linecap="round" opacity=".6"><path d="M35 89Q71 28 133 49T168 100" stroke="#80ffe1" stroke-width="5"/><path d="M37 108Q78 51 147 74" stroke="#e9a8ff" stroke-width="4"/><path d="M44 128Q106 99 161 124" stroke="#8ceaff" stroke-width="3"/></g>${crystal(96,103,.94,12)}`;
  if(v==='stellar')art=`<g fill="none" stroke="${light}" opacity=".55"><ellipse cx="100" cy="100" rx="66" ry="24" transform="rotate(-28 100 100)"/><ellipse cx="100" cy="100" rx="60" ry="24" transform="rotate(58 100 100)"/></g><path d="M100 37L143 63L150 118L109 158L57 132L49 77Z" fill="url(#${uid}-gem-face)" stroke="${light}" stroke-width="2"/><path d="M100 37L100 100L143 63M100 100L150 118M100 100L109 158M100 100L57 132M100 100L49 77" fill="none" stroke="${light}" opacity=".65"/><path d="M100 72L107 93L128 100L107 107L100 129L93 107L72 100L93 93Z" fill="${light}"/>`;
  return {defs:`<radialGradient id="${uid}-gem-wax" cx=".32" cy=".25"><stop stop-color="${light}"/><stop offset=".42" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/></radialGradient><linearGradient id="${uid}-gem-face" x2="1" y2="1"><stop stop-color="${light}"/><stop offset=".5" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/></linearGradient>`,
   art:`<g data-gem-wax="${v}"><circle cx="100" cy="100" r="82" fill="url(#${uid}-gem-wax)"/>${art}<g fill="${light}" opacity=".8"><path d="M35 90L49 64L61 88L50 115Z M142 128L153 100L171 123L156 146Z" opacity=".5"/><circle cx="61" cy="146" r="2"/><circle cx="144" cy="66" r="2.5"/><path d="M74 48V60M68 54H80M145 149V159M140 154H150" stroke="${light}" stroke-width="1.5"/></g><ellipse cx="69" cy="52" rx="19" ry="7" transform="rotate(-35 69 52)" fill="${light}" opacity=".3"/></g>`};
 };
})();
