// Injected only by the loopback server. Never contacts production accounts.
window.WakppuLocalRebirthPreview=async password=>{
  if(!WakppuAuth.local)return;
  const panel=document.createElement('aside');
  panel.style.cssText='position:fixed;bottom:8px;left:8px;z-index:30;background:#171722;color:white;padding:10px;border-radius:12px;max-width:calc(100vw - 16px);font-size:12px';
  panel.innerHTML='<div>1000환생 로컬 테스트 · 운영 데이터와 무관</div><button class="btn small" id="localRebirthReset">999환생으로 다시 준비</button><span id="localRebirthStatus"></span>';
  document.body.append(panel);
  async function prepare(){
    const button=panel.querySelector('button');button.disabled=true;
    try{
      const login=await WakppuAuth.signIn('dodoonglee@gmail.com',password);if(login.error)throw login.error;
      const {state}=await WakppuAuth.invoke('bootstrap');
      const user=(await WakppuAuth.session()).data.session.user;
      await WakppuAuth.invoke('admin_gold',{user_id:user.id,mode:'set',value:REBIRTH_COSTS[999].toString()});
      await WakppuAuth.invoke('admin_rebirths',{user_id:user.id,mode:'set',value:'999'});
      await WakppuGameTest.restoreAccount();
      sessionStorage.setItem('wakppu-rebirth500-prepared','1');
      panel.querySelector('span').textContent=' · 상단 환생 버튼을 눌러보세요';
    }catch(error){panel.querySelector('span').textContent=error.message;}
    finally{button.disabled=false;}
  }
  panel.querySelector('button').onclick=prepare;
  if(!sessionStorage.getItem('wakppu-rebirth500-prepared'))await prepare();
  else await WakppuGameTest.restoreAccount();
  panel.dataset.ready='true';
};
