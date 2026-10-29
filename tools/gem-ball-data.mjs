import {adminContentAccess} from './admin-content.mjs';
import {gemState,gemSnapshot} from './blue-gem-data.mjs';
import {itemState,snapshot,itemData} from './items-service.mjs';
import {hammerDamage} from './hammer-catalog.mjs';
import {limitedSnapshot} from './limited-service.mjs';
export const gemBall={id:'blue-crystal-wax',name:'푸른 수정 왁뿌볼',price:'5000',clicks:100,gem_reward:'5'};
export const gemBallState=a=>a.gemBalls||={owned:[],selected:null,clicks:0,requests:new Map()};
export const gemBallUsable=a=>!!gemBallState(a).selected&&(gemBallState(a).owned.includes(gemBallState(a).selected)||adminContentAccess(a));
export function gemBallSnapshot(a){const s=gemBallState(a);return {owned:[...s.owned],selected:gemBallUsable(a)?s.selected:null,clicks:s.clicks,admin_access:adminContentAccess(a),catalog:[gemBall]};}
const fail=(m,status=400)=>{throw Object.assign(Error(m),{status});};
export function gemBallAction(a,b,store={}){
 const s=gemBallState(a),inv=itemState(a);
 if(b.action==='gem_balls')return gemBallSnapshot(a);
 if(['user_id','target_user_id','price','gem_reward','owned','gold','clicks'].some(k=>k in b))fail('잘못된 요청입니다.',403);
 if(!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(b.request_id||''))fail('잘못된 요청 ID');
 const fp=JSON.stringify(Object.fromEntries(Object.entries(b).filter(([k])=>k!=='request_id'))),prior=s.requests.get(b.request_id);
 if(prior){if(prior.fp!==fp)fail('요청 ID 충돌',409);return structuredClone(prior.r);}
 if(b.item_revision!==inv.revision)fail('아이템 상태를 다시 불러옵니다.',409);
 if(b.action==='gem_ball_buy'){
  if(b.ball_id!==gemBall.id)fail('없는 볼입니다.');if(s.owned.includes(gemBall.id))fail('이미 해금했습니다.',409);
  if(adminContentAccess(a))fail('관리자는 바로 선택할 수 있습니다.',409);
  const g=gemState(a);if(g.balance<5000n)fail('푸른젬이 부족합니다.');g.balance-=5000n;g.revision++;s.owned.push(gemBall.id);
 }else if(b.action==='gem_ball_select'){
  if(!('ball_id' in b)||b.ball_id!==null&&b.ball_id!==gemBall.id)fail('없는 볼입니다.');
  if(b.ball_id&&!s.owned.includes(b.ball_id)&&!adminContentAccess(a))fail('미보유 볼입니다.',403);
  s.selected=b.ball_id;s.clicks=0;if(b.ball_id&&a.limited){a.limited.selected=null;a.limited.clicks=0;}
 }else fail('잘못된 작업입니다.');
 inv.revision++;a.state.item_revision=inv.revision;
 const r={...snapshot(a),gem_balls:gemBallSnapshot(a),blue_gems:gemSnapshot(a),limited:limitedSnapshot(store,a)};s.requests.set(b.request_id,{fp,r:structuredClone(r)});return r;
}
export function gemBallHit(a,b){
 const s=gemBallState(a),inv=itemState(a),prior=inv.requests.get(b.request_id);
 if(prior){if(prior.action!=='item_hit')fail('요청 ID 충돌',409);return structuredClone(prior.result);}
 if(!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(b.request_id||''))fail('잘못된 요청');
 if(b.item_revision!==inv.revision)fail('상태가 바뀌었습니다.',409);
 if(!gemBallUsable(a))fail('미보유 볼입니다.',403);
 const hits=Math.min(gemBall.clicks,s.clicks+hammerDamage(a.state.hammer_owned,a.state.hammer_level,a.state.hammer_selected_level)),broken=hits===gemBall.clicks;
 const e=itemData.effective(inv.effects,0,0),ids=new Set(['animation','respawn','damage','add','difficulty'].map(k=>e[k]?.id).filter(Boolean));
 for(const id of ids){const d=itemData.list.find(d=>d.id===id);if(d&&!d.seconds&&(d.unit==='hit'||broken))inv.effects[id].remaining=Math.max(0,inv.effects[id].remaining-1);}
 if(broken){const g=gemState(a);g.balance+=5n;g.revision++;}
 s.clicks=broken?0:hits;inv.revision++;a.state.item_revision=inv.revision;
 const r={...snapshot(a),reward:'0',broken,clicks:hits,required_clicks:100,gem_reward:broken?'5':'0',gem_balls:gemBallSnapshot(a),blue_gems:gemSnapshot(a)};
 inv.requests.set(b.request_id,{action:'item_hit',result:structuredClone(r)});return r;
}
