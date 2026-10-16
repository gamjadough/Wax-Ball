// Loopback-only prototype: all five samples are available; no production ownership.
document.addEventListener('DOMContentLoaded',()=>{
 if(!window.WakppuAuth?.local)return;
 const storeKey='wakppu-local-eternity-skin-v1',profiles=WakppuSkinSounds.profiles;
 let equipped='common';try{const saved=localStorage.getItem(storeKey);if(saved==='none'||profiles.some(p=>p.id===saved))equipped=saved;}catch{}
 const requested=new URLSearchParams(location.search).get('skin');if(profiles.some(p=>p.id===requested))equipped=requested;
 const panel=document.createElement('section');panel.id='skinSoundPreview';
 panel.style.cssText='position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:9;width:calc(100% - 16px);max-width:720px;max-height:34svh;overflow:auto;padding:12px;background:#171923;color:#eef0f5;border:1px solid #ba86ff;border-radius:12px;display:flex;flex-wrap:wrap;gap:8px;align-items:center';
 panel.innerHTML='<strong>영겁 스킨 · 로컬 미리보기 (BGM 없음)</strong><button id="previewOpenSkins" class="btn small">인벤토리 · 스킨</button><p id="previewSkinName" style="width:100%;margin:0;font-size:13px"></p>';
 const note=panel.querySelector('#previewSkinName'),clips=new Map();let serial=0;
 function silence(){++serial;for(const a of clips.values()){a.pause();a.currentTime=0;}}
 function prepare(mode='last'){
  silence();const ball=WAKPPU_BALLS.find(b=>b.id==='eternity');
  if(equipped==='none')delete ball.skinId;else ball.skinId=equipped;
  const cfg=WakppuSkinSounds.config(equipped);if(cfg)SoundManager.init(Object.values(cfg).flat());
  WakppuGameTest.run(mode,'eternity');
  if(mode==='last')WakppuGameTest.localSkinProgress(1);
  const motion={common:'기본 파괴 연출',rare:'얼음 재질·파편 (상시 움직임 없음)',hero:'내부 불꽃·불씨 → 화염 분출',legendary:'시계 회전 → 파편 정지 → 역회전',transcendent:'균열 틈의 빛·맥동 → 빛 흡수 → 공간 수축·별빛 소멸'};
  note.textContent='장착: '+(profiles.find(p=>p.id===equipped)?.name||'기본 영겁')+' · '+(motion[equipped]||'기본 파괴 연출')+' · 속도·보상 동일';
  panel.querySelectorAll('[data-skin-stage]').forEach(b=>b.disabled=!cfg);
 }
 for(const p of profiles)for(const names of Object.values(WakppuSkinSounds.config(p.id))){const name=names[0],a=new Audio('sounds/'+name+'.mp3');a.preload='auto';clips.set(name,a);}
 for(const [stage,text] of [['early','타격 듣기'],['mid','균열 듣기'],['late','마지막 균열'],['final','파괴음 듣기']]){
  const button=document.createElement('button');button.className='btn small';button.dataset.skinStage=stage;button.textContent=text;
  button.onclick=()=>{silence();const turn=serial,a=clips.get(WakppuSkinSounds.config(equipped)?.[stage]?.[0]);if(!a)return;a.volume=.65;a.play().catch(()=>{if(turn===serial)note.textContent='재생 실패 · 다시 눌러주세요.';});};panel.append(button);
 }
 for(const [mode,text,id] of [['last','공 마지막 타격 준비','skinSoundLast'],['normal','공 처음부터 타격','skinSoundNormal']]){const b=document.createElement('button');b.className='btn small';b.id=id;b.textContent=text;b.onclick=()=>prepare(mode);panel.append(b);}
 for(const progress of [.25,.6,.9]){const b=document.createElement('button');b.className='btn small';b.dataset.skinProgress=progress;b.textContent='균열 '+Math.round(progress*100)+'%';b.onclick=()=>{prepare('normal');WakppuGameTest.localSkinProgress(progress);};panel.append(b);}
 document.body.append(panel);
 const modal=document.querySelector('#itemsModal'),sheet=modal.querySelector('.sheet'),header=sheet.querySelector('.sheet-head');
 const items=document.createElement('div');items.id='inventoryItemsPage';
 for(const child of [...sheet.children])if(child!==header)items.append(child);
 sheet.append(items);
 const nav=document.createElement('div');nav.style.cssText='display:flex;gap:8px;margin:12px 0';
 nav.innerHTML='<button class="btn small" id="inventoryItemsTab" aria-pressed="true">아이템</button><button class="btn small" id="inventorySkinsTab" aria-pressed="false">스킨</button>';
 header.after(nav);
 const skins=document.createElement('section');skins.id='inventorySkinsPage';skins.hidden=true;
 skins.innerHTML='<h3>영겁의 왁뿌볼 전용 스킨</h3><p>로컬 테스트용 5종 전체 제공 · 운영 보유 데이터와 무관<br>스킨은 외형·소리만 변경하며 보상과 클릭 수는 그대로입니다.</p><div id="skinCards" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px"></div><p id="skinEquipStatus" role="status"></p><button id="skinUnequip" class="btn">스킨 해제 · 기본 외형</button>';
 sheet.append(skins);
 function render(){
  const base=WAKPPU_BALLS.find(b=>b.id==='eternity');
  skins.querySelector('#skinCards').innerHTML=profiles.map((p,i)=>{
   const ball=WakppuSkinSounds.appearance({...base,skinId:p.id}),selected=equipped===p.id,rank=['일반','희귀','영웅','전설','초월'][i];
   return '<article style="padding:10px;border:1px solid '+(selected?'#f3c454':'#5e576d')+';border-radius:12px;text-align:center"><div style="width:110px;max-width:100%;margin:auto">'+buildBallThumb(ball)+'</div><strong>'+p.name+'</strong><p>'+rank+'</p><button class="btn small" data-equip-skin="'+p.id+'" '+(selected?'disabled':'')+'>'+(selected?'장착 중':'장착')+'</button></article>';
  }).join('');
  skins.querySelector('#skinEquipStatus').textContent='현재 장착: '+(profiles.find(p=>p.id===equipped)?.name||'기본 영겁');
  skins.querySelector('#skinUnequip').disabled=equipped==='none';
 }
 function show(skin){items.hidden=skin;skins.hidden=!skin;nav.querySelector('#inventoryItemsTab').setAttribute('aria-pressed',String(!skin));nav.querySelector('#inventorySkinsTab').setAttribute('aria-pressed',String(skin));if(skin)render();}
 function equip(id){equipped=id;try{localStorage.setItem(storeKey,id);}catch{}prepare();render();skins.querySelector('#skinUnequip').focus();}
 nav.querySelector('#inventoryItemsTab').onclick=()=>show(false);nav.querySelector('#inventorySkinsTab').onclick=()=>show(true);
 skins.addEventListener('click',e=>{const b=e.target.closest('[data-equip-skin]');if(b)equip(b.dataset.equipSkin);});skins.querySelector('#skinUnequip').onclick=()=>equip('none');
 document.querySelector('#inventoryBtn').addEventListener('click',()=>show(false));
 panel.querySelector('#previewOpenSkins').onclick=()=>{silence();document.querySelector('#inventoryBtn').click();show(true);nav.querySelector('#inventorySkinsTab').focus();};
 window.addEventListener('wakppu-account-restored',()=>prepare(),{once:true});prepare();render();
});
