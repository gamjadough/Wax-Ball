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
 panel.append(status);document.getElementById('shopPremium').append(panel);
 if(!sessionStorage.getItem('wakppu-bank-preview'))login(false).then(()=>{sessionStorage.setItem('wakppu-bank-preview','1');WakppuItems.showShop('premium');});
});
