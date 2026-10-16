import {randomInt} from 'node:crypto';
import {itemState} from './items-service.mjs';
import {adminContentAccess} from './admin-content.mjs';
export const skinDefs=['common','rare','hero','legendary','transcendent'].map((rank,i)=>({id:'eternity_'+rank,rank,weight:[7000,2200,600,190,10][i],duplicate:[1,3,10,30,100][i],exchange:[10,30,100,300,1000][i]}));
export const skinPrice=220000000000000000000n;
export const skinState=actor=>actor.skins||=( {owned:{},equipped:{},shards:0n,pity:0,total:0,revision:0,requests:new Map()} );
export function skinSnapshot(actor){const s=skinState(actor),access=adminContentAccess(actor);return {admin_content_access:access,owned:{...s.owned,...(access?Object.fromEntries(skinDefs.map(d=>[d.id,true])):{})},equipped:{...s.equipped},shards:String(s.shards),pity:s.pity,total:String(s.total),skin_revision:s.revision,revision:itemState(actor).revision,gold:String(actor.state.gold),can_equip:access||actor.state.unlocked_ball_ids.includes('eternity'),price:String(skinPrice)};}
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export function skinAction(actor,b,rng=()=>randomInt(10000)){
 if(!actor)fail('로그인이 필요합니다.',401);
 const s=skinState(actor),inv=itemState(actor),a=b.action;
 if(a==='skins')return skinSnapshot(actor);
 const fingerprint=JSON.stringify([a,b.skin_id??null,b.ball_id??null,b.count??null]),cached=s.requests.get(b.request_id);
 if(cached){if(cached.fingerprint!==fingerprint)fail('요청 ID 충돌');const current=skinSnapshot(actor);return {...structuredClone(cached.response),owned:current.owned,can_equip:current.can_equip};}
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(b.request_id||''))fail('잘못된 요청 ID');
 if(b.item_revision!==inv.revision||b.skin_revision!==s.revision)fail('스킨 상태를 다시 불러와주세요.',409);
 let d,duplicate=false,awarded=0;
 if(a==='skin_draw'){
  if((b.count??1)!==1)fail('스킨 뽑기는 1회씩만 가능합니다.');
  if(BigInt(actor.state.gold)<skinPrice)fail('Gold가 부족합니다.');
  let roll=rng();d=s.pity===99?skinDefs.at(-1):skinDefs.find(def=>(roll-=def.weight)<0);
  duplicate=!!s.owned[d.id];if(duplicate){awarded=d.duplicate;s.shards+=BigInt(awarded);}else s.owned[d.id]=true;
  s.pity=d.rank==='transcendent'?0:s.pity+1;s.total++;actor.state.gold=String(BigInt(actor.state.gold)-skinPrice);
 }else if(a==='skin_exchange'){
  d=skinDefs.find(def=>def.id===b.skin_id);if(!d||s.owned[d.id])fail('교환할 미보유 스킨을 선택해주세요.');
  if(s.shards<BigInt(d.exchange))fail('스킨 조각이 부족합니다.');s.shards-=BigInt(d.exchange);s.owned[d.id]=true;
 }else if(a==='skin_equip'){
  if(b.ball_id!=='eternity')fail('대상 왁뿌볼 오류');
  if(b.skin_id==null)delete s.equipped.eternity;
  else{d=skinDefs.find(def=>def.id===b.skin_id);if(!d||(!adminContentAccess(actor)&&!s.owned[d.id]))fail('보유한 전용 스킨만 장착할 수 있습니다.');if(!adminContentAccess(actor)&&!actor.state.unlocked_ball_ids.includes('eternity'))fail('영겁의 왁뿌볼을 먼저 해금해주세요.');s.equipped.eternity=d.id;}
 }else fail('잘못된 스킨 요청');
 s.revision++;inv.revision++;actor.state.item_revision=inv.revision;
 const response=skinSnapshot(actor);if(a==='skin_draw'||a==='skin_exchange')response.result={skin_id:d.id,duplicate,shards_awarded:awarded};
 s.requests.set(b.request_id,{fingerprint,response:structuredClone(response)});return response;
}
