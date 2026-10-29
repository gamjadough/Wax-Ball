import {adminContentAccess} from './admin-content.mjs';
export function profileTitles(actor,champion=false){
 const bonus=actor.profileDemo?.title==='premium'||actor.premiumSupporterPack?30:actor.profileDemo?.title==='supporter'||actor.supporterPack?5:0;
 const catalog=[{id:'auto',name:'자동 선택 (보유한 최고 칭호)'},{id:'none',name:'칭호 없음'}];
 if(bonus>=5||adminContentAccess(actor))catalog.push({id:'supporter',name:'왁뿌볼 후원자'});
 if(bonus>=30||adminContentAccess(actor))catalog.push({id:'premium',name:'프리미엄 후원자'});
 if(champion)catalog.push({id:'champion',name:'👑 왁뿌볼의 정점'});
 for(const r of actor.monthlyRewards||[])if(['champion','top10'].includes(r.kind))catalog.push({id:`monthly_${r.month.replace('-','')}_${r.kind}`,name:r.month.replace('-','년 ')+'월 '+(r.kind==='champion'?'클릭왕':'클릭 TOP 10')});
 let selected=actor.profileTitle||'auto';if(!catalog.some(c=>c.id===selected))selected='none';
 const title=selected==='auto'?(bonus>=30?'프리미엄 후원자':bonus>=5?'왁뿌볼 후원자':null):catalog.find(c=>c.id===selected&&c.id!=='none')?.name||null;
 return {title_catalog:catalog,title_equipped:selected,title};
}
export function setProfileTitle(actor,b,champion=false){
 if('user_id' in b||'target_user_id' in b)throw Object.assign(Error('다른 계정은 변경할 수 없습니다.'),{status:403});
 if(typeof b.title_id!=='string')throw Object.assign(Error('잘못된 칭호입니다.'),{status:400});
 if(!profileTitles(actor,champion).title_catalog.some(c=>c.id===b.title_id))throw Object.assign(Error('보유하지 않은 칭호입니다.'),{status:403});
 actor.profileTitle=b.title_id;
}
