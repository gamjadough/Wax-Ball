// A single, non-buffering foreground scheduler. Hits use the authoritative game pipeline.
(() => {
 let timer=null,busy=false,paused=false,pageActive=true,button=null,owner=null;
 function account(next=window.WakppuItemGame?.read()?.account||null){if(next!==owner){owner=next;paused=false;}}
 const equipped=()=>window.WakppuHalloweenDecor?.equipped?.()==='pumpkin_ember';
 const foreground=()=>pageActive&&!document.hidden&&document.hasFocus();
 const allowed=()=>foreground()&&!document.querySelector('.modal:not([hidden]),dialog[open]')&&window.WakppuEmberGame?.ready?.();
 function render(){
  if(!button)return;button.hidden=!equipped();button.setAttribute('aria-pressed',String(!paused));
  button.textContent=paused?'🔥 불씨 자동 공격 · 다시 시작':'🔥 불씨 자동 공격 · 일시정지';
 }
 function stop(){clearTimeout(timer);timer=null;render();}
 function arm(){
  render();if(timer!==null||busy||paused||!equipped()||!foreground())return;
  timer=setTimeout(tick,1000);
 }
 async function tick(){
  timer=null;if(paused||!equipped()||!foreground()){render();return;}
  if(!allowed()){arm();return;}
  busy=true;
  try{await window.WakppuEmberGame.hit();}
  catch{window.WakppuHalloweenDecorUI?.refresh();}
  finally{busy=false;arm();}
 }
 function toggle(){paused=!paused;stop();arm();}
 document.addEventListener('DOMContentLoaded',()=>{
  account();
  button=document.createElement('button');button.id='emberAutoToggle';button.type='button';button.className='btn ember-auto-toggle';button.hidden=true;
  button.title='게임 화면이 보일 때만 현재 망치로 공격합니다. 메뉴·공 파괴 연출·재생성 중에는 대기합니다.';button.onclick=toggle;
  document.getElementById('stage').append(button);arm();
 });
 window.addEventListener('wakppu-pet-synced',()=>{stop();arm();});
 window.addEventListener('wakppu-account-restored',()=>{account();stop();arm();});
 window.addEventListener('wakppu-auth-changed',event=>{account(event.detail?.user?.id||null);stop();arm();});
 window.addEventListener('wakppu-access-changed',()=>{stop();arm();});
 document.addEventListener('visibilitychange',()=>{stop();arm();});
 window.addEventListener('blur',stop);window.addEventListener('focus',arm);
 window.addEventListener('pagehide',()=>{pageActive=false;stop();});window.addEventListener('pageshow',()=>{pageActive=true;arm();});
 window.WakppuEmberAuto={toggle,read:()=>({paused,busy,equipped:equipped()})};
})();
