import {adminContentAccess} from './admin-content.mjs';
import {itemState} from './items-service.mjs';import {limitedState,limitedActive} from './limited-service.mjs';
export const ids=['little_ghost','pumpkin_ember','bat_swarm'];
export const decorState=a=>a.halloweenDecor||={owned:{},equipped:null,shards:0,opened:0,revision:0,requests:new Map()};
export function decorSnapshot(store,actor){const c=decorState(actor),access=adminContentAccess(actor),owned={...c.owned,...(access?Object.fromEntries(ids.map(id=>[id,true])):{})};return {owned,admin_content_access:access,equipped:owned[c.equipped]?c.equipped:null,shards:String(c.shards),opened:String(c.opened),decor_revision:c.revision,revision:itemState(actor).revision,tokens:String(limitedState(actor).tokens),gold:String(actor.state.gold),active:limitedActive(store),price:'100',exchange_cost:'3',catalog:ids.map((id,i)=>({id,name:['길 잃은 꼬마 유령','잭오랜턴의 불씨','꼬마 박쥐'][i],kind:'equip',weight:1}))};}
export function decorAction(store,actor,b,rng=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296){
 const fail=(m,status=409)=>{throw Object.assign(new Error(m),{status});},c=decorState(actor),inv=itemState(actor),l=limitedState(actor),a=b.action;
 if(a==='halloween_cosmetics')return decorSnapshot(store,actor);
 if(!['halloween_decor_open','halloween_decor_exchange','halloween_decor_equip','halloween_decor_use'].includes(a))fail('잘못된 요청',400);
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(b.request_id||''))fail('잘못된 요청 ID',400);
 const fp=JSON.stringify([a,b.item_id??null]),prior=c.requests.get(b.request_id);if(prior){if(prior.fp!==fp)fail('요청 ID 충돌');return {...decorSnapshot(store,actor),result:{...prior.result}};}
 if(b.item_revision!==inv.revision||b.decor_revision!==c.revision)fail('상태가 변경되었습니다. 다시 불러와주세요.');let result={},id=b.item_id;
 if(a==='halloween_decor_open'){
  if(!limitedActive(store))fail('할로윈 상자 판매 기간이 아닙니다.');if(l.tokens<100)fail('100캔디가 필요합니다.');
  id=ids[Math.min(2,Math.floor(rng()*3))];const duplicate=!!c.owned[id];l.tokens-=100;c.opened++;if(duplicate)c.shards++;else c.owned[id]=true;result={item_id:id,duplicate,shards_gained:duplicate?1:0};
 }else if(a==='halloween_decor_exchange'){
  if(!ids.includes(id))fail('잘못된 아이템',400);if(c.owned[id])fail('이미 보유한 꾸미기입니다.');if(c.shards<3)fail('할로윈 조각 3개가 필요합니다.');c.shards-=3;c.owned[id]=true;result={item_id:id,exchanged:true};
 }else if(a==='halloween_decor_equip'){
  if(id!=null&&(!ids.includes(id)||(!c.owned[id]&&!adminContentAccess(actor))))fail('보유한 꾸미기만 장착할 수 있습니다.',403);c.equipped=id??null;
 }else{if(id!=='bat_swarm'||(!c.owned[id]&&!adminContentAccess(actor)))fail('보유한 박쥐 무리만 사용할 수 있습니다.',403);c.equipped=id;result={used:id};}
 c.revision++;inv.revision++;actor.state.item_revision=inv.revision;c.requests.set(b.request_id,{fp,result});return {...decorSnapshot(store,actor),result};
}
