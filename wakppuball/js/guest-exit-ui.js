(() => {
 let ui,mode,email='',busy=false,origin;
 function close(){if(busy)return;ui.modal.hidden=true;ui.password.value='';origin?.focus();}
 function open(kind,address=''){
  if(!ui||busy||WakppuGuestExit.busy)return;mode=kind;email=address;origin=document.activeElement;
  ui.title.textContent=kind==='switch'?'기존 계정으로 전환':'빠른 시작 계정 삭제 후 로그아웃';
  ui.intro.textContent=kind==='switch'?'해당 이메일 계정으로 진행 상황 및 계정을 전환하시겠습니까?':'로그아웃하면 이 빠른 시작 계정은 삭제됩니다.';
  ui.email.textContent=address;ui.credentials.hidden=kind!=='switch';ui.password.value='';ui.status.textContent='';
  ui.confirm.textContent=kind==='switch'?'인증 후 계정 전환':'계정 삭제 후 로그아웃';ui.modal.hidden=false;ui.cancel.focus({preventScroll:true});ui.modal.querySelector('.sheet').scrollTop=0;
 }
 async function confirm(){
  if(busy)return;if(mode==='switch'&&ui.password.value.length<6){ui.status.textContent='기존 계정의 비밀번호를 6자 이상 입력해주세요.';ui.password.focus();return;}
  const game=window.WakppuItemGame;if(game?.read().busy||window.WakppuItems?.busy||window.WakppuSkins?.busy||window.WakppuLimited?.busy){ui.status.textContent='진행 중인 게임 처리가 끝난 뒤 다시 시도해주세요.';return;}
  busy=true;ui.confirm.disabled=ui.cancel.disabled=ui.password.disabled=true;ui.status.textContent='계정 처리 중…';
  try{
   if(game?.read().ready)await game.flush();
   const result=await WakppuGuestExit.run(mode,email,ui.password.value);ui.password.value='';
   if(result.error)throw result.error;
   ui.modal.hidden=true;document.getElementById('account').hidden=true;document.getElementById('accountBtn').focus();
  }catch(e){ui.status.textContent=e.message||'처리하지 못했습니다. 다시 시도해주세요.';ui.status.scrollIntoView({block:'nearest'});}
  finally{busy=false;ui.confirm.disabled=ui.cancel.disabled=ui.password.disabled=false;}
 }
 document.addEventListener('DOMContentLoaded',()=>{
  const modal=document.createElement('div');modal.id='guestExitDialog';modal.className='modal guest-exit-modal';modal.hidden=true;
  modal.innerHTML='<section class="sheet compact" role="alertdialog" aria-modal="true" aria-labelledby="guestExitTitle" aria-describedby="guestExitIntro guestExitWarning"><h2 id="guestExitTitle"></h2><p id="guestExitIntro"></p><p id="guestExitWarning">현재 빠른 시작 계정과 Gold·아이템·스킨 등 모든 진행 상황은 <strong>파기(영구 삭제)</strong>됩니다. 복구할 수 없습니다.<br>기존 계정의 진행도와 합쳐지지 않습니다. 구매·운영 기록은 보관됩니다.</p><div id="guestExitCredentials" class="account-form"><p id="guestExitEmail"></p><label>기존 계정 비밀번호<input id="guestExitPassword" type="password" minlength="6" autocomplete="current-password"></label><p>비밀번호 인증 성공 후에만 빠른 시작 계정을 삭제합니다.</p></div><p id="guestExitStatus" role="status"></p><div class="account-actions"><button id="guestExitCancel" class="btn">취소</button><button id="guestExitConfirm" class="btn primary"></button></div></section>';
  document.body.append(modal);const get=id=>document.getElementById('guestExit'+id);ui={modal,title:get('Title'),intro:get('Intro'),credentials:get('Credentials'),email:get('Email'),password:get('Password'),status:get('Status'),cancel:get('Cancel'),confirm:get('Confirm')};
  ui.cancel.onclick=close;ui.confirm.onclick=confirm;
  document.addEventListener('keydown',e=>{if(modal.hidden)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}else if(e.key==='Tab'){const nodes=[...modal.querySelectorAll('button:not(:disabled),input:not(:disabled)')].filter(n=>n.getClientRects().length),first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}},true);
 });
 window.WakppuGuestDialog={open,get busy(){return busy;}};
})();
