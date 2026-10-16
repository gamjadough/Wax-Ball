// Server-authoritative ownership, equip, shards and single-pull draw.
(() => {
 const defs=WakppuSkinSounds.profiles.map((p,i)=>({...p,skin_id:'eternity_'+p.id,rank:['일반','희귀','영웅','전설','초월'][i],weight:[7000,2200,600,190,10][i],duplicate:[1,3,10,30,100][i],exchange:[10,30,100,300,1000][i]}));
 const price=String(BigInt(WakppuItemData.prices[5])*10n),fmt=n=>WakppuGold.compact(n);
 let data=null,owner=null,busy=false,sequence=0,shopTab='items',inventoryTab='items',cardsMarkup='',ui=null;
 const read=()=>window.WakppuItemGame?.read();
 const preview=()=>window.WakppuAuth?.local&&new URLSearchParams(location.search).get('preview')==='skin-sounds';
 const ready=()=>read()?.ready&&!read().test&&!read().busy&&!read().blocked&&!busy&&!window.WakppuItems?.busy;
 const key=id=>'wakppu-skin-reveal:'+id;
 function loadSound(rank){const cfg=WakppuSkinSounds.config(rank);if(cfg)SoundManager.init(Object.values(cfg).flat());}
 const def=id=>defs.find(d=>d.skin_id===id);
 function pending(value,id=owner){try{if(value)localStorage.setItem(key(id),JSON.stringify(value));else localStorage.removeItem(key(id));}catch{}}
 function equippedRank(ballId){if(owner!==read()?.account||!data)return null;const d=def(data.equipped[ballId]);return d&&data.owned[d.skin_id]?d.id:null;}
 function status(text){if(ui){ui.status.textContent=text;ui.inventoryStatus.textContent=text;}}
 function render(){
  if(!ui)return;const available=ready()&&!!data&&owner===read()?.account;
  ui.draw.disabled=!available||BigInt(read()?.gold||0)<BigInt(price)||!!window.WakppuSkinCutscene?.active;
  ui.info.textContent='1회 '+fmt(price)+' G · 묶음 뽑기 없음 · 초월 천장 '+(data?.pity||0)+' / 100';
  ui.shards.textContent='스킨 조각: '+fmt(data?.shards||'0')+' · 환생해도 보유 스킨·조각·천장 유지';
  ui.gold.textContent='현재 Gold: '+fmt(read()?.gold||'0')+' G';
  const markup=defs.map(d=>{
   const owned=!!data?.owned[d.skin_id],equipped=data?.equipped.eternity===d.skin_id;
   const ball=WakppuSkinSounds.appearance({...WAKPPU_BALLS.find(b=>b.id==='eternity'),skinId:d.id});
   return '<article class="skin-card"><div class="skin-thumb">'+buildBallThumb(ball)+'</div><strong>'+d.name+'</strong><span>'+d.rank+' · '+(owned?'보유':'미보유')+'</span><small>중복: 조각 '+d.duplicate+'개 · 교환: '+d.exchange+'개</small>'+(owned?'<button class="btn small" data-skin-equip="'+d.skin_id+'" '+(!available||equipped||!data.can_equip?'disabled':'')+'>'+(equipped?'장착 중':!data?.can_equip?'영겁 해금 후 장착':'장착')+'</button>':'<button class="btn small" data-skin-exchange="'+d.skin_id+'" '+(!available||BigInt(data?.shards||0)<BigInt(d.exchange)?'disabled':'')+'>조각 '+d.exchange+'개로 교환</button>')+'</article>';
  }).join('');
  // SVG IDs differ per render; rebuild only when real inventory/transaction state changes.
  const signature=JSON.stringify([owner,data?.owned,data?.equipped,data?.shards,data?.can_equip,available]);
  if(signature!==cardsMarkup){ui.cards.innerHTML=markup;cardsMarkup=signature;}
  ui.unequip.disabled=!available||!data?.equipped.eternity;
 }
 async function refresh(){
  if(preview())return;
  const account=read()?.account,seq=++sequence;
  if(owner!==account){data=null;owner=account;cardsMarkup='';window.WakppuSkinCutscene?.close();}
  if(!account||!read()?.ready){render();return;}
  try{const next=await WakppuAuth.invoke('skins');if(seq!==sequence||account!==read()?.account)return;if(data&&next.skin_revision<data.skin_revision)return;const previous=equippedRank('eternity');data=next;owner=account;loadSound(equippedRank('eternity'));if(previous!==equippedRank('eternity'))window.WakppuSkinGame?.refresh();render();restoreReveal();}
  catch(e){status(e.message);render();}
 }
 function reveal(result){
  const d=def(result?.skin_id);if(!d)return;
  status(d.name+(result.duplicate?' 중복 · 스킨 조각 +'+result.shards_awarded:' 획득'));
  if(d.id==='transcendent'&&!result.duplicate){pending({skin_id:d.skin_id});restoreReveal();}
 }
 function restoreReveal(){
  if(!owner||!data||window.WakppuSkinCutscene?.active)return;
  let saved;try{saved=JSON.parse(localStorage.getItem(key(owner))||'null');}catch{return;}
  if(saved?.skin_id!=='eternity_transcendent'||!data.owned[saved.skin_id])return;
  const account=owner;
  WakppuSkinCutscene.open({production:true,canEquip:data.can_equip,onEquip:()=>transact('skin_equip',{ball_id:'eternity',skin_id:saved.skin_id},true),onClose:()=>pending(null,account)});
 }
 async function transact(action,payload={},throwErrors=false){
  if(!ready()||!data)return;
  const account=read().account;busy=true;++sequence;render();status('처리 중…');
  try{
   await WakppuItemGame.flush();
   if(account!==read()?.account)throw new Error('계정이 변경되었습니다.');
   const request={...payload,request_id:crypto.randomUUID(),item_revision:read().revision,skin_revision:data.skin_revision};
   let next;try{next=await WakppuAuth.invoke(action,request);}catch(e){if(e.status)throw e;next=await WakppuAuth.invoke(action,request);}
   if(account!==read()?.account)return;
   if(next.revision<read().revision||next.skin_revision<(data?.skin_revision||0)){await WakppuItemGame.restore();await refresh();return;}
   const previous=equippedRank('eternity');data=next;owner=account;
   WakppuItemGame.accept(next,true);
   loadSound(equippedRank('eternity'));
   if(previous!==equippedRank('eternity'))window.WakppuSkinGame?.refresh();
   status(action==='skin_equip'?'스킨 장착 상태를 저장했습니다.':'스킨 상태를 저장했습니다.');
   if(next.result)reveal(next.result);
   await WakppuItems.refresh();return next;
  }catch(e){status(e.message);if(e.status===409){await WakppuItemGame.restore();await refresh();}if(throwErrors)throw e;}
  finally{busy=false;render();}
 }
 function showDraw(mode){shopTab=mode;ui.itemDraw.hidden=mode!=='items';ui.skinDraw.hidden=mode!=='skins';ui.drawItems.setAttribute('aria-pressed',String(mode==='items'));ui.drawSkins.setAttribute('aria-pressed',String(mode==='skins'));if(mode==='skins')refresh();}
 function showInventory(mode){inventoryTab=mode;ui.items.hidden=mode!=='items';ui.skins.hidden=mode!=='skins';ui.inventoryItems.setAttribute('aria-pressed',String(mode==='items'));ui.inventorySkins.setAttribute('aria-pressed',String(mode==='skins'));if(mode==='skins')refresh();}
 document.addEventListener('DOMContentLoaded',()=>{
  if(preview())return;
  const shop=document.querySelector('#shopDraw'),modal=document.querySelector('#itemsModal'),sheet=modal.querySelector('.sheet'),header=sheet.querySelector('.sheet-head');
  const skinDraw=document.createElement('section');skinDraw.id='skinDrawPanel';skinDraw.hidden=true;
  skinDraw.innerHTML='<h3>영겁 전용 스킨 뽑기</h3><p id="skinDrawGold"></p><p id="skinDrawInfo"></p><button id="skinDrawOne" class="btn primary">1회 뽑기 — '+fmt(price)+' G</button><p>일반 70% · 희귀 22% · 영웅 6% · 전설 1.9% · 초월 0.1%<br>100번째 초월 확정 · 아이템 천장과 별도 · 같은 스킨은 조각으로 전환</p><p id="skinDrawStatus" role="status"></p>';
  shop.append(skinDraw);
  const drawNav=document.createElement('nav');drawNav.className='skin-switch';drawNav.setAttribute('aria-label','뽑기 종류');drawNav.innerHTML='<button class="btn small" id="drawItemsTab" aria-pressed="true">아이템</button><button class="btn small" id="drawSkinsTab" aria-pressed="false">스킨</button>';shop.append(drawNav);
  const items=document.createElement('div');items.id='inventoryItemsPage';for(const child of [...sheet.children])if(child!==header)items.append(child);sheet.append(items);
  const invNav=document.createElement('nav');invNav.className='skin-switch';invNav.setAttribute('aria-label','인벤토리 종류');invNav.innerHTML='<button class="btn small" id="inventoryItemsTab" aria-pressed="true">아이템</button><button class="btn small" id="inventorySkinsTab" aria-pressed="false">스킨</button>';header.after(invNav);
  const skins=document.createElement('section');skins.id='inventorySkinsPage';skins.hidden=true;skins.innerHTML='<h3>영겁의 왁뿌볼 전용 스킨</h3><p id="skinShardCount"></p><p id="skinInventoryStatus" role="status"></p><div id="skinCards" class="skin-cards"></div><button id="skinUnequip" class="btn">스킨 해제</button>';sheet.append(skins);
  ui={itemDraw:document.querySelector('#drawPanel'),skinDraw,items,skins,draw:skinDraw.querySelector('#skinDrawOne'),info:skinDraw.querySelector('#skinDrawInfo'),gold:skinDraw.querySelector('#skinDrawGold'),status:skinDraw.querySelector('#skinDrawStatus'),inventoryStatus:skins.querySelector('#skinInventoryStatus'),shards:skins.querySelector('#skinShardCount'),cards:skins.querySelector('#skinCards'),unequip:skins.querySelector('#skinUnequip'),drawItems:drawNav.querySelector('#drawItemsTab'),drawSkins:drawNav.querySelector('#drawSkinsTab'),inventoryItems:invNav.querySelector('#inventoryItemsTab'),inventorySkins:invNav.querySelector('#inventorySkinsTab')};
  ui.draw.onclick=()=>{WakppuSkinCutscene.unlockAudio();transact('skin_draw',{count:1});};ui.drawItems.onclick=()=>showDraw('items');ui.drawSkins.onclick=()=>showDraw('skins');ui.inventoryItems.onclick=()=>showInventory('items');ui.inventorySkins.onclick=()=>showInventory('skins');
  skins.addEventListener('click',e=>{const equip=e.target.closest('[data-skin-equip]'),exchange=e.target.closest('[data-skin-exchange]');if(equip)transact('skin_equip',{ball_id:'eternity',skin_id:equip.dataset.skinEquip});if(exchange&&confirm(def(exchange.dataset.skinExchange).name+'을(를) 조각으로 교환할까요?')){WakppuSkinCutscene.unlockAudio();transact('skin_exchange',{skin_id:exchange.dataset.skinExchange});}});ui.unequip.onclick=()=>transact('skin_equip',{ball_id:'eternity',skin_id:null});
  window.addEventListener('wakppu-account-restored',refresh);setInterval(render,1000);refresh();render();
 });
 window.WakppuSkins={get data(){return data;},get busy(){return busy;},equippedRank,refresh,render,syncShop:drawing=>{if(ui&&drawing)showDraw(shopTab);},syncInventory:()=>{if(ui)showInventory(inventoryTab);}};
})();
