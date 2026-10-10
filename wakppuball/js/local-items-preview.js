// Injected by the local server only. Never contacts production.
document.addEventListener('DOMContentLoaded',()=>{
  const panel=document.createElement('div');panel.className='local-items-preview';
  panel.style.cssText='position:fixed;right:8px;top:110px;z-index:100;padding:8px;background:#171923;border:1px solid #aa88ff;border-radius:10px;gap:6px;max-width:calc(100vw - 16px);box-sizing:border-box';
  const button=document.createElement('button');button.className='btn small';button.textContent='샘플 초기화 · 100Qi / 아이템 각 3개 / 천장 98';
  async function reset(){
    button.disabled=true;
    try{
      await WakppuAuth.signIn('guest','');
      const token=JSON.parse(sessionStorage.getItem('wakppu-local-session')).token;
      const res=await fetch('/local/items-demo',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:'{}'});
      if(!res.ok)throw new Error('샘플 준비 실패');
      await WakppuItemGame.restore();await WakppuItems.refresh();sessionStorage.setItem('wakppu-items-preview','1');button.textContent='샘플 초기화 · 100Qi / 각 3개 / 천장 98';
    }catch(e){button.textContent=e.message;}finally{button.disabled=false;}
  }
  button.onclick=reset;panel.append(button);document.body.append(panel);if(!sessionStorage.getItem('wakppu-items-preview'))reset();
  const reveal=document.createElement('button');reveal.className='btn small';reveal.textContent='5등급 공개 연출 미리보기 (무료)';
  reveal.onclick=()=>{const account=WakppuItemGame.read().account;if(!account)return;WakppuItems.openDraw();WakppuDrawReveal.start(['common_candle','rare_concentrated_honey','hero_haste_wax','legendary_destruction_core','transcendent_wax_heart'],account);WakppuItems.status('로컬 연출 샘플입니다. Gold 차감·아이템 추가 지급 없음.');};panel.append(reveal);
});
