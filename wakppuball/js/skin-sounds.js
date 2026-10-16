// Cosmetic-only profiles. Ownership/equipping must be server-validated before release.
window.WakppuSkinSounds={
 ballId:'eternity',
 profiles:[['common','은빛 영겁','단단한 왁스 · 짧고 낮은 파열'],['rare','빙결의 영겁','왁스 + 얼음 균열 · 맑은 파편'],['hero','불멸의 영겁','묵직한 왁스 + 짧은 불꽃'],['legendary','시간의 영겁','왁스 + 종의 잔향 · 뒤틀린 에너지'],['transcendent','무한의 영겁','깊은 파열 + 공간의 낮은 울림']].map(([id,name,description])=>({id,name,description})),
 config(id){
  if(!this.profiles.some(p=>p.id===id))return null;
  return Object.fromEntries(['early','mid','late','final'].map(stage=>[stage,['eternity/'+id+'-'+stage]]));
 }
};
