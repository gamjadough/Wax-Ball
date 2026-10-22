// Server-authoritative paid custom cosmetics. Files stay local until Apply uploads the cropped PNG.
(() => {
 if(!window.WakppuAuth||WakppuAuth.local&&!document.body.hasAttribute('data-custom-live-local'))return;
 const $=id=>document.getElementById(id),stages=['early','mid','late','final'];
 let owner=null,record={plan:'none',target:null,profiles:{},global:null,presets:[],balls:[],revision:0},draft=null,bitmap=null,uploadSequence=0,saving=false,decoding=false,imageDirty=false,previousFocus=null,auditionSequence=0;const auditionNames=new Set();let refreshSequence=0,stateSignature="",urlsAt=0,urls={},lastRefresh=0;
 const sources=new Map(),catalog=[...WAKPPU_BALLS,ADMIN_EVENT_BALL,WakppuLimitedData.ball];
 for(const ball of catalog)sources.set(ball.id,{id:ball.id,name:ball.name,ball,owned:()=>true});
 for(const p of WakppuSkinSounds.profiles)sources.set('skin:'+p.id,{id:'skin:'+p.id,name:p.name+' · 보유 스킨',ball:WakppuSkinSounds.appearance({...WAKPPU_BALLS.find(b=>b.id==='eternity'),skinId:p.id}),owned:()=>record.presets.includes('skin:'+p.id)});
 for(const p of WakppuPumpkinSkins.profiles)sources.set('pumpkin:'+p.id,{id:'pumpkin:'+p.id,name:p.name+' · 한정 스킨',ball:WakppuPumpkinSkins.appearance(WakppuLimitedData.ball,p.id),owned:()=>record.presets.includes('pumpkin:'+p.id)});
 const permitted=id=>owner&&owner===WakppuItemGame.read().account&&(record.plan==='all'||record.plan==='single'&&record.target===id);
 const validSource=id=>sources.has(id)&&sources.get(id).owned();
 const target=()=>$('customTarget').value;
 const fresh=()=>({image:null,effect:'yellow',sound:'yellow',zoom:1,x:50,y:50});
 async function transport(body){
  const account=WakppuItemGame.read().account;let endpoint,headers={'Content-Type':'application/json'};
  if(WakppuAuth.local){const session=JSON.parse(sessionStorage.getItem('wakppu-local-session')||'null');endpoint='/local/custom-image';headers.Authorization='Bearer '+session?.token;}
  else{const {data:{session}}=await WakppuAuth.session();if(!session||session.user.id!==account)throw Error('로그인 상태가 변경되었습니다. 다시 시도해주세요.');endpoint=WAKPPU_SERVER.url+'/functions/v1/custom-ball-image';headers.apikey=WAKPPU_SERVER.anonKey;headers.Authorization='Bearer '+session.access_token;}
  const response=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify(body)}),result=await response.json().catch(()=>({}));
  if(account!==WakppuItemGame.read().account)throw Error('계정이 변경되었습니다.');if(!response.ok)throw Object.assign(new Error(result.error||'서버 요청에 실패했습니다.'),{status:response.status});return result;
 }
 function applyState(result){
  const changed=JSON.stringify(result.state)!==stateSignature||Date.now()-urlsAt>600000;stateSignature=JSON.stringify(result.state);if(result.urls){urls=result.urls;urlsAt=Date.now();}
  record=result.state;
  const hydrate=c=>c&&!c.disabled?{...c,image:urls[c.asset_id]}:c;
  record={...record,global:hydrate(record.global),profiles:Object.fromEntries(Object.entries(record.profiles).map(([k,c])=>[k,hydrate(c)]))};
  options();for(const option of $('customTarget').options)option.disabled=!record.balls.includes(option.value);render();if(changed)refreshGame();
 }
 async function refresh(){
  const who=WakppuItemGame.read().account,seq=++refreshSequence;if(!who||!WakppuItemGame.read().ready)return;
  if(owner!==who){owner=who;urls={};urlsAt=0;stateSignature='';}
  try{const state=await WakppuAuth.invoke('custom_status');if(seq!==refreshSequence||who!==WakppuItemGame.read().account)return;
   if(JSON.stringify(state)!==stateSignature||Date.now()-urlsAt>600000){const result=await transport({action:'status'});if(seq!==refreshSequence||who!==WakppuItemGame.read().account)return;applyState(result);}
   lastRefresh=Date.now();
  }catch(e){if(seq===refreshSequence)say('커스텀 정보를 불러오지 못했습니다: '+e.message);}
 }
 async function mutate(body){let result;try{result=await transport(body);}catch(e){if(e.status)throw e;result=await transport(body);}applyState(result);}
 function say(text){$('customStatus').textContent=text;}
 function config(id){if(!permitted(id))return null;const c=record.profiles[id]||record.global;return c?.image&&validSource(c.effect)&&validSource(c.sound)?c:null;}
 function appearance(ball){const c=owner===WakppuItemGame.read().account&&config(ball.id);if(!c)return ball;const source=sources.get(c.effect).ball;const sound=getSoundConfig(sources.get(c.sound).ball);SoundManager.init([...stages.flatMap(k=>sound[k]||[]),...(sound.sequence||[])]);return {...ball,skinId:null,image:c.image,custom:{effect:c.effect,sound:c.sound},sound:{...getSoundConfig(sources.get(c.sound).ball)},design:{...source.design,shape:'circle'}};}
 function effectBall(ball){const c=ball.custom;if(!c)return ball;return {...sources.get(c.effect).ball,image:ball.image,clicks:ball.clicks,reward:ball.reward};}
 function refreshGame(){if(!WakppuItemGame.read().busy)WakppuSkinGame.refresh();}
 function stopAudition(){auditionSequence++;for(const name of auditionNames)SoundManager.stop(name);auditionNames.clear();}
 function options(){for(const id of ['customEffect','customSound']){const select=$(id),value=select.value;select.replaceChildren();for(const s of sources.values()){const o=new Option(s.name+(s.owned()?'':' · 미보유'),s.id);o.disabled=!s.owned();select.add(o);}select.value=sources.has(value)?value:'yellow';}}
 function draw(){const c=$('customCanvas'),g=c.getContext('2d');g.clearRect(0,0,512,512);g.fillStyle='#191727';g.fillRect(0,0,512,512);g.save();g.beginPath();g.arc(256,256,246,0,Math.PI*2);g.clip();
  if(bitmap){const scale=Math.max(512/bitmap.width,512/bitmap.height)*Number($('customZoom').value),w=bitmap.width*scale,h=bitmap.height*scale;g.drawImage(bitmap,(512-w)*Number($('customX').value)/100,(512-h)*Number($('customY').value)/100,w,h);}

  else {g.fillStyle='#9c91ba';g.font='24px sans-serif';g.textAlign='center';g.fillText('이미지를 선택하세요',256,260);}
  g.restore();rim(g);
  $('customZoomValue').textContent=Number($('customZoom').value).toFixed(2)+'배';
 }
 function rim(g){g.save();g.beginPath();g.arc(256,256,246,0,Math.PI*2);g.strokeStyle='#bda8ef';g.lineWidth=3;g.stroke();g.restore();}
 function snapshot(){if(!imageDirty&&draft?.image)return draft.image;const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');if(bitmap){const scale=Math.max(512/bitmap.width,512/bitmap.height)*Number($('customZoom').value),w=bitmap.width*scale,h=bitmap.height*scale;g.drawImage(bitmap,(512-w)*Number($('customX').value)/100,(512-h)*Number($('customY').value)/100,w,h);}return bitmap?c.toDataURL('image/png'):draft.image;}
 function release(){uploadSequence++;bitmap?.close();bitmap=null;decoding=false;imageDirty=false;}
 async function loadImage(file){const seq=++uploadSequence;try{
  if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024)throw Error('PNG·JPG·WebP, 8MB 이하 이미지를 선택해주세요.');
  decoding=true;render();const image=await createImageBitmap(file,{imageOrientation:'from-image'});
  if(seq!==uploadSequence){image.close();return;}
  if(image.width<32||image.height<32||image.width>4096||image.height>4096){image.close();throw Error('가로·세로 32~4096px 이미지를 사용해주세요.');}
  bitmap?.close();bitmap=image;imageDirty=true;$('customZoom').value=1;$('customX').value=$('customY').value=50;draw();say('이미지를 불러왔습니다. 확대와 위치를 조절한 뒤 적용하세요.');
 }catch(e){say(e.name==='InvalidStateError'?'이미지를 읽지 못했습니다. 다른 PNG·JPG·WebP 파일을 선택해주세요.':e.message);}finally{if(seq===uploadSequence)decoding=false;render();}}
 function sample(){const c=document.createElement('canvas');c.width=768;c.height=512;const g=c.getContext('2d'),r=g.createRadialGradient(340,180,10,384,256,420);r.addColorStop(0,'#f4d9b5');r.addColorStop(.3,'#9b60af');r.addColorStop(1,'#112d4e');g.fillStyle=r;g.fillRect(0,0,768,512);g.strokeStyle='#c2f0f0';g.lineWidth=5;for(let i=0;i<4;i++){g.beginPath();g.ellipse(384,256,100+i*35,45+i*20,-.5,0,Math.PI*2);g.stroke();}g.fillStyle='#fff1cf';for(let i=0;i<55;i++){g.beginPath();g.arc((i*137)%768,(i*83)%512,1+i%3,0,Math.PI*2);g.fill();}const generation=uploadSequence;c.toBlob(blob=>{if(generation===uploadSequence&&!$('customModal').hidden)loadImage(new File([blob],'sample.png',{type:'image/png'}));});}
 function render(){const id=target();$('customPlanState').textContent=record.admin_access?'관리자 · 모든 볼 커스텀 이용 가능':record.plan==='all'?'전체 볼 이용 중 · 새로 해금한 볼에도 적용 가능':record.plan==='single'?'단일 볼 이용 중 · '+catalog.find(b=>b.id===record.target)?.name:'유료 상점에서 이용권을 구매하고 입금 확인 후 적용할 수 있습니다.';
  const allowed=permitted(id)&&record.balls.includes(id),busy=saving||decoding||WakppuItemGame.read().busy;for(const key of ['customZoom','customX','customY'])$(key).disabled=decoding;
  $('customApply').disabled=busy||!allowed||!bitmap&&!draft?.image||!validSource($('customEffect').value)||!validSource($('customSound').value);
  $('customApplyAll').disabled=$('customApply').disabled||record.plan!=='all';$('customRestoreAll').hidden=record.plan!=='all';$('customRestoreAll').disabled=busy||!record.global&&!Object.keys(record.profiles).length;
  $('customRestore').disabled=busy||!config(id);$('customPlay').disabled=busy||!record.balls.includes(id);
  $('customScope').textContent=!allowed?'이 볼에 적용할 이용권과 해금 상태를 확인해주세요.':record.profiles[id]?'이 볼에 개별 설정이 저장되어 있습니다.':record.global?'전체 공통 설정을 사용 중입니다.':'저장된 커스텀이 없습니다.';
 }

 function edit(){release();draft=structuredClone(config(target())||fresh());$('customEffect').value=draft.effect;$('customSound').value=draft.sound;$('customZoom').value=1;$('customX').value=$('customY').value=50;$('customFile').value='';
  if(draft.image){const seq=uploadSequence;decoding=true;fetch(draft.image).then(r=>r.blob()).then(createImageBitmap).then(image=>{if(seq!==uploadSequence){image.close();return;}bitmap=image;draw();}).catch(()=>{if(seq===uploadSequence)say('저장 이미지를 읽지 못했습니다. 다시 업로드해주세요.');}).finally(()=>{if(seq===uploadSequence){decoding=false;render();}});}
  draw();render();say('변경 내용은 적용 버튼을 눌러야 저장됩니다.');}

 async function save(all=false){if(saving||!permitted(target())||all&&record.plan!=='all'||!validSource($('customEffect').value)||!validSource($('customSound').value))return;saving=true;render();try{
  const body={action:'save',mode:'save',target:all?'@all':target(),effect:$('customEffect').value,sound:$('customSound').value,revision:record.revision,request_id:crypto.randomUUID()};
  if(imageDirty||!draft?.asset_id){body.image=snapshot();if(!body.image)throw Error('이미지를 선택해주세요.');}else body.asset_id=draft.asset_id;
  await mutate(body);edit();say(all?'모든 볼에 같은 설정을 저장했습니다.':'이 볼의 커스텀을 저장했습니다. 인게임 플레이로 확인하세요.');
 }catch(e){if(e.status===409)await refresh();say('저장하지 못했습니다: '+e.message);}finally{saving=false;render();}}
 async function restore(all=false){if(saving)return;saving=true;render();try{await mutate({action:'save',mode:'restore',target:all?'@all':target(),revision:record.revision,request_id:crypto.randomUUID()});edit();say(all?'전체 기본 외형으로 복원했습니다.':'선택한 볼의 기본 외형으로 복원했습니다.');}catch(e){if(e.status===409)await refresh();say(e.message);}finally{saving=false;render();}}
 async function play(){if(WakppuItemGame.read().busy)return;if(imageDirty||$('customEffect').value!==draft.effect||$('customSound').value!==draft.sound){say('변경한 이미지와 연출을 먼저 적용해주세요.');return;}try{if(!await WakppuCustomGame.select(target()))throw Error('현재 선택할 수 없는 볼입니다. 해금·이벤트 상태를 확인해주세요.');close();for(const id of ['shop','itemsModal']){const modal=document.getElementById(id);if(modal&&!modal.hidden)modal.querySelector('[data-close],.close,button[id$="Close"]')?.click();}}catch(e){say(e.message);}}
 async function open(){previousFocus=document.activeElement;await refresh();const id=record.plan==='single'?record.target:window.WakppuCustomGame?.current();if(catalog.some(b=>b.id===id)&&record.balls.includes(id))$('customTarget').value=id;$('customModal').hidden=false;edit();$('customClose').focus();}
 function close(){stopAudition();$('customModal').hidden=true;release();previousFocus?.focus();}
 const ui=document.createElement('section');ui.id='customModal';ui.className='custom-modal';ui.hidden=true;ui.setAttribute('role','dialog');ui.setAttribute('aria-modal','true');ui.setAttribute('aria-labelledby','customTitle');
 ui.innerHTML=`<div class="custom-sheet"><header><div><small>WAX STUDIO</small><h2 id="customTitle">나만의 왁뿌볼</h2></div><button class="btn" id="customClose">닫기</button></header><p class="custom-intro">이미지를 입히고, 익숙한 연출과 사운드를 조합해보세요. 균열과 파괴는 기존 연출을 재사용하며, 타격량·보상은 바뀌지 않습니다.</p><div class="custom-layout"><div class="custom-preview"><canvas id="customCanvas" width="512" height="512" aria-label="원형 이미지 자르기 미리보기"></canvas><p>원 안쪽이 볼에 표시됩니다.<br>균열·파괴는 인게임에서 확인하세요.</p><button class="btn" id="customSample">샘플 이미지 사용</button></div><div class="custom-form"><section><h3>01 · 적용할 볼과 이용권</h3><label>왁뿌볼<select id="customTarget"></select></label><p id="customPlanState"></p><button class="btn" id="customBuyLink">유료 상점에서 이용권 구매</button><p>단일 볼 30,000원 · 전체 볼 50,000원<br>단일 보유자는 차액 20,000원으로 업그레이드 · 이미지 자유 교체</p><p id="customScope"></p></section><section><h3>02 · 이미지 편집</h3><label>이미지 파일 · PNG/JPG/WebP · 최대 8MB<input id="customFile" type="file" accept="image/png,image/jpeg,image/webp"></label><label>확대 <output id="customZoomValue">1.00배</output><input id="customZoom" type="range" min="1" max="3" step=".01" value="1"></label><label>가로 위치<input id="customX" type="range" min="0" max="100" value="50"></label><label>세로 위치<input id="customY" type="range" min="0" max="100" value="50"></label><p>32~4096px · 저장 시 512px 이미지로 변환합니다.<br>적용 시 서버에서 다시 검증한 뒤 비공개로 저장합니다.</p></section><section><h3>03 · 균열·파괴와 사운드</h3><label>균열·파괴 연출 세트<select id="customEffect"></select></label><label>사운드 세트<select id="customSound"></select></label><button class="btn" id="customListen">선택 사운드 들어보기</button><p>일반 볼 연출은 기본 제공 · 스킨 연출은 보유 시 선택 가능</p></section></div></div><footer><p id="customStatus" role="status" aria-live="polite"></p><div class="custom-actions"><button class="btn primary" id="customApply">이 볼에 적용</button><button class="btn" id="customApplyAll">전체에 같은 설정 적용</button><button class="btn" id="customRestore">이 볼 기본 외형 복원</button><button class="btn" id="customPlay">저장한 볼로 플레이</button><button class="btn" id="customRestoreAll">전체 기본 외형 복원</button></div></footer></div>`;document.body.append(ui);
 for(const b of catalog)$('customTarget').add(new Option(b.name,b.id));options();

 $('customClose').onclick=close;$('customTarget').onchange=edit;$('customSample').onclick=sample;$('customFile').onchange=e=>loadImage(e.target.files[0]);for(const id of ['customZoom','customX','customY'])$(id).oninput=()=>{imageDirty=true;draw();};
 $('customEffect').onchange=render;$('customSound').onchange=()=>{stopAudition();render();};$('customApply').onclick=()=>save();$('customApplyAll').onclick=()=>save(true);$('customBuyLink').onclick=()=>{close();WakppuItems.showShop('premium');};
 $('customPlay').onclick=play;$('customRestoreAll').onclick=()=>restore(true);
 $('customListen').onclick=async()=>{const s=sources.get($('customSound').value);if(!s?.owned())return;stopAudition();const seq=auditionSequence;SoundManager.unlock();const cfg=getSoundConfig(s.ball),name=cfg.final[0];auditionNames.add(name);SoundManager.init(stages.flatMap(k=>cfg[k]||[]));say('사운드 준비 중…');for(let i=0;i<100&&!SoundManager.ready(name);i++){await new Promise(r=>setTimeout(r,30));if(seq!==auditionSequence)return;}if(seq!==auditionSequence)return;if(!SoundManager.ready(name)){say('사운드를 불러오지 못했습니다. 다시 시도해주세요.');return;}SoundManager.play(name,{...cfg,fallback:false});say('선택한 파괴음을 재생했습니다. 음소거·효과음 설정을 따릅니다.');};
 $('customRestore').onclick=()=>restore();
 ui.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const nodes=[...ui.querySelectorAll('button,input,select')].filter(n=>!n.disabled&&n.getClientRects().length),a=nodes[0],b=nodes.at(-1);if(e.shiftKey&&document.activeElement===a){e.preventDefault();b.focus();}else if(!e.shiftKey&&document.activeElement===b){e.preventDefault();a.focus();}}});
 window.WakppuCustomBall={appearance,effectBall,config,open,refresh};
 document.addEventListener('DOMContentLoaded',()=>{const launch=document.createElement('button');launch.className='btn';launch.id='customOpen';launch.textContent='커스텀 편집·미리보기';launch.onclick=open;$('purchaseStatus').after(launch);refresh();});
 window.addEventListener('wakppu-account-restored',()=>{const current=WakppuItemGame.read().account;if(owner!==current){++refreshSequence;owner=null;close();draft=null;record={plan:'none',profiles:{},global:null,presets:[],balls:[],revision:0};urls={};urlsAt=0;stateSignature='';options();render();refreshGame();}refresh();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastRefresh>15000)refresh();});
 setInterval(()=>{if(!ui.hidden)render();if(!document.hidden&&!saving&&Date.now()-lastRefresh>30000)refresh();},1000);
 window.addEventListener('pagehide',()=>{release();stopAudition();});
})();
