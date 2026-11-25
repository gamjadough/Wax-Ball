import {adminContentAccess} from './admin-content.mjs';
export const BOOST_ID='blue_gem_boost',BOOST_PRICE=100n,BOOST_MS=600000;
export const boostState=a=>a.gemBoost||={stock:0,expires:0,adminExpires:0,requests:new Map()};
export function boostSnapshot(a,now=Date.now()){const s=boostState(a),access=adminContentAccess(a),expires=Math.max(s.expires,access?s.adminExpires:0);return {item_id:BOOST_ID,price:String(BOOST_PRICE),seconds:600,multiplier:2,stock:access?Math.max(1,s.stock):s.stock,expires_at:expires,active_multiplier:expires>now?2:1,admin_access:access};}
export const gemBoostFactor=(a,now=Date.now())=>boostSnapshot(a,now).active_multiplier;
export function withBoost(a,r){if(!a||!r||Array.isArray(r))return r;const boost=boostSnapshot(a);return {...r,...(r.inventory?{inventory:{...r.inventory,[BOOST_ID]:boost.stock},effects:{...r.effects,...(boost.active_multiplier===2?{[BOOST_ID]:{expires_at:boost.expires_at}}:{})}}:{})};}
