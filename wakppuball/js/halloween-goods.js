// Seasonal purchases and independent potion effects. Server owns stock and expiry.
(() => {
 const $=id=>document.getElementById(id),game=()=>window.WakppuItemGame?.read();
 const details={
  witch_potion:['🧙','최종 파괴 골드 ×1.5 · 30분','witch'],
  ghost_potion:['👻','파괴 모션 시간 50% 단축 · 30분','ghost'],
  pumpkin_potion:['🎃','재생성 대기 시간 50% 단축 · 30분','pumpkin'],
  halloween_witch:['🌙','초승달 아래 피어나는 보랏빛 마법진','witch'],
  halloween_ghost:['🏚️','달빛과 유령 불빛이 감도는 저택','ghost'],
  halloween_pumpkin:['🔥','수확의 달 아래 타오르는 호박불','pumpkin'],
  halloween_witch_title:['✦','마녀의 계약자','witch'],
  halloween_ghost_title:['✧','유령의 친구','ghost'],
  halloween_pumpkin_title:['✺','호박불의 수호자','pumpkin']
 };
 let data=null,owner=null,busy=false,sequence=0,retry=null,offset=0,signature='',profile=null;
 const ready=()=>data&&owner===game()?.account&&game()?.ready&&!game().busy&&!game().test&&!game().blocked&&!busy&&!window.WakppuSkins?.busy&&!window.WakppuItems?.busy;
 const now=()=>Date.now()+offset;
 function accept(next){if(!next||owner!==game()?.account)return;if(data&&next.revision<data.revision)return;if(!data&&!next.catalog)return;data={...data,...next};if(Number.isFinite(next.server_time))offset=next.server_time-Date.now();render();}
 function message(text){document.querySelectorAll('.hgoods-status').forEach(n=>n.textContent=text);}
 function render(){
  const {server_time,...view}=data||{};const key=JSON.stringify([view,!!ready(),profile]);
  if(key!==signature){signature=key;
   for(const section of document.querySelectorAll('.hgoods-section')){
    const shop=section.id==='halloweenGoodsShop';
    section.querySelector('.hgoods-balance').textContent='🍬 '+(data?.tokens||'0')+'캔디'+(data?.admin_access?' · 관리자 상시 이용':'');
    section.querySelector('.hgoods-grid').innerHTML=(data?.catalog||[]).filter(d=>shop||data.admin_access||Number(data.stock[d.id])>0||d.kind==='potion'&&data.expires[d.id]>now()).map(d=>{
     const [icon,description,theme]=details[d.id]||['✦',d.name,'witch'],owned=data.admin_access||Number(data.stock[d.id])>0;
     const selected=d.kind==='card'?profile?.equipped===d.id:d.kind==='title'?profile?.title_equipped===d.id:false;
     const action=shop?'buy':d.kind==='potion'?'use':selected?'unequip':'equip';
     const disabled=!ready()||(shop?data.admin_access||!data.active||d.kind!=='potion'&&owned||BigInt(data.tokens)<BigInt(d.price):!owned);
     const label=shop?data.admin_access?'관리자 바로 이용':d.kind!=='potion'&&owned?'보유 중':!data.active?'판매 종료':d.price+'캔디로 구매':d.kind==='potion'?'사용 · 30분 추가':selected?'장착 해제':'장착';
     const art=d.image?'<img src="'+d.image+'" alt="'+d.name+' 카드 삽화" width="960" height="640" loading="lazy" decoding="async">':'<div class="hgoods-icon" aria-hidden="true">'+icon+'</div>';
     return '<article class="hgoods-card" data-theme="'+theme+'">'+art+'<small>할로윈 한정 · '+(d.kind==='potion'?'소모품':d.kind==='card'?'프로필 카드':'칭호')+'</small><h4>'+d.name+'</h4><p>'+description+'</p><p>'+(d.kind==='potion'?'보유 '+(data.admin_access?'∞':data.stock[d.id]||0)+'개':'영구 보유 · 능력치 없음')+'</p>'+(d.kind==='potion'?'<p class="hgoods-time" data-potion="'+d.id+'"></p>':'')+'<button type="button" class="btn" data-goods-action="'+action+'" data-goods-id="'+d.id+'" '+(disabled?'disabled':'')+'>'+label+'</button></article>';
    }).join('')||'<p>보유한 한정 아이템이 없습니다. 할로윈 상점에서 구매할 수 있습니다.</p>';
   }
  }
  document.querySelectorAll('[data-potion]').forEach(n=>{const left=Math.max(0,Math.ceil(((data?.expires[n.dataset.potion]||0)-now())/1000));n.textContent=left?'효과 남음 '+Math.floor(left/60)+':'+String(left%60).padStart(2,'0'):'활성 효과 없음';});
 }
 async function refresh(){
  if(busy)return;const id=game()?.account,seq=++sequence;
  if(owner!==id){owner=id;data=null;profile=null;retry=null;signature='';render();}
  if(!id||!game()?.ready||game().blocked)return;
  try{const [next,p]=await Promise.all([WakppuAuth.invoke('halloween_goods'),WakppuAuth.invoke('profile_status')]);if(seq!==sequence||id!==game()?.account)return;profile=p;accept(next);}
  catch(e){if(seq===sequence)message(e.message);}
 }
 async function transact(action,id){
  if(!ready())return;const account=owner,d=data.catalog.find(d=>d.id===id);if(!d)return;
  if(action==='buy'&&!confirm(d.name+'을(를) '+d.price+'캔디로 구매할까요?'))return;
  busy=true;++sequence;render();message('처리 중…');
  try{
   await WakppuItemGame.flush();if(account!==game()?.account)return;
   if(action==='buy'||action==='use'){
    const key=action+':'+id;if(retry?.key!==key)retry={key,request:{id,goods_revision:data.revision,request_id:crypto.randomUUID()}};
    let next;try{next=await WakppuAuth.invoke('halloween_goods_'+action,retry.request);}catch(e){if(e.status)throw e;next=await WakppuAuth.invoke('halloween_goods_'+action,retry.request);}
    if(account!==game()?.account)return;retry=null;accept(next);
   }else{
    const a=d.kind==='card'?'profile_equip':'profile_title',payload=d.kind==='card'?{card_id:action==='unequip'?null:id}:{title_id:action==='unequip'?'none':id};
    const p=await WakppuAuth.invoke(a,payload);if(account!==game()?.account)return;profile=p;
   }
   message(action==='buy'?'구매했습니다. 인벤토리 → 아이템 → 한정에서 사용하세요.':action==='use'?'포션 효과가 30분 추가되었습니다. 기존 아이템과 중첩됩니다.':action==='unequip'?'장착을 해제했습니다.':'장착했습니다.');
   await window.WakppuLimited?.refresh();await window.WakppuProfiles?.refresh?.();
  }catch(e){if(account===game()?.account){if(e.status)retry=null;message(e.message);}}
  finally{busy=false;render();await refresh();}
 }
 document.addEventListener('DOMContentLoaded',()=>{
  for(const [id,parent] of [['halloweenGoodsInventory',$('inventoryBrowse')],['halloweenGoodsShop',$('shopHalloween')]]){
   const section=document.createElement('section');section.id=id;section.className='hgoods-section';section.hidden=id==='halloweenGoodsInventory';
   section.innerHTML='<h3>🎃 할로윈 한정 아이템</h3><p class="hgoods-balance"></p><p>포션은 기존 아이템·펫·환생·후원 효과와 별도로 중첩됩니다. 서로 다른 포션은 동시 사용, 같은 포션은 시간만 추가됩니다. 최대 7일 · 미접속 중에도 시간 경과 · 환생 후 유지.</p><p>카드·칭호는 영구 보유합니다. 판매 종료 후에도 이곳에서 사용할 수 있습니다.</p><p class="hgoods-status" role="status" aria-live="polite"></p><div class="hgoods-grid"></div>';
   if(id==='halloweenGoodsInventory')parent.querySelector('.item-filters').after(section);else parent.append(section);
   section.addEventListener('click',e=>{const b=e.target.closest('[data-goods-action]');if(b)transact(b.dataset.goodsAction,b.dataset.goodsId);});
  }
  for(const id of ['inventoryBtn','halloweenCurrency','inventoryItemsTab'])$(id)?.addEventListener('click',refresh);
  document.querySelector('[data-filter="limited"]').addEventListener('click',refresh);
  for(const event of ['wakppu-account-restored','wakppu-auth-changed','wakppu-access-changed'])window.addEventListener(event,()=>{if(owner!==game()?.account){data=null;profile=null;retry=null;owner=null;++sequence;render();}setTimeout(refresh,0);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  setInterval(()=>{if(!document.hidden){render();}},1000);refresh();
 });
 window.WakppuHalloweenGoods={refresh,accept,timing:(base,snapshot)=>{const t=snapshot?.timing||{animation:1,respawn:1};return {animation:base.animation*t.animation,respawn:base.respawn*t.respawn};}};
})();
