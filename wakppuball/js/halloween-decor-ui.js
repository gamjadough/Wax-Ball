(() => {
 const {list,art}=WakppuHalloweenDecorData;let data=null,owner=null,busy=false,sequence=0,ui=[],retry=null,result=null,signature='';
 const read=()=>window.WakppuItemGame?.read(),ready=()=>read()?.ready&&!read().test&&!read().busy&&!read().blocked&&!busy&&!window.WakppuItems?.busy&&!window.WakppuSkins?.busy&&!window.WakppuLimited?.busy;
 function status(text){for(const n of ui)n.querySelector('.hdecor-status').textContent=text;}
 function render(){
  if(!ui.length)return;const available=ready()&&owner===read()?.account&&!!data,key=JSON.stringify([data,available,result]);if(signature===key)return;signature=key;
  for(const section of ui){
   section.querySelector('.hdecor-balance').textContent='🍬 '+(data?.tokens||0)+'캔디 · 할로윈 조각 '+(data?.shards||0)+'개';
   const open=section.querySelector('.hdecor-open');if(open){open.disabled=!available||!data.active||BigInt(data.tokens)<100n;open.textContent=data&&!data.active?'상자 판매 기간 종료':'100캔디로 상자 1개 열기';}
   section.querySelector('.hdecor-grid').innerHTML=list.map(d=>{const owned=!!data?.owned[d.id],equipped=data?.equipped===d.id;return '<article class="hdecor-card">'+art(d.id)+'<strong>'+d.name+'</strong><small>'+(owned?'영구 보유':'미보유')+' · 각 1/3</small><p>'+d.description+'</p><button class="btn" data-hdecor-action="'+(owned?d.kind==='use'?'use':'equip':'exchange')+'" data-hdecor-id="'+d.id+'" '+(!available||!owned&&BigInt(data?.shards||0)<3n?'disabled':'')+'>'+(owned?d.kind==='use'?'사용':equipped?'장착 해제':'장착':'조각 3개로 선택 교환')+'</button></article>';}).join('');
   const box=section.querySelector('.hdecor-result'),d=list.find(d=>d.id===result?.item_id);box.hidden=!d;box.innerHTML=d?art(d.id)+'<p><strong>'+d.name+'</strong><br>'+(result.duplicate?'중복 획득 · 할로윈 조각 +1':result.exchanged?'조각 교환 완료 · 영구 보유':'새 꾸미기 획득 · 영구 보유')+'</p>':'';
  }
 }
 async function refresh(){
  if(busy)return;const id=read()?.account,seq=++sequence;if(owner!==id){data=null;owner=id;result=null;retry=null;WakppuHalloweenDecor.sync(id,null);}
  if(!id||!read()?.ready){render();return;}
  try{const next=await WakppuAuth.invoke('halloween_cosmetics');if(seq!==sequence||id!==read()?.account)return;if(data&&next.decor_revision<data.decor_revision)return;data=next;WakppuHalloweenDecor.sync(id,next);render();}catch(e){if(seq===sequence)status(e.message);}
 }
 async function transact(action,id=null){
  if(!ready()||!data)return;const account=read().account,key=action+':'+id;
  if(action==='open'&&!confirm('100캔디로 할로윈 꾸미기 상자 1개를 열까요? 세 아이템은 각각 1/3 확률이며, 중복은 조각 1개로 바뀝니다.'))return;
  busy=true;++sequence;render();status('처리 중…');if(!retry||retry.key!==key)retry={key,id:crypto.randomUUID()};
  try{
   await WakppuItemGame.flush();if(account!==read()?.account)return;
   const request={item_id:id,request_id:retry.id,item_revision:read().revision,decor_revision:data.decor_revision};let next;
   try{next=await WakppuAuth.invoke('halloween_decor_'+action,request);}catch(e){if(e.status)throw e;next=await WakppuAuth.invoke('halloween_decor_'+action,request);}
   if(account!==read()?.account)return;if(next.revision<read().revision||next.decor_revision<data.decor_revision)throw Error('최신 상태를 다시 불러와주세요.');
   data=next;retry=null;result=next.result?.item_id?next.result:result;WakppuItemGame.accept(next,true);WakppuHalloweenDecor.sync(account,next);
   if(next.result?.used==='bat_swarm')WakppuHalloweenDecor.use();
   status(action==='open'?'상자를 열었습니다.':action==='exchange'?'선택 교환 완료':action==='use'?'박쥐 무리를 불렀습니다.':id?'꾸미기를 장착했습니다.':'꾸미기를 해제했습니다.');
   await window.WakppuLimited?.refresh();await window.WakppuItems?.refresh();await window.WakppuPumpkinInventory?.refresh();
  }catch(e){if(account===read()?.account)status(e.message);}
  finally{busy=false;render();await refresh();}
 }
 document.addEventListener('DOMContentLoaded',()=>{
  for(const [id,shop] of [['shopHalloween',true],['inventorySkinsPage',false]]){const parent=document.getElementById(id);if(!parent)continue;const section=document.createElement('section');section.className='hdecor-section';section.id=shop?'halloweenDecorShop':'halloweenDecorInventory';
   section.innerHTML='<h3>🎁 할로윈 꾸미기'+(shop?' 상자':' 보관함')+'</h3><p>세 아이템 모두 같은 확률 · 각각 1/3 (약 33.33%)<br>능력치 효과 없음 · 획득 후 영구 사용 · 중복은 할로윈 조각 1개</p><p class="hdecor-balance"></p>'+(shop?'<button class="btn hdecor-open" type="button">100캔디로 상자 1개 열기</button>':'')+'<p class="hdecor-status" role="status"></p><div class="hdecor-result" role="status" aria-live="polite" hidden></div><div class="hdecor-grid"></div><p>조각 3개로 원하는 미보유 꾸미기를 선택 교환할 수 있습니다. 유령·불씨는 한 번에 하나만 장착하며, 박쥐는 횟수 제한 없이 사용합니다. 상자 판매는 할로윈 이벤트 기간에만, 보유 꾸미기·조각 교환은 종료 후에도 이용할 수 있습니다.</p>';
   section.addEventListener('click',e=>{if(e.target.closest('.hdecor-open'))transact('open');const b=e.target.closest('[data-hdecor-action]');if(b)transact(b.dataset.hdecorAction,b.dataset.hdecorAction==='equip'&&data?.equipped===b.dataset.hdecorId?null:b.dataset.hdecorId);});parent.prepend(section);ui.push(section);
  }
  for(const id of ['shopBtn','shopHalloweenTab','inventoryBtn','inventorySkinsTab'])document.getElementById(id)?.addEventListener('click',refresh);
  window.addEventListener('wakppu-account-restored',refresh);window.addEventListener('wakppu-auth-changed',()=>{++sequence;data=null;owner=null;result=null;signature='';render();});setInterval(()=>{if(ui.some(n=>n.getClientRects().length)){render();if(!busy)refresh();}},15000);refresh();render();
 });
 window.WakppuHalloweenDecorUI={get busy(){return busy;},refresh};
})();
