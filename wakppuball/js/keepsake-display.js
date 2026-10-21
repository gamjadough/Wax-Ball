// Cosmetic only: ownership comes from the accepted inventory, never local storage.
(() => {
 const item='developer_piercing_fragment',duration=10*60*1000,key=id=>'wakppuball:keepsake-display:'+id;
 let account=null,owned=false,expires=0,node=null,timer=null;
 const game=()=>window.WakppuItemGame?.read();
 function clear(){clearTimeout(timer);timer=null;node?.remove();node=null;}
 function save(value){try{value?localStorage.setItem(key(account),String(value)):localStorage.removeItem(key(account));}catch(_){}}
 function render(){
  clearTimeout(timer);timer=null;
  const s=game(),left=expires-Date.now();
  if(left<=0){if(expires)save(0);expires=0;clear();return;}
  if(!owned||s?.account!==account||document.hidden){clear();return;}
  if(!s.ready||s.test||s.blocked){clear();timer=setTimeout(render,Math.min(1000,left));return;}
  if(!node){
   node=document.createElement('div');node.id='keepsakeDisplay';node.setAttribute('aria-hidden','true');
   node.innerHTML='<img src="images/items/developer-piercing-fragment.webp" width="56" height="56" alt="" decoding="async" draggable="false"><span></span>';
   document.getElementById('stage').append(node);
  }
  const seconds=Math.ceil(left/1000);node.querySelector('span').textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
  timer=setTimeout(render,Math.min(1000,left));
 }
 function sync(data){
  const id=game()?.account;
  if(id!==account){clear();account=id;expires=0;}
  owned=!!id&&data?.inventory?.[item]>0;
  if(!owned){expires=0;if(account)save(0);clear();return;}
  try{expires=Number(localStorage.getItem(key(account)))||expires;}catch(_){}
  if(!Number.isFinite(expires)||expires>Date.now()+duration)expires=0;
  render();
 }
 function start(id){if(!owned||!id||id!==account||id!==game()?.account)return;expires=Date.now()+duration;save(expires);render();}
 window.addEventListener('wakppu-auth-changed',e=>{if(e.detail?.user?.id!==account){clear();account=null;owned=false;expires=0;}});
 window.addEventListener('wakppu-account-restored',()=>{if(game()?.account!==account||!game()?.ready)clear();else render();});
 document.addEventListener('visibilitychange',render);
 window.addEventListener('pagehide',clear);
 window.addEventListener('pageshow',render);
 window.addEventListener('storage',e=>{if(account&&e.key===key(account)){expires=Number(e.newValue)||0;if(!Number.isFinite(expires)||expires>Date.now()+duration)expires=0;render();}});
 window.WakppuKeepsakeDisplay={sync,start};
})();
