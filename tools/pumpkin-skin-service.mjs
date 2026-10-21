import {itemState} from './items-service.mjs';
import {skinState} from './skins-service.mjs';
import {limitedState,limitedActive,limitedData} from './limited-service.mjs';
import {adminContentAccess} from './admin-content.mjs';
export const pumpkinSkinDefs=['wisp','ghost','eclipse'].map((id,i)=>({skin_id:'pumpkin_'+id,ball_id:limitedData.ball.id,cost:String([50,100,200][i])}));
export function pumpkinSkinSnapshot(store,actor){
 const s=skinState(actor),l=limitedState(actor),access=adminContentAccess(actor),owned={...s.owned,...(access?Object.fromEntries(pumpkinSkinDefs.map(d=>[d.skin_id,true])):{})},can=access||!!l.owned[limitedData.ball.id];
 const selected=s.equipped[limitedData.ball.id];
 return {scare_disabled:!!l.scare_disabled,scare_disable_cost:'100',catalog:pumpkinSkinDefs,owned,equipped:can&&owned[selected]&&pumpkinSkinDefs.some(d=>d.skin_id===selected)?selected:null,tokens:String(l.tokens),active:limitedActive(store),can_equip:can,admin_content_access:access,skin_revision:s.revision,revision:itemState(actor).revision,gold:String(actor.state.gold)};
}
export function pumpkinSkinAction(store,actor,b){
 const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};if(!actor)fail('로그인이 필요합니다.',401);
 const s=skinState(actor),l=limitedState(actor),inv=itemState(actor),a=b.action;
 if(a==='pumpkin_skins')return pumpkinSkinSnapshot(store,actor);
 if(!['pumpkin_skin_exchange','pumpkin_skin_equip','pumpkin_scare_disable_buy'].includes(a))fail('잘못된 스킨 요청');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(b.request_id||''))fail('잘못된 요청 ID');
 const fingerprint=JSON.stringify([a,b.skin_id??null,b.ball_id??null,b.count??null]),cached=s.requests.get(b.request_id);
 if(cached){if(cached.fingerprint!==fingerprint)fail('요청 ID 충돌');return pumpkinSkinSnapshot(store,actor);}
 if(b.item_revision!==inv.revision||b.skin_revision!==s.revision)fail('스킨 상태가 변경되었습니다. 다시 불러와주세요.',409);
 const access=adminContentAccess(actor),d=pumpkinSkinDefs.find(d=>d.skin_id===b.skin_id);
 if(a==='pumpkin_scare_disable_buy'){
  if(!limitedActive(store))fail('할로윈 이벤트 기간이 아닙니다.',409);if(l.scare_disabled)fail('이미 영구 해제를 구매했습니다.',409);if(l.tokens<100)fail('할로윈 사탕이 부족합니다.',409);l.tokens-=100;l.scare_disabled=true;
 }else if(a==='pumpkin_skin_exchange'){
  if(access)fail('관리자는 구매 없이 바로 장착할 수 있습니다.');if(!limitedActive(store))fail('할로윈 이벤트 기간이 아닙니다.',409);
  if(!d||s.owned[d.skin_id])fail('교환할 미보유 스킨을 선택해주세요.');if(BigInt(l.tokens)<BigInt(d.cost))fail('할로윈 사탕이 부족합니다.');
  l.tokens-=Number(d.cost);s.owned[d.skin_id]=true;
 }else{
  if(b.ball_id!==limitedData.ball.id)fail('대상 왁뿌볼 오류');
  if(b.skin_id==null)delete s.equipped[limitedData.ball.id];
  else{if(!d||(!access&&!s.owned[d.skin_id]))fail('보유한 전용 스킨만 장착할 수 있습니다.');if(!access&&!l.owned[limitedData.ball.id])fail('잭오랜턴 왁뿌볼을 먼저 해금해주세요.');s.equipped[limitedData.ball.id]=d.skin_id;}
 }
 s.revision++;inv.revision++;actor.state.item_revision=inv.revision;
 const result=pumpkinSkinSnapshot(store,actor);s.requests.set(b.request_id,{fingerprint,response:structuredClone(result)});return result;
}
