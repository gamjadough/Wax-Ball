import {payment,checkoutUrl} from './client.js';
if(!window.WakppuAuth?.local)throw new Error('로컬 모의 결제 전용 화면입니다.');
let data=null,busy=false,sequence=0;
const button=(text,action)=>{const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=text;b.onclick=action;b.disabled=busy;return b;};
const root=document.createElement('div');root.id='mockStore';root.className='modal';root.hidden=true;
root.innerHTML='<section class="sheet mock-store" role="dialog" aria-modal="true" aria-labelledby="mockTitle"><header class="sheet-head"><h2 id="mockTitle">💜 응원 상점 체험</h2><button class="btn small" id="mockClose">닫기</button></header><p class="mock-notice">로컬 모의 결제 · 실제 청구 0원<br>카드 정보 입력 없음 · 서버를 다시 시작하면 구매 내역이 초기화됩니다.</p><p id="mockEligibility"></p><div id="mockAccountActions"></div><div id="mockProducts" class="mock-products"></div><p id="mockStatus" role="status" tabindex="-1"></p><h3>보유 상품</h3><div id="mockOwned"></div><h3>구매 내역</h3><p>승인 후 창을 닫거나 지급이 누락되면 아래에서 다시 지급할 수 있습니다. 환불도 실제 돈이 움직이지 않는 모의 처리입니다.</p><div id="mockOrders"></div></section>';
document.body.append(root);
const $=id=>document.getElementById(id),status=text=>{$('mockStatus').textContent=text;};
const badge=document.createElement('span');badge.className='mock-supporter-badge';badge.textContent='💜 왁뿌볼 후원자';badge.hidden=true;document.querySelector('.top').append(badge);
const open=button('💜 응원 상점 (모의)',()=>{root.hidden=false;refresh();$('mockClose').focus();});open.id='mockShopBtn';open.classList.add('top-btn');document.querySelector('.top').append(open);
const frameRanking=()=>{for(const n of document.querySelectorAll('.ranking-nickname'))n.classList.toggle('mock-supporter-frame',!!data?.owned.supporter_pack&&n.textContent.trim()===data.nickname);};
new MutationObserver(frameRanking).observe($('rankingList'),{childList:true,subtree:true});
function cosmetics(){
 const own=!!data?.owned.supporter_pack;badge.hidden=!own;
 $('accountBtn').classList.toggle('mock-supporter-frame',own);$('renameNicknameInput').classList.toggle('mock-supporter-frame',own);
 document.documentElement.classList.toggle('mock-starlight',!!data?.equipped);frameRanking();
}
function render(){
 cosmetics();$('mockProducts').replaceChildren();$('mockOwned').replaceChildren();$('mockOrders').replaceChildren();$('mockAccountActions').replaceChildren();
 $('mockEligibility').textContent=data?.eligible?'이메일 연결 계정으로 모의 구매할 수 있습니다.':'빠른 시작 계정은 이메일 연결 후 구매할 수 있습니다.';
 if(!data)$('mockAccountActions').append(button('로컬 샘플 다시 연결',async()=>{const result=await WakppuAuth.signIn('guest','');if(result.error){status(result.error.message);return;}await WakppuItemGame.restore();await refresh();}));
 if(data&&!data.eligible)$('mockAccountActions').append(button('로컬에서 이메일 연결 완료 가정',()=>transact(async()=>{const result=await WakppuAuth.mockCompleteEmailLink();if(result.error)throw result.error;await WakppuItemGame.restore();return payment({action:'catalog'});},'로컬 샘플 이메일 연결을 완료했습니다. 실제 이메일 인증은 수행하지 않습니다.')));
 for(const p of data?.products||[]){
  const card=document.createElement('article');card.className='mock-product';
  const icon=document.createElement('div');icon.className=p.id==='starlight_skin'?'mock-skin-sample':'mock-pack-sample';icon.textContent=p.id==='starlight_skin'?'✦':'💜';icon.setAttribute('aria-hidden','true');
  const h=document.createElement('h3');h.textContent=p.name;const description=document.createElement('p');description.textContent=p.description;
  const buy=button(data.owned[p.id]?'보유 중':p.amount.toLocaleString('ko-KR')+'원 · 모의 구매',()=>transact(async()=>{const {order}=await payment({action:'order',product_id:p.id,request_id:crypto.randomUUID()});location.assign(checkoutUrl(order.id));}));
  buy.dataset.mockBuy=p.id;buy.disabled=busy||!data.eligible||!!data.owned[p.id];card.append(icon,h,description,buy);$('mockProducts').append(card);
 }
 if(data?.owned.supporter_pack)$('mockOwned').append(document.createTextNode('💜 후원자 칭호 · 닉네임 테두리 사용 중 '));
 if(data?.owned.starlight_skin){const equip=button(data.equipped?'별빛 스킨 해제':'별빛 스킨 장착',()=>transact(()=>payment({action:'equip',equipped:!data.equipped}),'스킨 장착 상태를 저장했습니다.'));equip.id='mockEquip';$('mockOwned').append(equip);}
 if(!data||!Object.keys(data.owned).length)$('mockOwned').textContent='아직 보유한 유료 상품이 없습니다.';
 const labels={created:'결제 대기',paid:'승인 완료 · 지급 대기',fulfilled:'지급 완료',cancelled:'결제 취소',failed:'결제 실패',refunded:'모의 환불 완료',expired:'주문 만료'};
 for(const o of data?.orders||[]){
  const row=document.createElement('article');row.className='mock-order';row.dataset.orderId=o.id;
  const text=document.createElement('p');text.textContent=o.name+' · '+o.amount.toLocaleString('ko-KR')+'원 · '+labels[o.status];
  const id=document.createElement('small');id.textContent='주문 '+o.id;row.append(text,id);
  if(o.status==='created')row.append(button('결제 이어하기',()=>location.assign(checkoutUrl(o.id))));
  if(o.status==='paid'){const recover=button('미지급 상품 다시 지급',()=>transact(()=>payment({action:'fulfill',order_id:o.id}),'상품 지급을 완료했습니다.'));recover.dataset.recover=o.id;row.append(recover);}
  if(['paid','fulfilled'].includes(o.status)){const refund=button('모의 환불',()=>{if(confirm('모의 환불 후 이 주문의 상품을 회수합니다. 실제 금액은 청구·환불되지 않습니다.'))transact(()=>payment({action:'refund',order_id:o.id}),'모의 환불 및 상품 회수를 완료했습니다.');});refund.dataset.refund=o.id;row.append(refund);}
  $('mockOrders').append(row);
 }
 if(!data?.orders.length)$('mockOrders').textContent='구매 내역이 없습니다.';
}
async function refresh(){const version=++sequence;try{const next=await payment({action:'catalog'});if(version!==sequence||next.account!==WakppuItemGame.read().account)return;data=next;render();}catch(e){if(version===sequence){data=null;render();status(e.message);}}}
async function transact(fn,message){if(busy)return;busy=true;const owner=WakppuItemGame.read().account;render();try{const next=await fn();if(owner!==WakppuItemGame.read().account)return;if(next?.account)data=next;if(message)status(message);}catch(e){status(e.message);}finally{busy=false;render();}}
function close(){root.hidden=true;open.focus();}
$('mockClose').onclick=close;root.addEventListener('click',e=>{if(e.target===root)close();});
document.addEventListener('keydown',e=>{if(root.hidden)return;if(e.key==='Escape')close();else if(e.key==='Tab'){const nodes=[...root.querySelectorAll('button:not(:disabled)')].filter(n=>n.getClientRects().length),first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
window.addEventListener('wakppu-account-restored',()=>{data=null;cosmetics();refresh();});
async function start(){
 if(!(await WakppuAuth.session()).data.session){const result=await WakppuAuth.signIn('guest','');if(result.error)throw result.error;}
 await WakppuItemGame.restore();await refresh();root.hidden=false;$('mockClose').focus();
 const query=new URLSearchParams(location.search),id=query.get('order');
 if(id){try{const {order}=await payment({action:'get',order_id:id});if(order.status==='paid'&&!query.has('defer'))await transact(()=>payment({action:'fulfill',order_id:id}),'모의 구매와 상품 지급을 완료했습니다.');else status(order.status==='paid'?'승인 후 지급 누락을 가정했습니다. 구매 내역에서 다시 지급하세요.':'결과는 구매 내역에서 확인할 수 있습니다.');}catch(e){status(e.message);}history.replaceState(null,'','/?preview=payments');}
}
start().catch(e=>{status(e.message);root.hidden=false;});
