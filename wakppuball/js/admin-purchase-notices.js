(() => {
 const $=id=>document.getElementById(id);let account=null,seen=new Map(),generation=0,inFlight=null,latest=null,lastPoll=0;
 const key=()=> 'wakppu-purchase-notices:'+account;
 function active(){return !document.hidden&&WakppuItemGame.read().ready&&!!WakppuItemGame.read().account&&!$('adminBtn').hidden;}
 function reset(){account=WakppuItemGame.read().account;generation++;inFlight=null;lastPoll=0;latest=null;$('purchaseNoticeToast').hidden=true;try{seen=new Map(JSON.parse(sessionStorage.getItem(key())||'[]'));}catch{seen=new Map();}}
 async function poll(force=false){
  if(account!==WakppuItemGame.read().account)reset();
  if(!active()){$('purchaseNoticeToast').hidden=true;return;}
  if(inFlight||!force&&Date.now()-lastPoll<14000)return;
  const token={},version=generation,owner=account;inFlight=token;lastPoll=Date.now();
  try{
   const data=await WakppuAuth.invoke('admin_purchase_inbox');
   if(version!==generation||owner!==WakppuItemGame.read().account||!active())return;
   const fresh=data.orders.filter(o=>seen.get(o.id)!==o.status);
   for(const o of data.orders){seen.delete(o.id);seen.set(o.id,o.status);}while(seen.size>500)seen.delete(seen.keys().next().value);
   try{sessionStorage.setItem(key(),JSON.stringify([...seen]));}catch{}
   if(!data.total){latest=null;$('purchaseNoticeToast').hidden=true;return;}
   $('purchaseNoticeCount').textContent='확인 대기 '+data.total+'건 · 입금 알림 '+data.claimed+'건';
   if(fresh.length){latest=fresh[0];$('purchaseNoticeTitle').textContent=latest.status==='claimed'?'구매자 입금 알림 접수':'새 구매 주문';$('purchaseNoticeBody').textContent=latest.nickname+' · '+latest.product_name+' · '+Number(latest.amount).toLocaleString('ko-KR')+'원';$('purchaseNoticeCount').textContent='확인 대기 '+data.total+'건 · 입금 알림 '+data.claimed+'건';$('purchaseNoticeToast').hidden=false;}
   else if(latest&&!data.orders.some(o=>o.id===latest.id)){$('purchaseNoticeToast').hidden=true;latest=null;}
  }catch{$('purchaseNoticeToast').hidden=true;}
  finally{if(inFlight===token)inFlight=null;}
 }
 document.addEventListener('DOMContentLoaded',()=>{
  const box=document.createElement('aside');box.id='purchaseNoticeToast';box.className='purchase-notice-toast';box.hidden=true;box.setAttribute('aria-label','관리자 구매 알림');
  const live=document.createElement('div');live.setAttribute('role','status');live.setAttribute('aria-live','polite');
  for(const [id,tag] of [['purchaseNoticeTitle','strong'],['purchaseNoticeBody','p'],['purchaseNoticeCount','small']]){const el=document.createElement(tag);el.id=id;live.append(el);}
  const help=document.createElement('p');help.textContent='실제 입금 여부는 은행 거래내역에서 확인하세요.';help.className='purchase-notice-help';
  const actions=document.createElement('div');const open=document.createElement('button');open.type='button';open.className='btn small';open.textContent='주문 확인';open.id='purchaseNoticeOpen';open.onclick=()=>{if(latest){box.hidden=true;WakppuPurchases.openNotice(latest.id);}};
  const close=document.createElement('button');close.type='button';close.className='btn small';close.textContent='닫기';close.id='purchaseNoticeDismiss';close.onclick=()=>{box.hidden=true;};actions.append(open,close);box.append(live,help,actions);document.body.append(box);
  window.addEventListener('wakppu-account-restored',()=>{reset();poll();});
  window.addEventListener('wakppu-auth-changed',()=>{reset();poll();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll(true);});
  new MutationObserver(()=>{if($('adminBtn').hidden){box.hidden=true;latest=null;}else poll();}).observe($('adminBtn'),{attributes:true,attributeFilter:['hidden']});
  setInterval(poll,15000);reset();poll();
 });
 window.WakppuPurchaseNotices={refresh:()=>poll(true)};
})();
