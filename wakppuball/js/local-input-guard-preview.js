// Injected only by the opted-in loopback preview; production index never includes this file.
window.WakppuLocalInputGuardPreview=password=>{
 document.addEventListener('DOMContentLoaded',()=>{
  const panel=document.createElement('details');panel.open=true;panel.style.cssText='position:fixed;right:10px;top:65px;z-index:60;max-width:min(310px,calc(100vw - 20px));max-height:65vh;overflow:auto;background:#252a38;color:#fff;padding:12px;border:1px solid #9aa2b4;border-radius:12px';
  panel.innerHTML='<summary>입력 감지 · 로컬 샘플 테스트</summary><p>운영 계정과 연결되지 않습니다. 모든 조건은 테스트용 시간과 샘플 입력으로 재현합니다.</p><div style="display:flex;gap:8px;flex-wrap:wrap">'+[['normal','불규칙 터치'],['fixed','같은 위치 · 느린 터치'],['macro','복수 신호 3회'],['rate','서버 속도 제한'],['reset','샘플 제한 해제']].map(([mode,label])=>'<button class="btn small" style="min-height:44px" data-input-demo="'+mode+'">'+label+'</button>').join('')+'<button id="guardDemoAdmin" class="btn small" style="min-height:44px">관리자 기록 보기</button></div><pre id="guardDemoResult" style="white-space:pre-wrap"></pre>';
  document.body.append(panel);
  async function guest(){await WakppuAuth.signIn('guest','');await WakppuItemGame.restore();}
  guest();
  panel.onclick=async e=>{
   const b=e.target.closest('[data-input-demo]');if(!b)return;
   panel.querySelectorAll('button').forEach(x=>x.disabled=true);
   try{await WakppuAuth.signIn('guest','');const session=JSON.parse(sessionStorage.getItem('wakppu-local-session'));const response=await fetch('/local/input-guard-demo',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.token},body:JSON.stringify({mode:b.dataset.inputDemo})});const r=await response.json();if(!response.ok)throw new Error(r.error);document.getElementById('guardDemoResult').textContent=JSON.stringify({sample:r.sample,status:r.moderation.status,score:r.result?.input_guard?.score,throttled:r.result?.throttled,reason:r.moderation.last_reason},null,2);await WakppuItemGame.restore();}
   catch(error){document.getElementById('guardDemoResult').textContent=error.message;}
   finally{panel.querySelectorAll('button').forEach(x=>x.disabled=false);}
  };
  document.querySelector('#admin [data-close="admin"]').addEventListener('click',()=>{panel.hidden=false;});
  document.getElementById('guardDemoAdmin').onclick=async()=>{const r=await WakppuAuth.signIn('dodoonglee@gmail.com',password);if(r.error)return;await WakppuItemGame.restore();panel.hidden=true;document.getElementById('adminBtn').click();};
 });
};
