// Explicit isolated preview only. Dummy bank data; no production API calls.
window.WakppuLocalBankPreview=password=>document.addEventListener('DOMContentLoaded',()=>{
 const panel=document.createElement('details');panel.className='purchase-order';panel.innerHTML='<summary>로컬 계좌이체 체험 · 실제 송금 금지</summary><p>주문 후 관리자 계정으로 전환해 입금 확인·지급을 체험할 수 있습니다. 계좌·거래내역은 모두 샘플입니다.</p>';
 const status=document.createElement('p');status.setAttribute('role','status');
 async function login(admin){
  const result=await WakppuAuth.signIn(admin?'dodoonglee@gmail.com':'guest',admin?password:'');if(result.error){status.textContent=result.error.message;return;}
  if(!admin){const linked=await WakppuAuth.mockCompleteEmailLink();if(linked.error){status.textContent=linked.error.message;return;}}
  await WakppuItemGame.restore();await WakppuPurchases.refresh();
  status.textContent=admin?'로컬 관리자 계정입니다. 관리자 패널의 유료 상점 항목에서 샘플 입금을 확인하세요.':'로컬 구매자 계정입니다. 샘플 주문을 만들 수 있습니다.';
 }
 for(const [label,admin] of [['구매자 계정',false],['관리자 계정',true]]){const b=document.createElement('button');b.className='btn small';b.textContent=label;b.onclick=()=>login(admin);panel.append(b);}
 async function sample(product,upgrade=false){
  const controls=panel.querySelectorAll('button');controls.forEach(b=>b.disabled=true);
  try{
   await login(false);
   async function grant(id){const c=await WakppuAuth.invoke('purchase_catalog');if(c.owned[id])return;const r=await WakppuAuth.invoke('purchase_order',{product_id:id,depositor:'로컬 체험',request_id:crypto.randomUUID()});await login(true);await WakppuAuth.invoke('admin_purchase_approve',{order_id:r.order.id,confirmed_amount:r.order.amount,deposit_reference:'sample-'+r.order.id});await login(false);}
   if(upgrade)await grant('supporter_pack');await grant(product);
   if(product==='starlight_skin')await WakppuAuth.invoke('purchase_equip',{equipped:true});
   await WakppuPurchases.refresh();status.textContent='로컬 샘플 지급 완료 · 실제 송금·운영 계정과 무관합니다. 상점을 닫고 계정·랭킹에서 확인하세요.';
  }catch(e){status.textContent=e.message;}finally{controls.forEach(b=>b.disabled=false);}
 }
 for(const [label,id,upgrade] of [['프리미엄 신규 구매 체험','premium_supporter_pack',false],['응원팩 → 프리미엄 업그레이드 체험','premium_supporter_pack',true],['별빛 오라 500원 체험','starlight_skin',false]]){const b=document.createElement('button');b.className='btn small';b.textContent=label;b.onclick=()=>sample(id,upgrade);panel.append(b);}
 panel.append(status);document.getElementById('purchaseProducts').before(panel);
 if(!sessionStorage.getItem('wakppu-bank-preview'))login(false).then(()=>{sessionStorage.setItem('wakppu-bank-preview','1');WakppuItems.showShop('premium');});
});
