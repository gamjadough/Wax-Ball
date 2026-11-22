// Friends-only entry code. No password or password hash is shipped to browsers.
(() => {
 const cfg=window.WAKPPU_SERVER,root=document.documentElement,key='wakppu:friends-entry:v1';
 let open=!cfg?.friendGate,client=null,token='',resolveReady,pending;
 const noop=()=>{};
 if(open){root.classList.remove('friends-entry-pending');window.WakppuFriendGate={allowed:true,ready:()=>Promise.resolve(),headers:()=>({}),lock:noop};return;}
 root.classList.add('friends-entry-pending');
 const makePending=()=>{pending=new Promise(r=>{resolveReady=r;});};makePending();
 try{token=localStorage.getItem(key)||sessionStorage.getItem(key)||'';}catch{}
 const box=document.createElement('section');box.id='friendGate';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-labelledby','friendGateTitle');
 box.innerHTML='<form id="friendGateForm"><span class="friend-gate-icon" aria-hidden="true">🔒</span><h1 id="friendGateTitle">친구 서버</h1><p>입장 암호를 입력해주세요.</p><label for="friendGatePassword">입장 암호</label><input id="friendGatePassword" type="text" lang="ko" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="200" required><button id="friendGateSubmit" type="submit">입장하기</button><p id="friendGateStatus" role="status">입장 권한을 확인하고 있습니다…</p><details><summary>기존 계정으로 입장</summary><p>친구 서버에서 플레이한 계정으로 로그인하면 암호 없이 입장할 수 있습니다.</p><label for="friendGateEmail">이메일</label><input id="friendGateEmail" type="email" autocomplete="username"><label for="friendGateLoginPassword">계정 비밀번호</label><input id="friendGateLoginPassword" type="password" autocomplete="current-password"><button id="friendGateLogin" type="button">기존 계정 로그인</button></details><a href="../wakppuball-public/">공개 서버로 이동</a></form>';
 document.body.append(box);
 const style=document.createElement('style');style.textContent='html.friends-entry-pending body{overflow:hidden!important}html.friends-entry-pending body>*:not(#friendGate),html.friends-entry-pending body>*:not(#friendGate) *{visibility:hidden!important;pointer-events:none!important}#friendGate{position:fixed;inset:0;z-index:2147483647;background:#121722;color:#edf2fa;display:flex;align-items:center;justify-content:center;padding:24px;overflow:auto;font-family:system-ui,sans-serif}#friendGate[hidden]{display:none}#friendGate form{width:min(100%,380px);padding:28px;border:1px solid #3e506d;border-radius:22px;background:#1c2635}#friendGate h1{font-size:26px;margin:12px 0}#friendGate p{font-size:14px;line-height:1.6}#friendGate label{display:block;margin:22px 0 8px}#friendGate input,#friendGate button{box-sizing:border-box;width:100%;min-height:48px;border-radius:12px;font:inherit;padding:12px}#friendGate input{color:#fff;background:#101926;border:1px solid #667c9e}#friendGate button{margin-top:12px;border:0;background:#9acaff;color:#102035;font-weight:700;cursor:pointer}#friendGate a{color:#b2d5ff;font-size:14px}#friendGateStatus{min-height:24px}#friendGate button:disabled{opacity:.6}#friendGate .friend-gate-icon{font-size:30px}';
 document.head.append(style);
 const status=document.getElementById('friendGateStatus'),input=document.getElementById('friendGatePassword'),button=document.getElementById('friendGateSubmit');
 async function check(body,jwt){
  const response=await fetch(cfg.url+'/rest/v1/rpc/wakppu_friend_access',{method:'POST',headers:{'Content-Type':'application/json',apikey:cfg.anonKey,Authorization:'Bearer '+(jwt||cfg.anonKey),...(token?{'x-wakppu-access':token}:{})},body:JSON.stringify({b:body}),signal:AbortSignal.timeout(10000)});
  const result=await response.json();if(!response.ok)throw Error('입장 확인 서버에 연결하지 못했습니다. 다시 시도해주세요.');return result;
 }
 function unlock(result){
  if(result.token)token=result.token;if(token){try{localStorage.setItem(key,token);sessionStorage.setItem(key,token);}catch{}}
  open=true;box.hidden=true;root.classList.remove('friends-entry-pending');resolveReady();
  window.dispatchEvent(new Event('online'));
 }
 function lock(){
  if(open){open=false;makePending();}
  token='';try{localStorage.removeItem(key);sessionStorage.removeItem(key);}catch{}
  box.hidden=false;root.classList.add('friends-entry-pending');status.textContent='입장 암호를 입력해주세요.';input.focus();
 }
 box.querySelector('form').onsubmit=async event=>{
  event.preventDefault();button.disabled=true;status.textContent='확인 중…';
  try{const result=await check({mode:'unlock',password:input.value.normalize('NFC')});input.value='';if(result.allowed)unlock(result);else{status.textContent=result.error||'암호를 확인해주세요.';input.focus();}}
  catch(error){status.textContent=error.message;}
  finally{button.disabled=false;}
 };
 window.WakppuFriendGate={
  get allowed(){return open;},
  bind:async authClient=>{client=authClient;await initial;try{const {data:{session}}=await client.auth.getSession();if(session){const result=await check({mode:"check"},session.access_token);if(result.allowed)unlock(result);}}catch{if(!open)status.textContent="기존 로그인 확인에 실패했습니다. 암호 또는 계정 로그인으로 다시 시도해주세요.";}},
  ready:signal=>{if(open)return Promise.resolve();if(!signal)return pending;return new Promise((resolve,reject)=>{const cancel=()=>reject(new DOMException('Aborted','AbortError'));if(signal.aborted)return cancel();signal.addEventListener('abort',cancel,{once:true});pending.then(()=>{signal.removeEventListener('abort',cancel);resolve();});});},
  headers:()=>token?{'x-wakppu-access':token}:{},lock
 };
 const initial=check({mode:'check'}).then(result=>{if(result.allowed)unlock(result);else{token='';status.textContent='입장 암호를 입력해주세요.';input.focus();}}).catch(error=>{status.textContent=error.message;});
 document.getElementById('friendGateLogin').onclick=async()=>{
  const login=document.getElementById('friendGateLogin'),pass=document.getElementById('friendGateLoginPassword');
  if(!client){status.textContent='로그인 기능을 불러오는 중입니다. 잠시 후 다시 시도해주세요.';return;}
  login.disabled=true;
  try{const {data,error}=await client.auth.signInWithPassword({email:document.getElementById('friendGateEmail').value.trim(),password:pass.value});pass.value='';if(error)throw Error('이메일 또는 비밀번호를 확인해주세요.');const result=await check({mode:'check'},data.session.access_token);if(result.allowed)unlock(result);else status.textContent='플레이 기록이 없는 계정입니다. 입장 암호를 입력해주세요.';}
  catch(e){status.textContent=e.message;}finally{login.disabled=false;}
 };
})();
