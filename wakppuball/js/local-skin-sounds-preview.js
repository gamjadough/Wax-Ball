// Injected by the loopback preview server only. No ownership/economy changes.
(() => {
 if(!window.WakppuAuth?.local)return;
 const panel=document.createElement('section');panel.id='skinSoundPreview';
 panel.style.cssText='position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:100;width:calc(100% - 16px);max-width:720px;max-height:38svh;overflow:auto;padding:12px;box-sizing:border-box;background:#171923;color:#eef0f5;border:1px solid #ba86ff;border-radius:12px;display:flex;flex-wrap:wrap;gap:8px;align-items:center';
 const title=document.createElement('strong');title.textContent='영겁 스킨 사운드 미리보기 · 로컬 전용';panel.append(title);
 const note=document.createElement('p');note.style.cssText='width:100%;margin:0;font-size:13px';
 const select=document.createElement('select');select.id='skinSoundSelect';select.setAttribute('aria-label','스킨 사운드 선택');
 for(const p of WakppuSkinSounds.profiles){const option=document.createElement('option');option.value=p.id;option.textContent=p.name;select.append(option);}
 panel.append(select,note);
 let serial=0;const clips=new Map();
 function silence(){for(const player of clips.values()){player.pause();player.currentTime=0;}}
 function config(){return WakppuSkinSounds.config(select.value);}
 function prepare(mode='last'){
  silence();const ball=WAKPPU_BALLS.find(b=>b.id==='eternity');ball.skinId=select.value;
  SoundManager.init(Object.values(config()).flat());
  WakppuGameTest.run(mode,'eternity');
  note.textContent=WakppuSkinSounds.profiles.find(p=>p.id===select.value).description+' · 외형은 기본 영겁 / 파괴 속도·보상 변경 없음';
 }
 // Preload before the first touch so mobile playback starts in the gesture itself.
 for(const p of WakppuSkinSounds.profiles)for(const names of Object.values(WakppuSkinSounds.config(p.id))){
  const name=names[0],audio=new Audio('sounds/'+name+'.mp3');audio.preload='auto';clips.set(name,audio);
 }
 for(const [stage,text] of [['early','타격 듣기'],['mid','균열 듣기'],['late','마지막 균열'],['final','파괴음 듣기']]){
  const button=document.createElement('button');button.className='btn small';button.dataset.skinStage=stage;button.textContent=text;
  button.onclick=()=>{const turn=++serial;silence();const bgm=document.querySelector('#backgroundMusic');if(bgm)bgm.pause();const a=clips.get(config()[stage][0]);a.volume=.65;a.play().then(()=>{if(turn===serial)note.textContent='재생: '+button.textContent+' · '+select.selectedOptions[0].textContent;}).catch(()=>{note.textContent='재생 실패 · 다시 눌러주세요.';});};panel.append(button);
 }
 const last=document.createElement('button');last.className='btn small';last.id='skinSoundLast';last.textContent='공 마지막 타격 준비';last.onclick=()=>prepare();panel.append(last);
 const normal=document.createElement('button');normal.className='btn small';normal.textContent='공 처음부터 타격';normal.onclick=()=>prepare('normal');panel.append(normal);
 const bgmButton=document.createElement('button');bgmButton.className='btn small';bgmButton.textContent='BGM 끄기';
 // Capture-phase unlock runs before click; audition buttons pause BGM for comparison.
 bgmButton.onclick=()=>document.querySelector('#backgroundMusic')?.pause();panel.append(bgmButton);
 document.body.append(panel);select.onchange=()=>{++serial;prepare();};
 window.addEventListener('wakppu-account-restored',()=>prepare(),{once:true});
 prepare();
})();
