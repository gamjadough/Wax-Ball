(() => {
 const {list,art}=WakppuHalloweenDecorData;let data=null,owner=null,busy=false,sequence=0,ui=[],retry=null,result=null,signature='',syncTimer=null,inFlight=null,retryDelay=1000;
 const read=()=>window.WakppuItemGame?.read(),ready=()=>read()?.ready&&!read().test&&!read().busy&&!read().blocked&&!busy&&!window.WakppuItems?.busy&&!window.WakppuSkins?.busy&&!window.WakppuLimited?.busy;
 function status(text){for(const n of ui)n.querySelector('.hdecor-status').textContent=text;}
 function render(){
  if(!ui.length)return;const available=ready()&&owner===read()?.account&&!!data,key=JSON.stringify([data,available,result]);if(signature===key)return;signature=key;
  for(const section of ui){const shop=section.id==='halloweenDecorShop';
   section.querySelector('.hdecor-balance').textContent='🍬 '+(data?.tokens||0)+'캔디 · 할로윈 조각 '+(data?.shards||0)+'개';
   const open=section.querySelector('.hdecor-open');if(open){open.disabled=!available||!data.active||BigInt(data.tokens)<100n;open.textContent=data&&!data.active?'상자 판매 기간 종료':'100캔디로 상자 1개 열기';}
   section.querySelector('.hdecor-grid').innerHTML=list.map(d=>{const owned=!!data?.owned[d.id],equipped=data?.equipped===d.id;return '<article class="hdecor-card">'+art(d.id)+'<strong>'+d.name+'</strong><small>'+(owned?data.admin_content_access?'개발자 상시 이용':'영구 보유':'미보유')+' · 각 1/3</small><p><b>'+d.effect+'</b><br>'+d.description+'</p><button class="btn" data-hdecor-action="'+(owned?d.kind==='use'?'use':'equip':shop?'inventory':'exchange')+'" data-hdecor-id="'+d.id+'" '+(!available||!owned&&!shop&&BigInt(data?.shards||0)<3n?'disabled':'')+'>'+(owned?d.kind==='use'?'사용':equipped?'장착 해제':'장착':shop?'펫 탭에서 조각 교환':'조각 3개로 선택 교환')+'</button></article>';}).join('');
   const clear=section.querySelector('.hdecor-unequip');clear.disabled=!available||!data.equipped;section.querySelector('.hdecor-stop').disabled=!available;section.querySelector('.hdecor-equipped').textContent='현재 장착: '+(list.find(d=>d.id===data?.equipped)?.name||'없음')+(data?.admin_content_access?' · 개발자는 세 펫 모두 바로 이용할 수 있습니다.':'');
   const box=section.querySelector('.hdecor-result'),d=list.find(d=>d.id===result?.item_id);box.hidden=!d;box.innerHTML=d?art(d.id)+'<p><strong>'+d.name+'</strong><br>'+(result.duplicate?'중복 획득 · 할로윈 조각 +1':result.exchanged?'조각 교환 완료 · 영구 보유':'새 펫 획득 · 영구 보유')+'</p>':'';
  }
 }
 function scheduleRefresh(delay=0){clearTimeout(syncTimer);syncTimer=null;if(!document.hidden)syncTimer=setTimeout(()=>{syncTimer=null;refresh();},delay);}
 async function refresh(){
  if(busy){scheduleRefresh(300);return;}clearTimeout(syncTimer);syncTimer=null;
  const id=read()?.account;if(owner!==id){++sequence;inFlight=null;data=null;owner=id;result=null;retry=null;WakppuHalloweenDecor.sync(id,null);}
  if(!id||!read()?.ready||read()?.blocked){render();return;}
  if(inFlight?.id===id)return inFlight.promise;
  const seq=++sequence,token={id,promise:null};inFlight=token;
  token.promise=(async()=>{
   try{const next=await WakppuAuth.invoke('halloween_cosmetics');if(seq!==sequence||id!==read()?.account)return;if(data&&next.decor_revision<data.decor_revision)return;data=next;retryDelay=1000;WakppuHalloweenDecor.sync(id,next);render();}
   catch(e){if(seq===sequence){status(e.message);if(e.status===401||e.status===403){data=null;WakppuHalloweenDecor.sync(id,null);render();}else{scheduleRefresh(retryDelay);retryDelay=Math.min(30000,retryDelay*2);}}}
   finally{if(inFlight===token)inFlight=null;}
  })();return token.promise;
 }
 async function transact(action,id=null){
  if(!ready()||!data)return;const account=read().account,key=action+':'+id;
  if(action==='open'&&!confirm('100캔디로 할로윈 펫 상자 1개를 열까요? 세 아이템은 각각 1/3 확률이며, 중복은 조각 1개로 바뀝니다.'))return;
  busy=true;++sequence;inFlight=null;render();status('처리 중…');if(!retry||retry.key!==key)retry={key,id:crypto.randomUUID()};
  try{
   await WakppuItemGame.flush();if(account!==read()?.account)return;
   const request={item_id:id,request_id:retry.id,item_revision:read().revision,decor_revision:data.decor_revision};let next;
   try{next=await WakppuAuth.invoke('halloween_decor_'+action,request);}catch(e){if(e.status)throw e;next=await WakppuAuth.invoke('halloween_decor_'+action,request);}
   if(account!==read()?.account)return;if(next.revision<read().revision||next.decor_revision<data.decor_revision)throw Error('최신 상태를 다시 불러와주세요.');
   data=next;retry=null;result=next.result?.item_id?next.result:result;WakppuItemGame.accept(next,true);WakppuHalloweenDecor.sync(account,next);
   if(action==='equip'&&!id)WakppuHalloweenDecor.stop();if(next.result?.used==='bat_swarm')WakppuHalloweenDecor.use();
   status(action==='open'?'상자를 열었습니다.':action==='exchange'?'선택 교환 완료':action==='use'?'박쥐 무리를 불렀습니다.':id?'펫을 장착했습니다.':'펫을 해제했습니다.');
   await window.WakppuLimited?.refresh();await window.WakppuItems?.refresh();await window.WakppuPumpkinInventory?.refresh();
  }catch(e){if(account===read()?.account)status(e.message);}
  finally{busy=false;render();await refresh();}
 }
 document.addEventListener('DOMContentLoaded',()=>{
  for(const [id,shop] of [['shopHalloween',true],['inventoryPetsPage',false]]){const parent=document.getElementById(id);if(!parent)continue;const section=document.createElement('section');section.className='hdecor-section';section.id=shop?'halloweenDecorShop':'halloweenDecorInventory';
   section.innerHTML='<h3>🎃 할로윈 펫'+(shop?' 상자':' 보관함')+'</h3><p>세 아이템 모두 같은 확률 · 각각 1/3 (약 33.33%)<br>펫 1마리 장착 · 기존 아이템 효과와 중첩 · 영구 보유 · 중복은 할로윈 조각 1개</p><p class="hdecor-balance"></p>'+(shop?'<button class="btn hdecor-open" type="button">100캔디로 상자 1개 열기</button>':'')+'<p class="hdecor-equipped"></p><div class="hdecor-actions"><button type="button" class="btn hdecor-unequip">펫 장착 해제</button><button type="button" class="btn hdecor-stop">펫 움직임 쉬기</button></div><p class="hdecor-status" role="status"></p><div class="hdecor-result" role="status" aria-live="polite" hidden></div><div class="hdecor-grid"></div><p>조각 교환은 인벤토리 → 펫에서 이용할 수 있습니다. 조각 3개로 원하는 미보유 펫을 선택 교환합니다. 세 펫 중 한 마리만 장착할 수 있으며, 장착 효과는 기존 아이템·환생·후원자 효과와 중첩됩니다. 시간 단축은 기존 효과 계산 후 ×0.9입니다. 상자 판매는 할로윈 이벤트 기간에만, 보유 펫·조각 교환은 종료 후에도 이용할 수 있습니다.</p>';
   section.addEventListener('click',e=>{if(e.target.closest('.hdecor-unequip'))transact('equip',null);if(e.target.closest('.hdecor-stop')){WakppuHalloweenDecor.stop();status('펫 움직임을 잠시 멈췄습니다. 장착 효과는 유지됩니다. 다시 장착하면 움직입니다.');}if(e.target.closest('.hdecor-open'))transact('open');const b=e.target.closest('[data-hdecor-action]');if(b?.dataset.hdecorAction==='inventory'){document.getElementById('inventoryBtn').click();document.getElementById('inventoryPetsTab').click();return;}if(b)transact(b.dataset.hdecorAction,b.dataset.hdecorAction==='equip'&&data?.equipped===b.dataset.hdecorId?null:b.dataset.hdecorId);});parent.prepend(section);ui.push(section);
  }
  for(const id of ['shopBtn','halloweenCurrency','inventoryBtn','inventoryPetsTab'])document.getElementById(id)?.addEventListener('click',refresh);
  // Defer until all auth listeners finish: the game can dispatch account-restored
  // inside the auth event. Clearing afterwards used to discard that restore.
  window.addEventListener('wakppu-account-restored',()=>scheduleRefresh());
  window.addEventListener('wakppu-auth-changed',event=>{const id=event.detail?.user?.id||null;if(owner!==id){++sequence;inFlight=null;data=null;owner=id;result=null;retry=null;signature='';retryDelay=1000;WakppuHalloweenDecor.sync(id,null);render();}scheduleRefresh();});
  window.addEventListener('pageshow',()=>scheduleRefresh());window.addEventListener('online',()=>scheduleRefresh());
  window.addEventListener('pagehide',()=>{clearTimeout(syncTimer);syncTimer=null;});
  window.addEventListener('wakppu-access-changed',()=>scheduleRefresh());
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(syncTimer);syncTimer=null;}else scheduleRefresh();});
  setInterval(()=>{if(ui.some(n=>n.getClientRects().length)){render();if(!busy)refresh();}},15000);scheduleRefresh();render();
 });
 window.WakppuHalloweenDecorUI={get busy(){return busy;},refresh};
})();
