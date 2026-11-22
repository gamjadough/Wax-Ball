document.addEventListener('DOMContentLoaded',async()=>{
 const box=document.createElement('section');box.className='halloween-local';box.setAttribute('aria-label','로컬 할로윈 테스트 도구');box.style.cssText='display:flex;flex-wrap:wrap;gap:8px;background:#252835;padding:12px;margin-top:12px;border-radius:12px';box.innerHTML='<button class="btn small" style="min-height:44px;max-width:100%;white-space:normal" data-demo="active">샘플 초기화 · 사탕 100개</button><button class="btn small" style="min-height:44px;max-width:100%;white-space:normal" data-demo="ended">기간 종료 테스트</button>';
 document.querySelector('#shop .sheet').append(box);
 async function demo(mode){await WakppuAuth.signIn('guest','');const s=JSON.parse(sessionStorage.getItem('wakppu-local-session'));const r=await fetch('/local/halloween-demo',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.token},body:JSON.stringify({mode})});if(!r.ok)throw new Error('샘플 준비 실패');await WakppuItemGame.restore();await WakppuLimited.refresh();sessionStorage.setItem('halloween-preview-ready','1');}
 box.onclick=e=>{const b=e.target.closest('[data-demo]');if(b)demo(b.dataset.demo);};
 if(sessionStorage.getItem('halloween-preview-ready')){try{await WakppuAuth.invoke('limited');}catch{sessionStorage.removeItem('halloween-preview-ready');}}
 if(!sessionStorage.getItem('halloween-preview-ready'))await demo('active');
});
