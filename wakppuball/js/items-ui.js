(() => {
 let data=null,busy=false,filter='all',lastResults=[],sequence=0,inventoryMarkup='';
 const ranks=WakppuItemData.ranks,defs=WakppuItemData.list;
 const format=n=>WakppuGold.compact(n);
 const rank=id=>ranks.find(r=>r.id===id);
 const ready=()=>{const g=window.WakppuItemGame?.read();return g?.ready&&!g.test&&!g.busy&&!g.blocked;};
 function active(){return !!data&&defs.some(d=>{const e=data.effects[d.id];return e&&(d.seconds?e.expires_at>Date.now():e.remaining>0);});}
 function accept(next,syncGold=true){if(syncGold)++sequence;data=next;window.WakppuItemGame?.accept(next,syncGold);render();}
 async function refresh(){const seq=++sequence,account=window.WakppuItemGame?.read().account;if(!account){data=null;render();return;}try{const next=await WakppuAuth.invoke('items');if(seq===sequence&&account===window.WakppuItemGame?.read().account)accept(next,false);}catch(e){document.querySelector('#itemsStatus').textContent=e.message;}}
 function effectText(d,e){if(d.seconds){const left=Math.max(0,Math.ceil((e.expires_at-Date.now())/1000));return Math.floor(left/60)+':'+String(left%60).padStart(2,'0');}return e.remaining+(d.unit==='hit'?'타격':'회 파괴');}
 function render(){
  if(!document.querySelector('#itemsGold'))return;
  const game=window.WakppuItemGame?.read();
  document.querySelector('#itemsGold').textContent='현재 Gold: '+format(game?.gold||'0')+' G';
  document.querySelector('#itemsPity').textContent='초월 천장: '+(data?.pity||0)+' / 100 · 다음 확정까지 '+(100-(data?.pity||0))+'회';
  document.querySelectorAll('[data-pulls]').forEach(b=>b.disabled=busy||!!window.WakppuDrawReveal?.pending||!ready()||BigInt(game?.gold||0)<BigInt(WakppuItemData.prices[b.dataset.pulls]));
  document.querySelector('#itemsLogin').hidden=!!game?.ready;
  const owned=defs.filter(d=>data?.inventory[d.id]>0);
  const entries=owned.filter(d=>filter==='all'||d.rank===filter);
  const markup=entries.map(d=>'<article class="item-card" style="--item-color:'+rank(d.rank).color+'"><div class="item-heading"><span>'+d.icon+'</span><h3>'+d.name+'</h3><span>×'+data.inventory[d.id]+'</span></div><span class="item-rank">'+rank(d.rank).name+'</span><p>'+WakppuItemData.description(d)+'</p><button class="btn small" data-use="'+d.id+'" '+(busy||!ready()?'disabled':'')+'>사용</button></article>').join('')||'<p role="status">'+(owned.length?'이 등급에 보유한 아이템이 없습니다.':'보유한 아이템이 없습니다.')+'</p>';
  if(markup!==inventoryMarkup){document.querySelector('#inventoryList').innerHTML=markup;inventoryMarkup=markup;}
  const effective=WakppuItemData.effective(data?.effects||{},game?.honey,game?.coating);
  const winners=new Set(Object.values(effective).map(e=>e.id));
  const effects=defs.filter(d=>{const e=data?.effects[d.id];return e&&(d.seconds?e.expires_at>Date.now():e.remaining>0);});
  document.querySelector('#itemEffects').innerHTML=effects.length?effects.map(d=>'<li>'+d.icon+' '+d.name+' · '+effectText(d,data.effects[d.id])+(winners.has(d.id)?'':' · 동일·더 강한 효과 적용 중')+'</li>').join(''):'<li>활성 아이템 없음</li>';
  document.querySelector('#activeItemsBadge').hidden=!effects.length;
  document.querySelector('#activeItemsBadge').textContent='활성 아이템 '+effects.length+'개';
 }
 async function transact(action,payload){
  if(busy||!ready()||(action==='item_draw'&&window.WakppuDrawReveal?.pending))return;busy=true;++sequence;render();const account=window.WakppuItemGame.read().account;
  const status=document.querySelector('#itemsStatus');status.textContent='처리 중…';
  try{
   await window.WakppuItemGame.flush();
   const request={...payload,request_id:crypto.randomUUID(),item_revision:window.WakppuItemGame.read().revision};let result;
   try{result=await WakppuAuth.invoke(action,request);}catch(e){if(e.status)throw e;result=await WakppuAuth.invoke(action,request);}
   if(account!==window.WakppuItemGame.read().account)return;
   accept(result);
   if(action==='item_draw'){
    lastResults=result.results;window.WakppuDrawReveal.start(lastResults,account);
    status.textContent=payload.count+'개 아이템 지급 완료. 왁뿌볼을 깨서 확인하세요. 스킵은 연출만 생략합니다.';
   }else status.textContent='아이템을 사용했습니다. 같은 계열은 가장 강한 효과만 적용됩니다.';
   await refresh();
  }catch(e){status.textContent=e.message;if(e.status===409)await window.WakppuItemGame.restore();}
  finally{busy=false;render();}
 }
 document.addEventListener('DOMContentLoaded',()=>{
  const modal=document.createElement('div');modal.id='itemsModal';modal.className='modal';modal.hidden=true;
  modal.innerHTML='<div class="sheet items-sheet" role="dialog" aria-modal="true" aria-labelledby="itemsTitle"><div class="sheet-head"><h2 id="itemsTitle">아이템</h2><button id="itemsClose" class="btn small">닫기</button></div><p id="itemsStatus" role="status"></p><p id="itemsLogin">계정에서 빠른 시작 또는 로그인 후 사용할 수 있습니다.</p><section id="drawPanel"><h3>🎰 아이템 뽑기</h3><p id="itemsGold"></p><p id="itemsPity"></p><p>초월 기본 확률 0.1% · 100번째 확정 (천장 별도)</p><div class="draw-actions">'+[1,3,5].map(n=>'<button class="btn" data-pulls="'+n+'">'+n+'회 — '+format(WakppuItemData.prices[n])+' G</button>').join('')+'</div><details><summary>확률 보기</summary><ul>'+ranks.map(r=>'<li>'+r.name+' '+r.weight/100+'% · 각 아이템 '+(r.weight/100/defs.filter(d=>d.rank===r.id).length).toFixed(r.id==='hero'?4:2)+'%</li>').join('')+'</ul><p>같은 등급 안에서는 균등 확률입니다. 천장 확정은 기본 확률과 별도로 적용합니다. 초월은 천장 포함 장기 평균 약 1.05%입니다.</p></details><div id="drawResults" aria-live="polite"></div></section><section id="inventoryPanel"><h3>🎒 인벤토리</h3><p>같은 계열은 최강 효과 적용 · 횟수형은 적용될 때만 차감<br>환생 후 보유 아이템·천장 유지, 활성 효과 초기화</p><div class="item-filters">'+[{id:'all',name:'전체'},...ranks].map(r=>'<button class="btn small" data-filter="'+r.id+'">'+r.name+'</button>').join('')+'</div><div id="inventoryList"></div></section><section><h3>현재 효과</h3><ul id="itemEffects"></ul><p>같은 아이템은 시간·횟수가 누적됩니다. 시간은 접속하지 않아도 흐릅니다. 연장은 최대 7일입니다.</p></section></div>';
  document.body.append(modal);
  const effectsSection=modal.querySelector('#itemEffects').closest('section');modal.querySelector('#inventoryPanel').before(effectsSection);
  const badge=document.createElement('button');badge.id='activeItemsBadge';badge.className='btn small active-items-badge';badge.hidden=true;document.querySelector('.top').append(badge);
  let opener;
  function open(inventory){opener=inventory?document.querySelector('#inventoryBtn'):document.querySelector('#drawBtn');document.querySelector('#drawPanel').hidden=inventory;document.querySelector('#inventoryPanel').hidden=!inventory;document.querySelector('#itemsTitle').textContent=inventory?'인벤토리':'아이템 뽑기';modal.hidden=false;document.querySelector('#itemsClose').focus();refresh();render();}
  function close(){modal.hidden=true;opener?.focus();}
  document.querySelector('#drawBtn').onclick=()=>open(false);document.querySelector('#inventoryBtn').onclick=()=>open(true);badge.onclick=()=>open(true);
  document.querySelector('#itemsClose').onclick=close;modal.onclick=e=>{if(e.target===modal)close();};
  modal.addEventListener('keydown',e=>{if(e.key==='Escape')close();if(e.key==='Tab'){const nodes=[...modal.querySelectorAll('button:not(:disabled),summary')].filter(n=>n.getClientRects().length);if(!nodes.length)return;const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
  modal.addEventListener('click',e=>{
   const draw=e.target.closest('[data-pulls]');if(draw)transact('item_draw',{count:Number(draw.dataset.pulls)});
   const f=e.target.closest('[data-filter]');if(f){filter=f.dataset.filter;render();}
   const use=e.target.closest('[data-use]');if(use){
    const d=defs.find(d=>d.id===use.dataset.use),game=window.WakppuItemGame.read(),effective=WakppuItemData.effective(data.effects,game.honey,game.coating);
    const channels=WakppuItemData.channels(d);
    const existing=data.effects[d.id],sameActive=existing&&(d.seconds?existing.expires_at>Date.now():existing.remaining>0);
    const suppressed=channels.every(([channel,value])=>channel==='difficulty'?effective[channel].value<=value:effective[channel].value>=value);
    if(suppressed&&!sameActive){
     document.querySelector('#itemsStatus').textContent='이미 같은 계열의 같거나 강한 효과가 있습니다. 다른 효과가 끝난 뒤 사용해주세요.';return;
    }
    transact('item_use',{item_id:use.dataset.use});
   }
  });
  window.addEventListener('wakppu-account-restored',()=>{window.WakppuDrawReveal?.restore();if(!busy)refresh();});
  setInterval(render,1000);render();
 });
 window.WakppuItems={get data(){return data;},get busy(){return busy;},active,accept,refresh,render,clearEffects(){if(data)data.effects={};render();}};
})();
