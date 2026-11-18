(() => {
 const $=id=>document.getElementById(id),cfg=WAKPPU_SERVER;
 let account=null,allowed=false,authVersion=0,currentPage=new URLSearchParams(location.search).has('order')?'payments':'players';
 $('serverSelect').value=cfg.id;$('serverName').textContent=cfg.name;
 for(const a of document.querySelectorAll('[data-game-link]'))a.href=cfg.game;
 $('serverSelect').onchange=()=>{location.href='?server='+$('serverSelect').value;};
 function lock(message){
  if(allowed){
   for(const id of ['adminLogs','adminResults','adminPlayerInfo','purchaseAdminOrders','inputGuardRows','guestLifecycleRows','adminPaidHistory'])$(id)?.replaceChildren();
   const form=$('purchaseConfigForm');if(form){form.reset();delete form.dataset.dirty;}
   window.dispatchEvent(new Event('wakppu-admin-locked'));
  }
  allowed=false;$('admin').hidden=true;$('adminBtn').hidden=true;$('adminNav').hidden=true;
  $('adminLogout').hidden=!account;$('loginSection').hidden=false;
  $('loginStatus').textContent=message||'관리자 계정으로 로그인하세요.';
 }
 async function session(){
  const v=++authVersion;const {data,error}=await WakppuAuth.session();
  if(v!==authVersion)return;
  account=error?null:data.session?.user||null;
  if(!account||account.is_anonymous){lock(account?'이메일로 로그인한 관리자만 이용할 수 있습니다.':'관리자 계정으로 로그인하세요.');return;}
  $('adminIdentity').textContent=account.email||'';
 }
 function accept(status){
  if(!account||account.is_anonymous||status.role!=='admin'||status.moderation?.blocked){lock(account?'관리자 권한이 없는 계정입니다.':'관리자 계정으로 로그인하세요.');return;}
  allowed=true;$('loginSection').hidden=true;$('admin').hidden=false;$('adminNav').hidden=false;
  $('adminBtn').hidden=false;$('adminLogout').hidden=false;
  $('serverHealth').textContent=status.maintenance?'점검 중':'운영 중';
  const select=$('adminBackgroundMode');
  if(cfg.id==='public'){for(const option of [...select.options])if(option.value!=='default')option.remove();select.value='default';}
  showPage(currentPage);
 }
 function eventStatus(data,type){
  const key=type==='gold'?'gold_event':'admin_ball_event',manual=type==='gold'?'manual_gold_event':'manual_ball_event';
  const event=Object.hasOwn(data,manual)?data[manual]:data[key];
  const active=event&&Date.parse(event.ends_at)>Date.parse(data.server_time);
  $(type==='gold'?'adminGoldEventInfo':'adminBallEventInfo').textContent=active?
   new Date(event.starts_at).toLocaleString('ko-KR')+' ~ '+new Date(event.ends_at).toLocaleString('ko-KR'):'수동 이벤트 없음';
  $(type==='gold'?'adminGoldEventStop':'adminBallEventStop').disabled=!active;
 }
 function category(section){
  const t=section.querySelector('h3')?.textContent||'';
  if(/이벤트|골드 타임|시각 지정|반복/.test(t))return 'events';
  if(/점검|공지|배경/.test(t))return 'server';
  if(/유료 상점/.test(t))return 'payments';
  if(/기록|입력 감지/.test(t))return 'logs';
  if(/테스트/.test(t))return 'preview';
  if(/미플레이/.test(t))return 'guests';
  return 'players';
 }
 function showPage(page){
  currentPage=page;
  for(const s of $('admin').querySelectorAll('.admin-sheet > section')){s.dataset.adminPage=category(s);s.hidden=s.dataset.adminPage!==page;}
  $('adminKeepsakeOpen').hidden=page!=='players';
  $('adminSelectionStatus').hidden=page!=='players';
  for(const b of $('adminNav').querySelectorAll('button'))b.setAttribute('aria-current',b.dataset.page===page?'page':'false');
  if(page==='payments'&&allowed)window.WakppuPurchases?.refresh();
 }
 window.WakppuAdminSite={accept,lock,preview:(mode,ball='yellow',honey=600)=>{
  const url=new URL(cfg.game,location.href);url.searchParams.set('admin-preview',mode);url.searchParams.set('ball',ball);url.searchParams.set('honey',String(honey));location.href=url.href;
 }};
 window.WakppuGoldEvent={update:d=>eventStatus(d,'gold')};
 window.WakppuAdminBallEvent={update:d=>eventStatus(d,'ball')};
 window.WakppuItemGame={read:()=>({account:account?.id||null,ready:allowed,busy:false,blocked:!allowed})};
 $('adminLoginForm').onsubmit=async e=>{
  e.preventDefault();lock('로그인 중…');$('adminLogin').disabled=true;
  try{const {error}=await WakppuAuth.signIn($('adminEmail').value.trim(),$('adminPassword').value);if(error)throw error;
   $('adminPassword').value='';await session();window.dispatchEvent(new Event('wakppu-account-restored'));
  }catch(error){lock(error.message||'로그인에 실패했습니다.');}
  finally{$('adminLogin').disabled=false;}
 };
 $('adminLogout').onclick=async()=>{lock('로그아웃 중…');await WakppuAuth.client.auth.signOut({scope:'local'});account=null;$('adminIdentity').textContent='';lock();};
 window.addEventListener('wakppu-auth-changed',()=>{lock();session();});
 document.addEventListener('DOMContentLoaded',()=>{
  for(const b of $('adminNav').querySelectorAll('button'))b.onclick=()=>showPage(b.dataset.page);
  showPage(currentPage);session();
 });
 session();
})();
