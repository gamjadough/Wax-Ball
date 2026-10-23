// Live candy exchange and inventory equipment. All ownership/role/balance checks are server-side.
(() => {
 const ballId=WakppuPumpkinSkins.ballId,profiles=WakppuPumpkinSkins.profiles;
 let data=null,owner=null,busy=false,sequence=0,ui=null,signature='';
 const read=()=>window.WakppuItemGame?.read();
 const def=id=>profiles.find(p=>'pumpkin_'+p.id===id);
 const ready=()=>read()?.ready&&!read().test&&!read().busy&&!read().blocked&&!window.wakppuServerBlocked&&!busy&&!window.WakppuItems?.busy&&!window.WakppuLimited?.busy&&!window.WakppuSkins?.busy;
 function equipped(){const p=owner===read()?.account&&data?.can_equip&&def(data?.equipped);return p&&data.owned['pumpkin_'+p.id]?p.id:null;}
 function status(message){if(ui)for(const n of ui.status)n.textContent=message;}
 function sounds(){const p=profiles.find(p=>p.id===equipped());if(p)SoundManager.init(p.sounds);}
 function render(){
  if(!ui||(document.getElementById('shop').hidden&&document.getElementById('itemsModal').hidden))return;const available=ready()&&!!data&&owner===read()?.account;
  for(const n of ui.balance)n.textContent='🍬 사탕 '+WakppuGold.compact(data?.tokens||'0')+'개 · 한 번 교환하면 영구 보유';
  const key=JSON.stringify([owner,data,available]);if(key===signature)return;signature=key;
  const cards=()=>profiles.map(p=>{
   const id='pumpkin_'+p.id,catalog=data?.catalog?.find(d=>d.skin_id===id),owned=!!data?.owned[id],selected=data?.equipped===id,cost=catalog?.cost||String(p.price);
   const ball=WakppuPumpkinSkins.appearance(WakppuLimitedData.ball,p.id);
   const label=owned?(selected?'장착 해제':data.can_equip?'장착':'잭오랜턴 해금 후 장착'):'🍬 '+cost+'개로 교환';
   const disabled=!available||(owned?(!selected&&!data.can_equip):(!data.active||!catalog||BigInt(data.tokens)<BigInt(cost)));
   return '<article class="skin-card"><div class="skin-thumb">'+buildBallThumb(ball)+'</div><strong>'+p.name+'</strong><span>'+p.rank+' · '+(owned?(data.admin_content_access?'관리자 상시 이용':'보유'):'미보유')+'</span><small>'+ (owned?'환생·이벤트 종료 후에도 유지':data?.active?'사탕으로 확정 교환':'이벤트 기간에 교환 가능')+'</small><button class="btn small" data-pumpkin-'+(owned?'equip':'exchange')+'="'+id+'" '+(disabled?'disabled':'')+'>'+label+'</button></article>';
  }).join('');
  for(const n of ui.cards){n.innerHTML=cards();for(const svg of n.querySelectorAll('svg'))if(svg.querySelector('[data-eclipse-art]'))WakppuEclipsePumpkin.decorate({svg,reduced:window.WakppuSettings?.reduced()});}
  ui.unequip.disabled=ui.shopUnequip.disabled=!available||!data?.equipped;for(const button of ui.disableButtons){button.disabled=!available||(!data?.scare_optout_owned&&(!data?.active||BigInt(data?.tokens||0)<100n));button.textContent=data?.scare_optout_owned?(data.scare_disabled?'점프스케어 해제 효과 · 장착 해제':'점프스케어 해제 효과 · 장착'):'🍬 100캔디로 영구 구매';}
 }
 async function refresh(){
  if(busy)return;const account=read()?.account,seq=++sequence;
  if(owner!==account){data=null;owner=account;signature='';}
  if(!account||!read()?.ready){render();return;}
  try{const next=await WakppuAuth.invoke('pumpkin_skins');if(seq!==sequence||account!==read()?.account)return;if(data&&next.skin_revision<data.skin_revision)return;const prior=equipped();data=next;owner=account;sounds();if(prior!==equipped())window.WakppuSkinGame?.refresh();render();}
  catch(e){if(account===read()?.account){data=null;status(e.message);render();}}
 }
 async function transact(action,skinId,extra={}){
  if(!ready()||!data)return;const account=read().account,prior=equipped();busy=true;++sequence;render();status('처리 중…');
  try{
   await WakppuItemGame.flush();if(account!==read()?.account)throw Error('계정이 변경되었습니다.');
   const req={...extra,request_id:crypto.randomUUID(),item_revision:read().revision,skin_revision:data.skin_revision,skin_id:skinId,ball_id:ballId};
   let next;try{next=await WakppuAuth.invoke(action,req);}catch(e){if(e.status)throw e;next=await WakppuAuth.invoke(action,req);}
   if(account!==read()?.account)return;
   if(next.revision<read().revision||next.skin_revision<data.skin_revision)throw Object.assign(Error('최신 스킨 상태를 다시 불러옵니다.'),{status:409});
   data=next;owner=account;WakppuItemGame.accept(next,true);sounds();
   if(prior!==equipped())window.WakppuSkinGame?.refresh();
   await window.WakppuLimited?.refresh();await window.WakppuItems?.refresh();await window.WakppuSkins?.refresh();
   status(action==='pumpkin_scare_disable_equip'?(extra.enabled?'해제 효과를 장착했습니다. 점프스케어가 나오지 않습니다.':'해제 효과를 장착 해제했습니다. 점프스케어가 다시 나옵니다.'):action==='pumpkin_scare_disable_buy'?'점프스케어 영구 해제를 구매했습니다. 모든 잭오랜턴 스킨에도 적용됩니다.':action==='pumpkin_skin_exchange'?'스킨을 교환했습니다. 인벤토리 → 스킨에서 장착할 수 있습니다.':skinId?'스킨을 장착했습니다. 잭오랜턴 왁뿌볼에 적용됩니다.':'잭오랜턴 스킨을 해제했습니다.');
  }catch(e){if(account===read()?.account)status(e.message);}
  finally{busy=false;render();await refresh();}
 }
 document.addEventListener('DOMContentLoaded',()=>{
  const shop=document.getElementById('shopHalloween'),inventory=document.getElementById('inventorySkinsPage');if(!shop||!inventory)return;
  const section=where=>{const n=document.createElement('section');n.className='pumpkin-skin-section';n.innerHTML='<h3>🎃 잭오랜턴 전용 스킨</h3><p class="pumpkin-skin-balance"></p><p class="pumpkin-skin-note">꾸미기 전용 · 보상·균열 난이도는 동일합니다.<br>교환은 할로윈 기간에만 가능하며, 장착에는 잭오랜턴 해금이 필요합니다.</p><p class="pumpkin-skin-status" role="status"></p><div class="skin-cards pumpkin-skin-cards"></div>';where.append(n);return n;};
  const a=section(shop),b=section(inventory),unequip=document.createElement('button');unequip.id='pumpkinSkinUnequip';unequip.className='btn';unequip.textContent='잭오랜턴 스킨 해제';b.append(unequip);
  const shopUnequip=unequip.cloneNode(true);shopUnequip.id='pumpkinSkinShopUnequip';a.append(shopUnequip);
  const optout=document.createElement('article');optout.className='purchase-card';optout.innerHTML='<h3>점프스케어 해제권</h3><p>100캔디 · 계정당 1회 구매 · 구매 후 영구 보유 · 무료 장착/해제</p><p>기본 잭오랜턴과 모든 전용 스킨의 갑작스러운 전체화면 이미지·깜짝 소리를 해제합니다. 파괴 연출·일반 효과음·보상은 유지됩니다. 환생·스킨 변경·시즌 종료 후에도 보유하며 장착/해제로 효과를 켜고 끌 수 있습니다.</p><button id="pumpkinScareDisable" class="btn">🍬 100캔디로 영구 구매</button>';a.append(optout);optout.querySelector('button').onclick=()=>{if(data?.scare_optout_owned){transact('pumpkin_scare_disable_equip',null,{enabled:!data.scare_disabled});return;}if(confirm('100캔디로 점프스케어 해제 상품을 영구 구매할까요? 장착 시 모든 잭오랜턴 스킨에 적용되며 장착/해제는 무료입니다.'))transact('pumpkin_scare_disable_buy',null);};
  const inventoryOptout=optout.cloneNode(true);inventoryOptout.querySelector('button').id='pumpkinScareDisableInventory';inventoryOptout.querySelector('button').onclick=optout.querySelector('button').onclick;b.append(inventoryOptout);
  ui={disableButtons:[optout,inventoryOptout].map(n=>n.querySelector('button')),balance:[a,b].map(n=>n.querySelector('.pumpkin-skin-balance')),status:[a,b].map(n=>n.querySelector('.pumpkin-skin-status')),cards:[a,b].map(n=>n.querySelector('.pumpkin-skin-cards')),unequip,shopUnequip};
  const onClick=e=>{const exchange=e.target.closest('[data-pumpkin-exchange]'),equip=e.target.closest('[data-pumpkin-equip]');if(equip)transact('pumpkin_skin_equip',data?.equipped===equip.dataset.pumpkinEquip?null:equip.dataset.pumpkinEquip);if(exchange){const id=exchange.dataset.pumpkinExchange,p=def(id),cost=data?.catalog?.find(d=>d.skin_id===id)?.cost;if(p&&confirm(p.name+' 스킨을 사탕 '+cost+'개로 교환할까요?'))transact('pumpkin_skin_exchange',id);}};
  a.addEventListener('click',onClick);b.addEventListener('click',onClick);unequip.onclick=shopUnequip.onclick=()=>transact('pumpkin_skin_equip',null);
  for(const id of ['shopBtn','inventoryBtn','inventorySkinsTab','halloweenCurrency'])document.getElementById(id)?.addEventListener('click',refresh);
  window.addEventListener('wakppu-account-restored',refresh);setInterval(()=>{render();},1000);
  setInterval(()=>{if(!document.getElementById('shop').hidden||!document.getElementById('itemsModal').hidden)refresh();},15000);refresh();render();
 });
 window.WakppuPumpkinInventory={get busy(){return busy;},get data(){return data;},equipped,refresh,scareAllowed:()=>owner===read()?.account&&!!data&&!data.scare_disabled};
})();
