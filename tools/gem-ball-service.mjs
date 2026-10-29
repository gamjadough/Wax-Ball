import {execute as previous} from './ember-auto-service.mjs';
import {gemBallAction,gemBallState,gemBallSnapshot} from './gem-ball-data.mjs';
export function execute(store,actor,b){
 if(['gem_balls','gem_ball_buy','gem_ball_select'].includes(b.action)){previous(store,actor,{action:'bootstrap'});return gemBallAction(actor,b,store);}
 const oldRebirth=actor?.state.rebirths,oldBall=actor?.state.selected_ball_id,r=previous(store,actor,b);
 if(actor){
  const s=gemBallState(actor);
  if(b.action==='limited_select'&&b.ball_id||b.action==='save_progress'&&oldBall!==actor.state.selected_ball_id){s.selected=null;s.clicks=0;}
  if(actor.state.rebirths>oldRebirth)s.clicks=0;
  if(['bootstrap','items','item_hit','limited_select','limited_hit','ember_auto_hit','save_progress'].includes(b.action)||b.action?.startsWith('auto_rebirth_'))return {...r,gem_balls:gemBallSnapshot(actor)};
 }
 return r;
}
