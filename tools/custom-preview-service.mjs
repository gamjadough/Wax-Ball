// Opt-in fixture for the loopback custom studio. Never imported by the live application.
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {execute} from './input-guard-service.mjs';
import {limitedState} from './limited-service.mjs';
const c=vm.createContext({window:{}});
vm.runInContext(await readFile(new URL('../wakppuball/js/balls-data.js',import.meta.url),'utf8')+';window.catalog=WAKPPU_BALLS.map(b=>b.id);',c);
const ids=[...c.window.catalog];
export function prepare(store,actor,id){
 if(!actor)throw Object.assign(new Error('로컬 샘플 로그인이 필요합니다.'),{status:401});
 if(!ids.includes(id)&&!['admin-event','halloween-pumpkin-2026'].includes(id))throw new Error('잘못된 볼');
 const limited=limitedState(actor);limited.selected=id==='halloween-pumpkin-2026'?id:null;
 if(limited.selected){store.limited_preview='active';limited.owned[id]={reward:'1500000000'};limited.clicks=0;}
 if(id==='admin-event'){
  execute(store,store.players[0],{action:'admin_ball_event',mode:'start',duration_seconds:3600,delay_seconds:0});
  // The local sleep preview clock and the gameplay clock deliberately differ.
  const event=store.manual_ball_event,now=Date.now(),preview=store.sleep_now_ms??now;
  event.starts_at=new Date(Math.min(now,preview)-1000).toISOString();
  event.ends_at=new Date(Math.max(now,preview)+3600000).toISOString();
 }
 else execute(store,store.players[0],{action:'admin_ball_event',mode:'stop'});
 actor.state.unlocked_ball_ids=[...ids];actor.state.discovered_ball_ids=[...ids];
 actor.state.selected_ball_id=ids.includes(id)?id:'yellow';actor.state.current_ball_id=actor.state.selected_ball_id;actor.state.current_clicks=0;
 return {ok:true};
}
