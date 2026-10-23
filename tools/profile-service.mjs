// Local development counterpart. Fictional five-player data is opt-in elsewhere.
import {execute,ballIds,isBanned} from './admin-service.mjs';
import {basicProfileCard} from './profile-preview-service.mjs';
export function createProfileService(store){
 return {execute(actor,b){
  if(!actor)throw Object.assign(Error('로그인이 필요합니다.'),{status:401});
  if('user_id' in b||'target_user_id' in b)throw Object.assign(Error('다른 계정은 변경할 수 없습니다.'),{status:403});
  if(b.action==='profile_equip'){
   if(![null,'wax_beginning'].includes(b.card_id))throw Object.assign(Error('보유하지 않은 카드입니다.'),{status:400});
   actor.profileCard=b.card_id;
  }
  if(['profile_status','profile_equip'].includes(b.action))return {owned:['wax_beginning'],equipped:Object.hasOwn(actor,'profileCard')?actor.profileCard:'wax_beginning',catalog:[basicProfileCard],nickname:actor.nickname};
  const rows=execute(store,actor,{action:'rankings'}),rank=rows.findIndex(p=>p.nickname===b.nickname),p=store.players.find(p=>p.nickname===b.nickname);
  if(!p||isBanned(p)||(p!==actor&&rank<0))throw Object.assign(Error('프로필을 찾을 수 없습니다.'),{status:404});
  return {nickname:p.nickname,title:null,rank:rank<0?null:rank+1,gold:String(p.state.gold),rebirths:p.state.rebirths,online:rows[rank]?.online===true,discovered_count:new Set((p.state.discovered_ball_ids||[]).filter(id=>ballIds.includes(id))).size,discovery_total:ballIds.length,card:!Object.hasOwn(p,'profileCard')||p.profileCard==='wax_beginning'?basicProfileCard:null};
 }};
}
