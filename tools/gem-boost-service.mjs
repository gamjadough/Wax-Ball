import {execute as previous} from './halloween-goods-service.mjs';import {boostState,boostSnapshot,withBoost,BOOST_ID,BOOST_PRICE,BOOST_MS} from './gem-boost-data.mjs';import {gemState,gemSnapshot} from './blue-gem-data.mjs';import {itemState} from './items-service.mjs';import {adminContentAccess} from './admin-content.mjs';
const fail=(m,status=400)=>{throw Object.assign(Error(m),{status});};
export function execute(store,a,b){
 if(b.action==='blue_gem_boost_buy'||b.action==='item_use'&&b.item_id===BOOST_ID){
  previous(store,a,{action:'bootstrap'});const allowed=b.action==='blue_gem_boost_buy'?['action','request_id','item_revision','gem_revision']:['action','request_id','item_revision','item_id'];
  if(Object.keys(b).some(k=>!allowed.includes(k)))fail('잘못된 요청',403);
  if(!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(b.request_id||''))fail('잘못된 요청 ID');
  const s=boostState(a),inv=itemState(a),g=gemState(a),access=adminContentAccess(a),fp=JSON.stringify(Object.fromEntries(Object.entries(b).filter(([k])=>k!=='request_id').sort())),prior=s.requests.get(b.request_id);
  if(prior){if(prior.fp!==fp)fail('요청 ID 충돌',409);return structuredClone(prior.r);}
  if(b.item_revision!==inv.revision)fail('아이템 상태를 다시 불러와주세요.',409);
  if(b.action==='blue_gem_boost_buy'){
   if(access)fail('관리자는 인벤토리에서 바로 사용할 수 있습니다.',409);
   if(b.gem_revision!==g.revision)fail('푸른젬 상태가 변경되었습니다.',409);
   if(g.balance<BOOST_PRICE)fail('푸른젬이 부족합니다.');g.balance-=BOOST_PRICE;s.stock++;
  }else{
   if(!access&&s.stock<1)fail('보유한 아이템이 없습니다.',403);
   const now=Date.now(),expiry=Math.max(now,s.expires,access?s.adminExpires:0)+BOOST_MS;
   if(expiry>now+7*86400000)fail('최대 연장 시간은 7일입니다.');
   if(access)s.adminExpires=expiry;else{s.expires=expiry;s.stock--;}
  }
  inv.revision++;a.state.item_revision=inv.revision;g.revision++;
  const r=withBoost(a,{...previous(store,a,{action:'items'}),blue_gems:gemSnapshot(a)});s.requests.set(b.request_id,{fp,r:structuredClone(r)});return r;
 }
 return withBoost(a,previous(store,a,b));
}
