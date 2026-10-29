// In-memory local counterpart. Never imported by the public client.
const now=store=>store.monthly_now_ms??Date.now();
const month=at=>new Date(at+9*3600000).toISOString().slice(0,7);
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export const monthlyEligible=(p,at=Date.now())=>!!p&&p.role!=='admin'&&!p.ranking_hidden&&p.moderation?.status!=='banned'&&!(p.moderation?.status==='suspended'&&(!p.moderation.suspended_until||Date.parse(p.moderation.suspended_until)>at))&&!(p.lifecycle&&!p.lifecycle.first_play_at&&!p.email&&!p.localAuth?.verified&&Date.parse(p.lifecycle.created_at)+1800000<=at);
const seasons=store=>store.monthly||=new Map();
export function monthlyRecord(store,p){
 const at=now(store),m=month(at);if(!monthlyEligible(p,at)||m<'2026-10')return;
 const all=seasons(store);if(!all.has(m))all.set(m,{counts:new Map(),done:false});const s=all.get(m);if(s.done)return;
 const old=s.counts.get(p.id);s.counts.set(p.id,{id:p.id,clicks:(old?.clicks||0n)+1n,reached:at});
}
const ranked=(store,s)=>[...s.counts.values()].filter(c=>monthlyEligible(store.players.find(p=>p.id===c.id),now(store))).sort((a,b)=>a.clicks===b.clicks?a.reached-b.reached||a.id.localeCompare(b.id):a.clicks>b.clicks?-1:1).map((c,i)=>({...c,rank:i+1,nickname:store.players.find(p=>p.id===c.id).nickname}));
export function monthlySettle(store){
 for(const [m,s] of seasons(store))if(!s.done&&m<month(now(store))){
  s.rows=ranked(store,s);s.done=true;if(m<'2026-11')continue;
  for(const row of s.rows){const p=store.players.find(p=>p.id===row.id);p.monthlyRewards||=[];
   if(row.rank===1)p.monthlyRewards.push({month:m,kind:'champion'});if(row.rank<=10)p.monthlyRewards.push({month:m,kind:'top10'});if(row.clicks>=1000n)p.monthlyRewards.push({month:m,kind:'participant'});
   if(row.rank<=3){p.monthlyCards||=[];const metal=['gold','silver','bronze'][row.rank-1];p.monthlyCards.push({id:`monthly_${m.replace('-','')}_${metal}`,name:m.replace('-','년 ')+'월 '+['클릭왕','은빛 도전자','동빛 도전자'][row.rank-1],rarity:`월간 ${row.rank}위`,free:false,image:`images/profile-cards/monthly-${metal}.webp`});}
  }
 }
}
export function monthlyBadges(p){const catalog=(p.monthlyRewards||[]).filter(r=>r.kind==='participant').map(r=>({id:`monthly_${r.month.replace('-','')}_participant`,name:r.month.replace('-','년 ')+'월 참여 배지'}));return {badge_catalog:catalog,badge_equipped:p.monthlyBadge||null,monthly_badge:catalog.find(c=>c.id===p.monthlyBadge)?.name||null};}
export function monthlyAction(store,p,b){
 if('user_id' in b||'target_user_id' in b)fail(403,'본인 계정만 변경할 수 있습니다.');
 if(b.action==='monthly_badge_equip'){
  if(b.badge_id!==null&&!monthlyBadges(p).badge_catalog.some(c=>c.id===b.badge_id))fail(403,'보유하지 않은 배지입니다.');p.monthlyBadge=b.badge_id;return;
 }
 const current=month(now(store)),m=b.month??current;if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(m)||m<'2026-10'||m>current)fail(400,'집계 가능한 월을 선택해주세요.');
 monthlySettle(store);const s=seasons(store).get(m)||{counts:new Map()},all=(s.done?s.rows:ranked(store,s)).filter(c=>monthlyEligible(store.players.find(p=>p.id===c.id),now(store)));
 const rows=all.map(c=>({nickname:c.nickname,rank:c.rank,clicks:String(c.clicks),monthly_badge:monthlyBadges(store.players.find(p=>p.id===c.id)).monthly_badge}));
 const index=all.findIndex(c=>c.id===p?.id),[year,mon]=m.split('-').map(Number);
 return {month:m,trial:m<'2026-11',finalized:!!s.done,ends_at:new Date(Date.UTC(year,mon,1)-9*3600000).toISOString(),server_now:new Date(now(store)).toISOString(),seasons:[...new Set([...seasons(store).keys(),current])].sort().reverse(),rows:rows.filter(r=>r.rank<=100),me:index<0?{rank:null,clicks:'0'}:rows[index],eligible:monthlyEligible(p,now(store))};
}
