(() => {
 const $=id=>document.getElementById(id),game=()=>window.WakppuItemGame?.read();
 let data=null,owner=null,sequence=0,busy=false,opener=null,tab='permanent';
 const factor=()=>Number(data?.boost?.expires_at)>Date.now()?2:1;
 function timer(){const n=$('blueGemBoostTimer');if(!n)return;const seconds=Math.max(0,Math.ceil((Number(data?.boost?.expires_at||0)-Date.now())/1000));n.textContent=seconds?'푸른젬 ×2 · 남은 시간 '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'):'현재 푸른젬 획득량 ×1';}
 function render(){
  const badge=$('blueGemCurrency');if(!badge)return;
  const ready=!!game()?.account&&game().ready&&!game().blocked&&!game().test;
  badge.hidden=!game()?.account;badge.disabled=!ready;
  $('blueGemValue').textContent=data?WakppuGold.compact(data.balance):'…';
  badge.setAttribute('aria-label','푸른젬 '+(data?.balance||'0')+'개 · 푸른젬 상점 열기');
  $('blueGemBalance').textContent='💎 보유 '+(data?WakppuGold.compact(data.balance):'…')+' 푸른젬 · 영구 Gold ×'+(data?WakppuGold.compact(data.multiplier):'1');
  if(!$('blueGemShop').open)return;
  document.querySelectorAll('[data-gem-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.gemTab===tab)));
  $('blueGemInfo').hidden=tab==='items';timer();
  if(tab==='items'){
   const boost=data?.boost,row=document.createElement('article');row.className='blue-gem-product';
   const detail=document.createElement('div'),title=document.createElement('strong'),description=document.createElement('span'),button=document.createElement('button');
   title.textContent='💎🧪 푸른젬 증폭 물약';description.textContent='획득량 ×2 · 10분 / 💎 '+(boost?.price||'100')+'개\n보유 '+(boost?.admin_access?'관리자 무제한':(boost?.stock||0)+'개')+' · 구매 후 인벤토리에서 사용';
   button.type='button';button.className='btn';button.id='blueGemBoostBuy';button.textContent=boost?.admin_access?'관리자 보유':'구매';button.disabled=!ready||busy||game().busy||!boost||boost.admin_access||BigInt(data.balance)<BigInt(boost.price);button.onclick=buyBoost;
   detail.append(title,description);row.append(detail,button);$('blueGemProducts').replaceChildren(row);return;
  }
  $('blueGemProducts').replaceChildren(...(data?.catalog||[]).map(p=>{
   const row=document.createElement('article');row.className='blue-gem-product';const detail=document.createElement('div'),title=document.createElement('strong'),price=document.createElement('span'),button=document.createElement('button');
   title.textContent='Gold ×'+WakppuGold.compact(p.multiplier)+' · 영구';price.textContent='💎 '+WakppuGold.compact(p.price)+' 푸른젬';price.title=BigInt(p.price).toLocaleString('ko-KR')+'개';
   button.type='button';button.className='btn';button.dataset.gemLevel=p.level;
   const owned=p.level<=data.level;button.textContent=owned?'보유 중':data.admin_access?'관리자 적용':'구매';button.disabled=!ready||busy||game().busy||owned||(!data.admin_access&&BigInt(data.balance)<BigInt(p.price));
   button.onclick=()=>buy(p);detail.append(title,price);row.append(detail,button);return row;
  }));
 }
 async function buyBoost(){
  if(busy||!data?.boost||!game()?.ready||game().busy||game().blocked||game().test)return;
  const account=game().account;busy=true;++sequence;render();$('blueGemStatus').textContent='구매 중…';
  try{
   await WakppuItemGame.flush();if(account!==game()?.account)return;
   const request={request_id:crypto.randomUUID(),item_revision:game().revision,gem_revision:data.revision};let result;
   try{result=await WakppuAuth.invoke('blue_gem_boost_buy',request);}catch(e){if(e.status)throw e;result=await WakppuAuth.invoke('blue_gem_boost_buy',request);}
   if(account!==game()?.account)return;
   if(!WakppuItems.accept(result)){await WakppuItems.refresh();await refresh();return;}
   $('blueGemStatus').textContent='물약 구매 완료 · 인벤토리에서 사용하세요.';
  }catch(e){if(account===game()?.account){$('blueGemStatus').textContent=e.message;await refresh();if(e.status===409)await WakppuItems.refresh();}}
  finally{busy=false;render();}
 }
 function accept(next){if(!next||!game()?.account)return;if(owner!==game().account){data=null;owner=game().account;}if(data&&Number(next.revision)<Number(data.revision))return;data=next;render();}
 async function refresh(){const account=game()?.account,seq=++sequence;if(owner!==account){data=null;owner=account;}render();if(!account||!game().ready)return;
  try{const next=await WakppuAuth.invoke('blue_gems');if(seq===sequence&&account===game()?.account)accept(next);}
  catch(e){if(seq===sequence)$('blueGemStatus').textContent=e.message;}
 }
 async function buy(product){
  if(busy||!data||!game()?.ready||game().busy||game().blocked||game().test)return;
  const account=game().account,request={level:product.level,gem_revision:data.revision,request_id:crypto.randomUUID()};busy=true;++sequence;render();
  try{let next;try{next=await WakppuAuth.invoke('blue_gem_buy',request);}catch(e){if(e.status)throw e;next=await WakppuAuth.invoke('blue_gem_buy',request);}
   if(account!==game()?.account)return;accept(next);$('blueGemStatus').textContent='영구 Gold ×'+WakppuGold.compact(next.multiplier)+' 적용 완료';
  }catch(e){if(account===game()?.account){$('blueGemStatus').textContent=e.message;await refresh();}}
  finally{busy=false;render();}
 }
 document.addEventListener('DOMContentLoaded',()=>{
  const badge=document.createElement('button');badge.id='blueGemCurrency';badge.className='gold blue-gem-currency';badge.type='button';badge.hidden=true;badge.setAttribute('aria-haspopup','dialog');badge.setAttribute('aria-controls','blueGemShop');badge.innerHTML='<span class="blue-gem-icon" aria-hidden="true">💎</span><span id="blueGemValue" class="gold-value">0</span>';$('halloweenCurrency').before(badge);
  const dialog=document.createElement('dialog');dialog.id='blueGemShop';dialog.className='blue-gem-dialog';dialog.setAttribute('aria-labelledby','blueGemHeading');dialog.innerHTML='<header><h2 id="blueGemHeading">💎 푸른젬 상점</h2><button id="blueGemClose" class="btn" type="button">닫기</button></header><nav class="blue-gem-tabs" aria-label="푸른젬 상품"><button class="btn" data-gem-tab="permanent" aria-pressed="true">영구 배율</button><button class="btn" data-gem-tab="items" aria-pressed="false">아이템</button></nav><p id="blueGemBalance"></p><p id="blueGemBoostTimer"></p><p id="blueGemInfo">일반 왁뿌볼 파괴마다 푸른젬 기본 1개 지급.<br>재화와 영구 배율은 환생해도 유지됩니다. 가장 높은 배율 하나만 기존 Gold 보상에 곱합니다.</p><p id="blueGemStatus" role="status"></p><div id="blueGemProducts" class="blue-gem-products"></div><p>물약은 인벤토리에서 사용합니다. 추가 사용 시 ×2를 유지하며 10분씩 연장됩니다. 환생해도 유지되며, 접속하지 않아도 시간이 흐릅니다.</p>';document.body.append(dialog);
  dialog.querySelectorAll('[data-gem-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.gemTab;$('blueGemStatus').textContent='';render();});
  const close=()=>{dialog.close();opener?.focus();};badge.onclick=()=>{opener=document.activeElement;dialog.showModal();refresh();};$('blueGemClose').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('keydown',e=>{if(e.key==='Escape')e.stopPropagation();});
  window.addEventListener('wakppu-account-restored',()=>{if(owner!==game()?.account&&dialog.open)close();data=null;owner=null;refresh();});
  setInterval(()=>{if(!document.hidden&&game()?.ready&&!game().busy&&!busy)refresh();},15000);setInterval(()=>{if(dialog.open&&!document.hidden)timer();},1000);refresh();
 });
 window.WakppuBlueGems={accept,refresh,factor,get data(){return data;}};
})();
