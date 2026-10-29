import {adminContentAccess} from './admin-content.mjs';
export const goodsCatalog=[
 ['witch_potion','마녀 포션','potion',50],['ghost_potion','유령 포션','potion',50],['pumpkin_potion','호박 포션','potion',50],
 ['halloween_witch','마녀의 심야','card',200,'halloween-witch'],['halloween_ghost','유령의 저택','card',200,'halloween-ghost'],['halloween_pumpkin','잭오랜턴의 밤','card',200,'halloween-pumpkin'],
 ['halloween_witch_title','마녀의 계약자','title',100],['halloween_ghost_title','유령의 친구','title',100],['halloween_pumpkin_title','호박불의 수호자','title',100]
].map(([id,name,kind,price,image])=>({id,name,kind,price,image:image?'images/profile-cards/'+image+'.webp':null}));
export const goodsState=a=>a.halloweenGoods||={stock:{},expires:{},admin_expires:{},revision:0,remainder:0,requests:new Map()};
export const goodsOwned=(a,id)=>adminContentAccess(a)||Number(a?.halloweenGoods?.stock[id])>0;
export function goodsExpiry(a){const s=goodsState(a);return Object.fromEntries(goodsCatalog.filter(d=>d.kind==='potion').map(d=>[d.id,Math.max(s.expires[d.id]||0,adminContentAccess(a)?s.admin_expires[d.id]||0:0)]));}
export function goodsReward(a,base){if(base<=0n||goodsExpiry(a).witch_potion<=Date.now())return base;const s=goodsState(a),parts=base*3n+BigInt(s.remainder);s.remainder=Number(parts%2n);return parts/2n;}
