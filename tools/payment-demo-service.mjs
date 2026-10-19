// Loopback-only mock provider. Never use this service to authorize real payments.
import {randomUUID} from 'node:crypto';
export const demoProducts=Object.freeze([
 Object.freeze({id:'supporter_pack',name:'왁뿌볼 응원팩',amount:1100,description:'후원자 칭호와 닉네임 테두리 · 능력치 변화 없음'}),
 Object.freeze({id:'starlight_skin',name:'별빛 오라 스킨',amount:3300,description:'모든 왁뿌볼에 별빛 고리와 반짝임 · 능력치 변화 없음'})
]);
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const view=o=>Object.fromEntries(Object.entries(o).filter(([key])=>key!=='owner'));
export function createDemoPayments({now=Date.now}={}){
 const orders=new Map(),requests=new Map(),accounts=new Map();
 const account=actor=>{if(!accounts.has(actor.id))accounts.set(actor.id,{owned:{},equipped:false});return accounts.get(actor.id);};
 function ownOrder(actor,id){const o=orders.get(id);if(!o||o.owner!==actor.id)fail('주문을 찾을 수 없습니다.',404);return o;}
 function expire(){for(const o of orders.values())if(o.status==='created'&&o.expires_at<=now())o.status='expired';}
 const eligible=actor=>!!actor.localAuth?.verified&&!actor.localAuth?.pending;
 function snapshot(actor){expire();return {mock:true,eligible:eligible(actor),account:actor.id,nickname:actor.nickname,products:demoProducts,owned:{...account(actor).owned},equipped:account(actor).equipped,orders:[...orders.values()].filter(o=>o.owner===actor.id).reverse().map(view)};}
 return {execute(actor,b){
  if(!actor)fail('로컬 계정으로 로그인해주세요.',401);
  expire();const s=account(actor);
  if(b.action==='catalog')return snapshot(actor);
  if(b.action==='order'){
   if(!eligible(actor))fail('구매 전 이메일 연결이 필요합니다. 로컬 체험에서는 연결 완료 가정을 선택하세요.',403);
   const product=demoProducts.find(p=>p.id===b.product_id);if(!product)fail('판매 중인 상품이 아닙니다.');
   if(!/^[\w-]{16,80}$/.test(b.request_id||''))fail('올바른 요청 번호가 필요합니다.');
   const key=actor.id+':'+b.request_id,cached=requests.get(key);
   if(cached){if(cached.product_id!==product.id)fail('같은 요청 번호로 상품을 바꿀 수 없습니다.',409);return {order:view(cached)};}
   if(b.amount!==undefined&&b.amount!==product.amount)fail('상품 금액이 일치하지 않습니다.');
   if(s.owned[product.id])fail('이미 보유한 상품입니다.',409);
   const pending=[...orders.values()].find(o=>o.owner===actor.id&&o.product_id===product.id&&['created','paid'].includes(o.status));
   if(pending){requests.set(key,pending);return {order:view(pending)};}
   const o={id:randomUUID(),owner:actor.id,product_id:product.id,name:product.name,amount:product.amount,currency:'KRW',status:'created',created_at:now(),expires_at:now()+1800000};
   orders.set(o.id,o);requests.set(key,o);return {order:view(o)};
  }
  if(b.action==='equip'){
   if(typeof b.equipped!=='boolean')fail('장착 상태를 확인해주세요.');
   if(b.equipped&&!s.owned.starlight_skin)fail('스킨을 보유하고 있지 않습니다.',403);
   s.equipped=b.equipped;return snapshot(actor);
  }
  const o=ownOrder(actor,b.order_id);
  if(b.action==='get')return {order:view(o)};
  if(b.action==='authorize'){
   if(!['success','cancel','fail'].includes(b.outcome))fail('모의 결제 결과를 선택해주세요.');
   if(o.status!=='created')return {order:view(o)};
   o.status={success:'paid',cancel:'cancelled',fail:'failed'}[b.outcome];
   if(o.status==='paid'){o.payment_id='mock_'+randomUUID();o.paid_at=now();}
   return {order:view(o)};
  }
  if(b.action==='fulfill'){
   if(o.status==='fulfilled')return snapshot(actor);
   if(o.status!=='paid')fail('결제 승인된 주문만 지급할 수 있습니다.',409);
   if(s.owned[o.product_id]&&s.owned[o.product_id]!==o.id)fail('이미 지급된 상품입니다.',409);
   s.owned[o.product_id]=o.id;o.status='fulfilled';o.fulfilled_at=now();return snapshot(actor);
  }
  if(b.action==='refund'){
   if(o.status==='refunded')return snapshot(actor);
   if(!['paid','fulfilled'].includes(o.status))fail('환불 가능한 모의 주문이 아닙니다.',409);
   if(s.owned[o.product_id]===o.id){delete s.owned[o.product_id];if(o.product_id==='starlight_skin')s.equipped=false;}
   o.status='refunded';o.refunded_at=now();return snapshot(actor);
  }
  fail('지원하지 않는 모의 결제 작업입니다.');
 }};
}
