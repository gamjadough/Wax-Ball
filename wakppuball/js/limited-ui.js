(() => {
 let data=null,tab='normal',busy=false,account=null,detail=false,sequence=0;
 const $=id=>document.getElementById(id),config=WakppuLimitedData;
 const ready=()=>{const g=WakppuItemGame.read();return g.ready&&!g.busy&&!g.blocked&&!g.test&&!busy;};
 function renderCurrency(){const badge=$('halloweenCurrency');if(!badge)return;badge.hidden=!data?.season.active||!window.WakppuItemGame?.read().ready;const tokens=String(data?.tokens||0);$('halloweenCurrencyValue').textContent=WakppuGold.compact(tokens);badge.title='할로윈 사탕 '+tokens+'개';badge.setAttribute('aria-label','보유 할로윈 사탕 '+tokens+'개');}
 function accept(next){sequence++;data=next;renderCollection();}
 async function refresh(){const seq=++sequence,user=WakppuItemGame.read().account;if(!user){data=null;renderCollection();return;}try{const next=await WakppuAuth.invoke('limited');if(seq!==sequence||user!==WakppuItemGame.read().account)return;const previous=data?.selected??null;data=next;account=user;if(previous!==next.selected)WakppuLimitedGame.sync(!!next.selected,next.clicks);renderCollection();}catch(e){if($('limitedStatus'))$('limitedStatus').textContent=e.message;}}
 async function transact(action,payload={}){if(!ready())return false;busy=true;renderCollection();const user=WakppuItemGame.read().account;try{await WakppuItemGame.flush();const req={...payload,request_id:crypto.randomUUID(),item_revision:WakppuItemGame.read().revision};let r;try{r=await WakppuAuth.invoke(action,req);}catch(e){if(e.status)throw e;r=await WakppuAuth.invoke(action,req);}if(user!==WakppuItemGame.read().account)return false;const previous=data?.selected??null;WakppuItems.accept(r);data=r.limited;if(previous!==data.selected)WakppuLimitedGame.sync(!!data.selected,data.clicks);$('limitedStatus').textContent=action==='limited_buy'?'호박 왁뿌볼을 구매했습니다.':'볼을 변경했습니다.';return true;}catch(e){$('limitedStatus').textContent=e.message;return false;}finally{busy=false;renderCollection();}}
 function showTab(next,render=true){tab=next;detail=false;if($('limitedCollection'))$('limitedCollection').hidden=tab!=='limited';for(const b of document.querySelectorAll('[data-collection-tab]')){b.setAttribute('aria-selected',String(b.dataset.collectionTab===tab));b.tabIndex=b.dataset.collectionTab===tab?0:-1;}if(render)WakppuLimitedGame.resetCollection();}
 function renderCollection(){
  renderCurrency();
  if(!$('limitedCollection'))return;
  $('limitedCollection').hidden=tab!=='limited';if(tab!=='limited')return;
  $('collectionGrid').hidden=true;$('collectionDetail').hidden=true;$('collectionPager').hidden=true;
  const owned=data?.owned[config.ball.id],selected=data?.selected===config.ball.id,active=!!data?.season.active,admin=!!data?.admin_access;
  const state=selected?'사용 중':owned?'보유 중':admin?'관리자 상시 이용':active?'획득 가능':Date.now()<Date.parse(config.season.starts_at)?'시작 전':'기간 종료';
  const base=WakppuGold.compact(config.ball.reward);
  $('limitedSeason').textContent=config.season.name+' · 수집 '+(owned?1:0)+' / 1';
  $('limitedBalance').textContent='🍬 할로윈 사탕 '+(data?.tokens||0)+'개 · 일반 볼 파괴 시 10% 확률로 1개';
  $('limitedPeriod').textContent='한국 시간 2026.10.24 00:00 ~ 11.14 23:59 · '+(active?'진행 중':admin?'이벤트 비활성':state==='시작 전'?'시작 전':'기간 종료');
  const card='<span class="thumb">'+buildBallThumb(config.ball)+'</span><span class="collection-name">'+config.ball.name+'</span><span class="collection-state">'+state+'</span>';
  $('limitedCards').innerHTML=detail?'<button class="btn small" data-limited-back>〈 목록으로</button><article class="card limited-detail">'+card+'<p>기본 필요 타격량 100회 · 기존 아이템·환생 배율 적용</p><p>기본 파괴 보상 '+base+' G · 영겁의 왁스볼 ×1.5'+'</p><p>기간 종료·환생 후에도 보유하고 선택할 수 있습니다.</p>'+(admin?'<p>관리자는 이벤트 기간·사탕 보유 여부와 관계없이 사용할 수 있습니다.</p>':'')+(owned||admin?'<button class="btn" data-limited-select '+(!ready()||selected?'disabled':'')+'>'+(selected?'사용 중':'선택')+'</button>':'<button class="btn" data-limited-buy '+(!active||!ready()||(data?.tokens||0)<100?'disabled':'')+'>🍬 사탕 100개로 구매</button>')+'</article>':'<button class="card collection-card" data-limited-detail aria-label="'+config.ball.name+' · '+state+' · 상세 보기">'+card+'</button>';
 }
 document.addEventListener('DOMContentLoaded',()=>{
  const tabs=document.createElement('div');tabs.className='collection-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','도감 분류');tabs.innerHTML='<button id="normalCollectionTab" class="btn small" role="tab" aria-selected="true" aria-controls="collectionGrid" data-collection-tab="normal">일반 도감</button><button id="limitedCollectionTab" class="btn small" role="tab" aria-selected="false" aria-controls="limitedCollection" tabindex="-1" data-collection-tab="limited">한정 도감</button>';
  $('collectionGrid').before(tabs);const panel=document.createElement('section');panel.id='limitedCollection';panel.hidden=true;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','limitedCollectionTab');panel.innerHTML='<h3 id="limitedSeason"></h3><p id="limitedPeriod"></p><p id="limitedBalance"></p><p id="limitedStatus" role="status"></p><div id="limitedCards"></div>';$('collectionGrid').before(panel);
  tabs.onclick=e=>{const b=e.target.closest('[data-collection-tab]');if(b){showTab(b.dataset.collectionTab);b.focus();refresh();}};
  tabs.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();showTab(e.key==='Home'?'normal':e.key==='End'?'limited':tab==='normal'?'limited':'normal');document.querySelector('[data-collection-tab="'+tab+'"]').focus();}};
  panel.onclick=async e=>{if(e.target.closest('[data-limited-detail]')){detail=true;renderCollection();panel.querySelector('[data-limited-back]').focus();}else if(e.target.closest('[data-limited-back]')){detail=false;renderCollection();panel.querySelector('[data-limited-detail]').focus();}else if(e.target.closest('[data-limited-buy]'))await transact('limited_buy');else if(e.target.closest('[data-limited-select]')){if(await transact('limited_select',{ball_id:config.ball.id}))$('collectionClose').click();}};
  $('collectionBtn').addEventListener('click',refresh);
 });
 window.WakppuLimited={get data(){return data;},get tab(){return tab;},get busy(){return busy;},accept,refresh,showTab,renderCollection,select:id=>transact('limited_select',{ball_id:id}),clear:()=>{data=null;account=null;sequence++;renderCurrency();}};
 window.addEventListener('wakppu-account-restored',refresh);
 setInterval(()=>{if(window.WakppuItemGame?.read().ready&&!WakppuItemGame.read().busy&&!busy)refresh();},30000);
})();
