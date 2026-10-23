// Opt-in loopback demo only. No production accounts, database or online tracking.
import {randomInt} from 'node:crypto';
import {ballIds,isBanned} from './admin-service.mjs';
export const basicProfileCard={id:'wax_beginning',name:'왁스의 시작',rarity:'기본',free:true,image:'images/profile-cards/wax-beginning.png'};
export function createProfilePreview(store,{int=randomInt}={}){
 const owner=store.players.find(p=>p.id==='local-player'),total=ballIds.length;
 const names=['말랑한감자','달빛왁스','금빛망치','쫀득구름','밤하늘조각'];
 const titles=['premium','supporter',null,'premium',null];
 for(let i=titles.length-1;i>0;i--){const j=int(0,i+1);[titles[i],titles[j]]=[titles[j],titles[i]];}
 const players=names.map((name,i)=>{
  const p=i===0?owner:structuredClone(owner);p.id=i===0?owner.id:'profile-demo-'+i;
  p.nickname=name+int(10,100);p.state.gold=(BigInt(int(100,1000))*10n**BigInt(int(3,15))).toString();p.state.rebirths=int(0,1001);
  p.state.discovered_ball_ids=ballIds.slice(0,int(1,total+1));p.profileCard='wax_beginning';
  p.profileDemo={online:i<3,title:titles[i]};if(i)store.players.push(p);return p;
 });
 const ranked=()=>players.filter(p=>!p.ranking_hidden&&!isBanned(p)).sort((a,b)=>b.state.rebirths-a.state.rebirths||(BigInt(a.state.gold)>BigInt(b.state.gold)?-1:BigInt(a.state.gold)<BigInt(b.state.gold)?1:a.nickname.localeCompare(b.nickname)));
 const title=p=>p.profileDemo?.title==='premium'?'프리미엄 후원자':p.profileDemo?.title==='supporter'?'왁뿌볼 후원자':null;
 const profile=p=>({nickname:p.nickname,title:title(p),rank:ranked().findIndex(x=>x.id===p.id)+1||null,gold:String(p.state.gold),rebirths:p.state.rebirths,discovered_count:p.state.discovered_ball_ids?.length||0,discovery_total:total,online:p.profileDemo?.online===true,card:p.profileCard==='wax_beginning'?basicProfileCard:null});
 return {execute(actor,b){
  if(!actor)throw Object.assign(new Error('로그인 후 확인할 수 있습니다.'),{status:401});
  if('user_id' in b||'target_user_id' in b)throw Object.assign(new Error('다른 계정의 카드를 변경할 수 없습니다.'),{status:403});
  if(b.action==='rankings')return ranked().map(p=>({nickname:p.nickname,gold:String(p.state.gold),rebirths:p.state.rebirths,online:p.profileDemo.online,supporter:!!title(p),premium_supporter:p.profileDemo.title==='premium',supporter_title_visible:true}));
  if(b.action==='profile_equip'){
   if(![null,'wax_beginning'].includes(b.card_id))throw Object.assign(new Error('보유하지 않은 프로필 카드입니다.'),{status:400});
   actor.profileCard=b.card_id;
  }
  if(['profile_status','profile_equip'].includes(b.action))return {owned:['wax_beginning'],equipped:actor.profileCard??null,catalog:[basicProfileCard],nickname:actor.nickname};
  if(b.action==='player_profile'){
   if(typeof b.nickname!=='string'||b.nickname.length>100)throw Object.assign(new Error('잘못된 플레이어입니다.'),{status:400});
   const p=players.find(x=>x.nickname===b.nickname)||(actor.nickname===b.nickname?actor:null);
   if(!p||p.ranking_hidden||isBanned(p))throw Object.assign(new Error('프로필을 찾을 수 없습니다.'),{status:404});
   return profile(p);
  }
  throw Object.assign(new Error('지원하지 않는 프로필 요청입니다.'),{status:400});
 }};
}
