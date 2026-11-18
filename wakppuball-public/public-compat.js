// Neutral adapters for shared gameplay code. No seasonal listeners, art or polling.
(() => {
 const identity=t=>t,noop=()=>{};
 window.WakppuLimitedData={season:{active:false},ball:{id:'disabled-season',name:'사용 불가'}};
 window.WakppuPumpkinSkins={profiles:[],reset:noop,syncCracks:noop,hit:noop};
 window.WakppuHalloweenDecorData={timing:identity};
 window.WakppuHalloweenDecor={timing:identity,spawn:noop,hit:noop,stop:noop,equipped:()=>null};
 window.WakppuHalloweenGoods={timing:identity,accept:noop};
 let tab='normal';
 const empty={selected:null,clicks:0,owned:{},tokens:0,season:{active:false}};
 function showTab(next,render=true){
  tab=next==='gem'?'gem':'normal';
  const gem=document.getElementById('gemCollection');if(gem)gem.hidden=tab!=='gem';
  for(const b of document.querySelectorAll('[data-collection-tab]')){
   const selected=b.dataset.collectionTab===tab;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;
  }
  if(render)window.WakppuLimitedGame?.resetCollection();
 }
 window.WakppuLimited={get data(){return empty;},get tab(){return tab;},busy:false,accept:noop,clear:noop,refresh:async()=>{},select:async id=>id===null,showTab,renderCollection:noop};
 document.addEventListener('DOMContentLoaded',()=>{
  const grid=document.getElementById('collectionGrid'),tabs=document.createElement('div');
  tabs.className='collection-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','도감 분류');
  tabs.innerHTML='<button id="normalCollectionTab" class="btn small" role="tab" aria-selected="true" data-collection-tab="normal">일반 도감</button>';
  grid.before(tabs);
  const unused=document.createElement('section');unused.id='limitedCollection';unused.hidden=true;grid.before(unused);
  tabs.addEventListener('click',e=>{const b=e.target.closest('[data-collection-tab]');if(b){showTab(b.dataset.collectionTab);b.focus();}});
  tabs.addEventListener('keydown',e=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
   e.preventDefault();const buttons=[...tabs.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);
   const next=e.key==='Home'?buttons[0]:e.key==='End'?buttons.at(-1):buttons[(i+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length];
   showTab(next.dataset.collectionTab);next.focus();
  });
  document.getElementById('inventoryPetsTab')?.remove();
  document.querySelector('[data-filter="limited"]')?.remove();
 });
})();
