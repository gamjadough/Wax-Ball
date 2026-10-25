import {adminContentAccess} from './admin-content.mjs';
export const gemProducts=['1000','10000','100000','1000000','10000000','1000000000000000','1'+'0'.repeat(39)].map((price,i)=>({level:i+1,price,multiplier:['2','5','10','100','1000','1000000','1000000000'][i]}));
export const gemState=a=>a.blueGems||={balance:0n,level:0,adminLevel:0,revision:0,requests:new Map()};
export function gemSnapshot(a){const g=gemState(a),admin=adminContentAccess(a),level=Math.max(g.level,admin?g.adminLevel:0);return {balance:String(g.balance),level,revision:g.revision,multiplier:gemProducts.find(p=>p.level===level)?.multiplier||'1',admin_access:admin,catalog:gemProducts};}
export function gemReward(a,paid){if(paid<=0n)return paid;const g=gemState(a);if(!a.blueGemExcluded){g.balance++;g.revision++;}return paid*BigInt(gemSnapshot(a).multiplier);}
export function gemBuy(a,b){
 const fail=(m,status=400)=>{throw Object.assign(Error(m),{status});},g=gemState(a);
 if(['user_id','target_user_id','balance','price','multiplier'].some(k=>k in b))fail('서버가 가격과 재화를 결정합니다.',403);
 if(!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(b.request_id||'')||!Number.isInteger(b.level))fail('잘못된 요청입니다.');
 const cached=g.requests.get(b.request_id);if(cached){if(cached.level!==b.level)fail('요청 ID 충돌',409);return structuredClone(cached.response);}
 if(b.gem_revision!==g.revision)fail('푸른젬 상태가 바뀌었습니다.',409);
 const p=gemProducts.find(p=>p.level===b.level);if(!p)fail('없는 상품입니다.');
 if(p.level<=gemSnapshot(a).level)fail('이미 같거나 높은 배율을 보유하고 있습니다.',409);
 if(!adminContentAccess(a)&&g.balance<BigInt(p.price))fail('푸른젬이 부족합니다.');
 if(adminContentAccess(a))g.adminLevel=p.level;else{g.balance-=BigInt(p.price);g.level=p.level;}g.revision++;
 const response=gemSnapshot(a);g.requests.set(b.request_id,{level:b.level,response:structuredClone(response)});return response;
}
