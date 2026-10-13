// Local test model only. Production authority is the PostgreSQL migration.
export const weeklyRows=s=>s.weekly_events||=(['friday-morning','friday-evening'].map((id,i)=>({id,weekday:5,local_time:i?'21:00:00':'07:00:00',ball_seconds:i?900:600,gold_seconds:600,multiplier:i?100:10,enabled:false,skip_gold:null,skip_ball:null})));
export function weeklyCandidate(rows,kind,now=Date.now()){
 const kst=new Date(now+9*3600000),monday=Date.UTC(kst.getUTCFullYear(),kst.getUTCMonth(),kst.getUTCDate())-((kst.getUTCDay()+6)%7)*86400000,events=[];
 for(const r of rows.filter(r=>r.enabled))for(let w=-1;w<=2;w++){
  const [h,m,sec]=r.local_time.split(':').map(Number),start=monday+(r.weekday-1+w*7)*86400000+(h*3600+m*60+(sec||0))*1000-9*3600000,end=start+(kind==='gold'?r.gold_seconds:r.ball_seconds)*1000;
  if(end<=now||new Date(start+9*3600000).toISOString().slice(0,10)===r['skip_'+kind])continue;
  events.push({id:'weekly:'+r.id+':'+Math.floor(start/1000),source:'weekly',schedule_id:r.id,starts_at:new Date(start).toISOString(),ends_at:new Date(end).toISOString(),...(kind==='gold'?{multiplier:r.multiplier}:{})});
 }
 return events.sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at))[0]||null;
}
export function refreshWeekly(s,now=Date.now()){if(!s.weekly_events||s.maintenance)return;for(const [kind,key] of [['gold','gold_event'],['ball','admin_ball_event']]){const e=s[key];if(e&&e.source!=='weekly'&&Date.parse(e.ends_at)>now)continue;s[key]=weeklyCandidate(s.weekly_events,kind,now);}}
export function skipWeekly(s,kind){const e=s[kind==='gold'?'gold_event':'admin_ball_event'];if(e?.source==='weekly'){const r=weeklyRows(s).find(r=>r.id===e.schedule_id);r['skip_'+kind]=new Date(Date.parse(e.starts_at)+9*3600000).toISOString().slice(0,10);}}
