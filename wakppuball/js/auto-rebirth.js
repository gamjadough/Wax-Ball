(() => {
 const $=id=>document.getElementById(id);
 let state=null,owner=null,sequence=0,busy=false,lastAttempt=0;
 function render(){
  for(const prefix of ['rebirthAuto','shopAuto']){
   const box=$(prefix);if(!box)continue;box.hidden=!state?.owned;
   const button=$(prefix+'Toggle');button.textContent='자동 환생 '+(state?.enabled?'ON':'OFF');button.setAttribute('aria-pressed',String(!!state?.enabled));button.disabled=busy;
  }
 }
 async function refresh(){
  if(busy)return;const account=WakppuItemGame.read().account,version=++sequence;
  if(!account||!WakppuItemGame.read().ready){state=null;owner=null;render();return;}
  try{const next=await WakppuAuth.invoke('auto_rebirth_status');if(version!==sequence||account!==WakppuItemGame.read().account)return;state=next;owner=account;render();}
  catch{if(version===sequence){state=null;owner=null;render();}}
 }
 async function toggle(){
  if(busy||owner!==WakppuItemGame.read().account||!state?.owned)return;
  const enabled=!state.enabled;
  if(enabled&&!confirm('자동 환생을 켤까요? 필요 골드를 모으면 보상·파괴 연출 종료 후 자동 환생합니다. Gold·해금한 일반 볼·꿀·보석 코팅·사용 중 아이템 효과는 초기화됩니다. 접속 중에만 작동합니다.'))return;
  busy=true;++sequence;const account=owner;render();
  try{const next=await WakppuAuth.invoke('auto_rebirth_toggle',{enabled});if(account===WakppuItemGame.read().account)state=next;}
  catch(e){if(account===WakppuItemGame.read().account)$('autoRebirthStatus').textContent=e.message;}
  finally{busy=false;render();await refresh();}
 }
 async function tick(){
  if(document.hidden||busy||!state?.enabled||owner!==WakppuItemGame.read().account||Date.now()-lastAttempt<2000)return;
  busy=true;render();
  try{if(await window.WakppuAutoRebirthGame?.run()){$('autoRebirthStatus').textContent='자동 환생을 완료했습니다.';}}
  catch(e){lastAttempt=Date.now();state=null;$('autoRebirthStatus').textContent=e.message||'연결 후 자동 환생 상태를 다시 확인합니다.';}
  finally{busy=false;render();if(!state)await refresh();}
 }
 document.addEventListener('DOMContentLoaded',()=>{
  const help='접속 중 필요 골드 도달 시 실행 · Gold·해금 볼·꿀·코팅·사용 중 아이템 효과 초기화 · 망치·도감·보유 아이템 유지';
  for(const [prefix,parent] of [['rebirthAuto',$('rebirthConfirm')],['shopAuto',$('purchaseOwnedSection')]]){
   const box=document.createElement('section');box.id=prefix;box.hidden=true;box.className='auto-rebirth-controls';
   const button=document.createElement('button');button.id=prefix+'Toggle';button.type='button';button.className='btn';button.onclick=toggle;
   const info=document.createElement('p');info.textContent=help;box.append(button,info);parent.before(box);
  }
  const status=document.createElement('p');status.id='autoRebirthStatus';status.setAttribute('role','status');$('rebirthText').after(status);
  window.addEventListener('wakppu-account-restored',()=>{state=null;owner=null;++sequence;render();refresh();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  setInterval(()=>{if(!document.hidden)refresh();},15000);setInterval(tick,1000);refresh();
 });
 window.WakppuAutoRebirth={refresh};
})();
