import {execute as previous} from './input-guard-service.mjs';
import {gemSnapshot,gemBuy} from './blue-gem-data.mjs';
export function execute(store,actor,b){
 if(['blue_gems','blue_gem_buy'].includes(b.action)){
  previous(store,actor,{action:'bootstrap'});
  return b.action==='blue_gems'?gemSnapshot(actor):gemBuy(actor,b);
 }
 const r=previous(store,actor,b);
 if(actor&&['item_hit','limited_hit','event_ball_hit','bootstrap','items','save_progress'].includes(b.action))return {...r,blue_gems:gemSnapshot(actor)};
 return r;
}
