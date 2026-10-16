// Local-only adapter mirrors the production transaction around manual mutations.
import {execute as base} from './admin-service.mjs';
import {refreshWeekly,weeklyRows,weeklyCandidate} from './weekly-service.mjs';
export function execute(store,actor,b){
 if(!store.separated_events){
  store.separated_events=true;weeklyRows(store);
  store.manual_gold_event=store.gold_event?.source==='weekly'?null:store.gold_event||null;
  store.manual_ball_event=store.admin_ball_event?.source==='weekly'?null:store.admin_ball_event||null;
 }
 const mutation=['admin_gold_event','admin_ball_event','admin_event_schedule','admin_event_schedule_cancel'].includes(b.action);
 let result;
 if(mutation){
  store._manual_editing=true;store.gold_event=store.manual_gold_event;store.admin_ball_event=store.manual_ball_event;
  try{result=base(store,actor,b);store.manual_gold_event=store.gold_event;store.manual_ball_event=store.admin_ball_event;}
  finally{store._manual_editing=false;refreshWeekly(store);}
  result={...result,gold_event:store.gold_event||null,admin_ball_event:store.admin_ball_event||null};
 }else result=base(store,actor,b);
 if(b.action==='status'||mutation||b.action==='admin_weekly_events'){
  const blocked=store.maintenance||result.sleep_hours?.active&&actor?.role!=='admin';
  const live=e=>!blocked&&e&&Date.parse(e.ends_at)>Date.now()?e:null;
  return {...result,manual_gold_event:live(store.manual_gold_event),manual_ball_event:live(store.manual_ball_event),
   ...(actor?.role==='admin'?{weekly_gold_event:weeklyCandidate(weeklyRows(store),'gold'),weekly_ball_event:weeklyCandidate(weeklyRows(store),'ball')}:{})};
 }
 return result;
}
