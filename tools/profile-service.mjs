// Local development counterpart. Fictional five-player data is opt-in elsewhere.
import {execute,ballIds,isBanned} from './admin-service.mjs';
import {basicProfileCard} from './profile-preview-service.mjs';
import {profileTitles,setProfileTitle} from './profile-titles-service.mjs';
import {adminContentAccess} from './admin-content.mjs';
import {monthlyBadges} from './monthly-service.mjs';
import {goodsCatalog,goodsOwned} from './halloween-goods-data.mjs';
export const championProfileCard={id:'golden_champion',name:'황금의 정점',rarity:'1위 기념',free:false,image:'images/profile-cards/golden-champion.webp'};
export const supporterProfileCards=[{id:'supporter_glow',name:'따뜻한 응원',rarity:'후원자 전용',free:false,image:'images/profile-cards/supporter-glow.webp'},{id:'premium_celestial',name:'찬란한 성좌',rarity:'프리미엄 전용',free:false,image:'images/profile-cards/premium-celestial.webp'}];
const available=p=>[basicProfileCard,...(p.championCardOwned||adminContentAccess(p)?[championProfileCard]:[]),...supporterProfileCards.filter((c,i)=>adminContentAccess(p)||p.premiumSupporterPack||i===0&&p.supporterPack),...(p.monthlyCards||[]),...goodsCatalog.filter(d=>d.kind==='card'&&goodsOwned(p,d.id)).map(d=>({...d,rarity:'할로윈 한정',free:false}))];
export function createProfileService(store){
 return {execute(actor,b){
  if(!actor)throw Object.assign(Error('로그인이 필요합니다.'),{status:401});
  if('user_id' in b||'target_user_id' in b)throw Object.assign(Error('다른 계정은 변경할 수 없습니다.'),{status:403});
  const rows=execute(store,actor,{action:'rankings'}),champion=store.players.find(p=>p.nickname===rows[0]?.nickname);
  if(champion)champion.championCardOwned=true;
  const catalog=available(actor);
  if(actor.profileCard&&!catalog.some(c=>c.id===actor.profileCard))actor.profileCard='wax_beginning';
  if(b.action==='profile_equip'){
   if(b.card_id!==null&&!catalog.some(c=>c.id===b.card_id))throw Object.assign(Error('보유하지 않은 카드입니다.'),{status:400});
   actor.profileCard=b.card_id;
  }
  if(b.action==='profile_title')setProfileTitle(actor,b,actor.id===champion?.id);
  if(['profile_status','profile_equip','profile_title'].includes(b.action))return {owned:catalog.map(c=>c.id),equipped:Object.hasOwn(actor,'profileCard')?actor.profileCard:'wax_beginning',catalog,nickname:actor.nickname,...profileTitles(actor,actor.id===champion?.id),...monthlyBadges(actor)};
  const rank=rows.findIndex(p=>p.nickname===b.nickname),p=store.players.find(p=>p.nickname===b.nickname);
  if(!p||isBanned(p)||(p!==actor&&rank<0))throw Object.assign(Error('프로필을 찾을 수 없습니다.'),{status:404});
  return {nickname:p.nickname,monthly_badge:monthlyBadges(p).monthly_badge,title:profileTitles(p,p.id===champion?.id).title,rank:rank<0?null:rank+1,gold:String(p.state.gold),rebirths:p.state.rebirths,online:rows[rank]?.online===true,discovered_count:new Set((p.state.discovered_ball_ids||[]).filter(id=>ballIds.includes(id))).size,discovery_total:ballIds.length,card:!Object.hasOwn(p,'profileCard')?basicProfileCard:p.profileCard===null?null:available(p).find(c=>c.id===p.profileCard)||basicProfileCard};
 }};
}
