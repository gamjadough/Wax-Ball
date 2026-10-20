(() => {
 let account=null,session=crypto.randomUUID(),samples=[],pending=null,busy=false,retryAt=0;
 const game=()=>window.WakppuItemGame?.read();
 function reset(){account=game()?.account;session=crypto.randomUUID();samples=[];pending=null;retryAt=0;}
 function record(e){
  const g=game();if(!g?.ready||g.test||g.blocked||document.hidden||e.isTrusted===false)return;
  if(account!==g.account)reset();
  const r=document.getElementById('ballSvg').getBoundingClientRect();if(!r.width||!r.height)return;
  const point=[Math.round(performance.now()),Math.round(Math.max(0,Math.min(1000,(e.clientX-r.left)/r.width*1000))),Math.round(Math.max(0,Math.min(1000,(e.clientY-r.top)/r.height*1000)))];
  samples.push(point);if(samples.length>512)samples.shift();
 }
 async function flush(){
  const g=game();if(busy||!g?.ready||g.test||g.blocked||document.hidden||Date.now()<retryAt)return;
  if(account!==g.account){reset();return;}
  if(!pending){if(!samples.length)return;pending={request_id:crypto.randomUUID(),session_id:session,samples};samples=[];}
  const user=account,request=pending;busy=true;
  try{
   const result=await WakppuAuth.invoke('input_report',request);
   if(user!==game()?.account)return;
   pending=null;retryAt=0;
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
 setInterval(flush,15000);
 window.WakppuInputGuard={record,flush,reset};
})();
