import {execute as previous} from './gem-ball-service.mjs';
import {goodsState,goodsCatalog,goodsExpiry} from './halloween-goods-data.mjs';
import {limitedState,limitedActive} from './limited-service.mjs';import {adminContentAccess} from './admin-content.mjs';
export function goodsSnapshot(store,a){const s=goodsState(a),expires=goodsExpiry(a),now=Date.now();return {stock:structuredClone(s.stock),expires,revision:s.revision,tokens:String(limitedState(a).tokens),active:limitedActive(store),admin_access:adminContentAccess(a),catalog:goodsCatalog,server_time:now,timing:{animation:expires.ghost_potion>now?2:1,respawn:expires.pumpkin_potion>now?2:1}};}
const fail=(m,status=400)=>{throw Object.assign(Error(m),{status});};
export function execute(store,a,b){
 if(['halloween_goods','halloween_goods_buy','halloween_goods_use'].includes(b.action)){
  previous(store,a,{action:'bootstrap'});if(['user_id','target_user_id','price','stock','expires','gold','reward','admin_access'].some(k=>k in b))fail('잘못된 요청',403);
  const s=goodsState(a);if(b.action==='halloween_goods')return goodsSnapshot(store,a);
  if(!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(b.request_id||''))fail('잘못된 요청 ID');
  const fp=JSON.stringify([b.action,b.id]),prior=s.requests.get(b.request_id);
  if(prior){if(prior!==fp)fail('다른 작업에 사용한 요청',409);return goodsSnapshot(store,a);}
  if(b.goods_revision!==s.revision)fail('한정 아이템 상태를 다시 불러와주세요.',409);
  const d=goodsCatalog.find(d=>d.id===b.id);if(!d)fail('없는 아이템');const access=adminContentAccess(a);
  if(b.action==='halloween_goods_buy'){
   if(!limitedActive(store))fail('할로윈 판매 기간이 아닙니다.',409);if(access)fail('관리자는 바로 사용할 수 있습니다.',409);
   if(d.kind!=='potion'&&s.stock[d.id]>0)fail('이미 보유한 아이템입니다.',409);
   const l=limitedState(a);if(l.tokens<d.price)fail('캔디가 부족합니다.');l.tokens-=d.price;s.stock[d.id]=(s.stock[d.id]||0)+1;
  }else{
   if(d.kind!=='potion')fail('포션만 사용 가능합니다.');if(!access&&!(s.stock[d.id]>0))fail('보유한 포션이 없습니다.',403);
   const target=access?s.admin_expires:s.expires,until=Math.max(Date.now(),target[d.id]||0)+1800000;
   if(until>Date.now()+604800000)fail('최대 연장 시간은 7일입니다.');target[d.id]=until;if(!access)s.stock[d.id]--;
  }
  s.revision++;s.requests.set(b.request_id,fp);return goodsSnapshot(store,a);
 }
 const r=previous(store,a,b);if(!a||!r||Array.isArray(r))return r;const {server_time,catalog,stock,...compact}=goodsSnapshot(store,a);return {...r,halloween_goods:compact};
}
