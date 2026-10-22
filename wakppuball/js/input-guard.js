(() => {
 let account=null,session=crypto.randomUUID(),samples=[],head=0,pending=null,busy=false,retryAt=0,noticeUntil=0,noticeTimer=null;
 const game=()=>window.WakppuItemGame?.read();
 function notice(until){
  const el=document.getElementById('inputGuardNotice');clearTimeout(noticeTimer);noticeUntil=Number.isFinite(Date.parse(until))?Date.parse(until):0;
  if(!el)return;el.hidden=noticeUntil<=Date.now();
  el.textContent='반복·과속 입력이 감지되어 잠시 입력 속도가 제한됩니다. 잠시 쉬었다가 자연스러운 속도로 플레이해주세요.';
  if(!el.hidden)noticeTimer=setTimeout(()=>{el.hidden=true;noticeUntil=0;},Math.min(60000,noticeUntil-Date.now()));
 }
 function reset(){account=game()?.account;session=crypto.randomUUID();samples=[];head=0;pending=null;retryAt=0;notice(null);}
 function record(e){
  const g=game();if(!g?.ready||g.test||g.blocked||document.hidden||e.isTrusted===false)return;
  if(account!==g.account)reset();
  const r=document.getElementById('ballSvg').getBoundingClientRect();if(!r.width||!r.height)return;
  const point=[Math.round(performance.now()),Math.round(Math.max(0,Math.min(1000,(e.clientX-r.left)/r.width*1000))),Math.round(Math.max(0,Math.min(1000,(e.clientY-r.top)/r.height*1000)))];
  const configured=globalThis.WakppuInputGuardRules?.policy?.maxSamples;
  const cap=Number.isInteger(configured)&&configured>=1&&configured<=2048?configured:2048;
  if(samples.length<cap)samples.push(point);else{samples[head]=point;head=(head+1)%cap;}
 }
 async function flush(){
  const g=game();if(busy||!g?.ready||g.test||g.blocked||document.hidden||Date.now()<retryAt)return;
  if(account!==g.account){reset();return;}
  if(!pending){if(!samples.length)return;pending={request_id:crypto.randomUUID(),session_id:session,samples:head?samples.slice(head).concat(samples.slice(0,head)):samples};samples=[];head=0;}
  const user=account,request=pending;busy=true;
  try{
   const result=await WakppuAuth.invoke('input_report',request);
   if(user!==game()?.account)return;
   pending=null;retryAt=0;
   notice(result.input_guard?.speed_limited_until);
   if(result.input_guard?.restricted_until)await WakppuItemGame.restore();
  }catch(e){
   if(user!==game()?.account)return;
   retryAt=Date.now()+15000;
   // A lost response may be retried with the same request ID, never new evidence.
   if(e.status&&e.status!==429)pending=null;
  }finally{busy=false;}
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
 window.addEventListener('wakppu-account-restored',reset);
 document.addEventListener('DOMContentLoaded',()=>{const el=document.createElement('p');el.id='inputGuardNotice';el.className='input-guard-notice';el.setAttribute('role','status');el.hidden=true;document.querySelector('#game .top').append(el);});
 setInterval(flush,15000);
 window.WakppuInputGuard={record,flush,reset};
})();
