(() => {
 const $=id=>document.getElementById(id),game=()=>window.WakppuItemGame?.read();
 let data=null,owner=null,sequence=0,busy=false,opener=null;
 function render(){
  const badge=$('blueGemCurrency');if(!badge)return;
  const ready=!!game()?.account&&game().ready&&!game().blocked&&!game().test;
  badge.hidden=!game()?.account;badge.disabled=!ready;
  $('blueGemValue').textContent=data?WakppuGold.compact(data.balance):'…';
  badge.setAttribute('aria-label','푸른젬 '+(data?.balance||'0')+'개 · 푸른젬 상점 열기');
  $('blueGemBalance').textContent='💎 보유 '+(data?WakppuGold.compact(data.balance):'…')+' 푸른젬 · 영구 Gold ×'+(data?WakppuGold.compact(data.multiplier):'1');
  if(!$('blueGemShop').open)return;
  $('blueGemProducts').replaceChildren(...(data?.catalog||[]).map(p=>{
   const row=document.createElement('article');row.className='blue-gem-product';const detail=document.createElement('div'),title=document.createElement('strong'),price=document.createElement('span'),button=document.createElement('button');
   title.textContent='Gold ×'+WakppuGold.compact(p.multiplier)+' · 영구';price.textContent='💎 '+WakppuGold.compact(p.price)+' 푸른젬';price.title=BigInt(p.price).toLocaleString('ko-KR')+'개';
   button.type='button';button.className='btn';button.dataset.gemLevel=p.level;
   const owned=p.level<=data.level;button.textContent=owned?'보유 중':data.admin_access?'관리자 적용':'구매';button.disabled=!ready||busy||game().busy||owned||(!data.admin_access&&BigInt(data.balance)<BigInt(p.price));
   button.onclick=()=>buy(p);detail.append(title,price);row.append(detail,button);return row;
  }));
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
  const badge=document.createElement('button');badge.id='blueGemCurrency';badge.className='season-currency blue-gem-currency';badge.type='button';badge.hidden=true;badge.setAttribute('aria-haspopup','dialog');badge.setAttribute('aria-controls','blueGemShop');badge.innerHTML='<span aria-hidden="true">💎</span><span id="blueGemValue">0</span><span>푸른젬</span>';$('halloweenCurrency').after(badge);
  const dialog=document.createElement('dialog');dialog.id='blueGemShop';dialog.className='blue-gem-dialog';dialog.setAttribute('aria-labelledby','blueGemHeading');dialog.innerHTML='<header><h2 id="blueGemHeading">💎 푸른젬 상점</h2><button id="blueGemClose" class="btn" type="button">닫기</button></header><p id="blueGemBalance"></p><p>왁뿌볼 파괴마다 푸른젬 1개 확정 지급.<br>재화와 영구 배율은 환생해도 유지됩니다. 가장 높은 배율 하나만 기존 Gold 보상에 곱합니다.</p><p id="blueGemStatus" role="status"></p><div id="blueGemProducts" class="blue-gem-products"></div>';document.body.append(dialog);
  const close=()=>{dialog.close();opener?.focus();};badge.onclick=()=>{opener=document.activeElement;dialog.showModal();refresh();};$('blueGemClose').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('keydown',e=>{if(e.key==='Escape')e.stopPropagation();});
  window.addEventListener('wakppu-account-restored',()=>{if(owner!==game()?.account&&dialog.open)close();data=null;owner=null;refresh();});
  setInterval(()=>{if(!document.hidden&&game()?.ready&&!game().busy&&!busy)refresh();},15000);refresh();
 });
 window.WakppuBlueGems={accept,refresh,get data(){return data;}};
})();
