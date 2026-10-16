// Cosmetic-only profiles. Ownership/equipping must be server-validated before release.
window.WakppuSkinSounds={
 ballId:'eternity',
 profiles:[['common','은빛 영겁','단단한 왁스 · 짧고 낮은 파열'],['rare','빙결의 영겁','왁스 + 얼음 균열 · 맑은 파편'],['hero','불멸의 영겁','묵직한 왁스 + 짧은 불꽃'],['legendary','시간의 영겁','왁스 + 종의 잔향 · 뒤틀린 에너지'],['transcendent','무한의 영겁','깊은 파열 + 공간의 낮은 울림']].map(([id,name,description])=>({id,name,description})),
 appearance(ball){
  if(ball.id!=='eternity'||!this.profiles.some(p=>p.id===ball.skinId))return ball;
  const palettes={common:['#f1f5ff','#8d9eb5','#3c465a'],rare:['#dcffff','#42bfd9','#123d78'],hero:['#ffe1a0','#e55a28','#551536'],legendary:['#ffe5a1','#bb8737','#392846'],transcendent:['#e6dcff','#7652c9','#12152f']};
  const [light,mid,dark]=palettes[ball.skinId];
  return {...ball,design:{...ball.design,art:'eternitySkin',skin:ball.skinId,colors:{light,mid,dark},crack:{dark,light},chip:[light,mid,dark]}};
 },
 config(id){
  if(!this.profiles.some(p=>p.id===id))return null;
  return Object.fromEntries(['early','mid','late','final'].map(stage=>[stage,['eternity/'+id+'-'+stage]]));
 }
};
