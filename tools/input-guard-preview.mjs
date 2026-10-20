// Opt-in loopback sample data only; imported by local-server, never shipped to game HTML.
import {execute,guardState} from './input-guard-service.mjs';import {itemState} from './items-service.mjs';
export function scenario(store,mode){
 if(!['normal','fixed','macro','rate','reset'].includes(mode))throw new Error('알 수 없는 로컬 시나리오');
 const player=store.players[1];execute(store,store.players[0],{action:'admin_unban',user_id:player.id});delete player.inputGuard;
 const previous=store.input_now_ms,now=Date.now(),session=crypto.randomUUID();let last=null;
 const send=(action,extra={})=>execute(store,player,{action,request_id:crypto.randomUUID(),item_revision:itemState(player).revision,...extra});
 try{
  store.input_now_ms=now-54000;guardState(player,store.input_now_ms);
  if(mode==='rate'){
   for(let i=0;i<80;i++)send('item_hit');try{send('item_hit');}catch(e){if(e.status!==429)throw e;last={throttled:true,message:e.message};}
  }else if(mode!=='reset'){
   for(let step=0;step<3;step++){
    for(let i=0;i<36;i++){store.input_now_ms+=500;send('item_hit');}
    const dt=mode==='fixed'?150:100,jitter=mode==='normal'?23:0;
    const samples=Array.from({length:180},(_,i)=>[step*40000+i*dt+(i%2?jitter:0),500,500]);last=send('input_report',{session_id:session,samples});
   }
  }
  return {sample:true,result:last,moderation:player.moderation,records:execute(store,store.players[0],{action:'admin_input_guard'}),gold:String(player.state.gold)};
 }finally{if(previous===undefined)delete store.input_now_ms;else store.input_now_ms=previous;}
}
