import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {adminContentAccess} from './admin-content.mjs';
import {gemState,gemSnapshot} from './blue-gem-data.mjs';
import {itemState,snapshot,itemData} from './items-service.mjs';
import {hammerDamage} from './hammer-catalog.mjs';
import {limitedSnapshot} from './limited-service.mjs';
const c={window:{}};vm.runInNewContext(readFileSync(new URL('../wakppuball/js/gem-ball-data.js',import.meta.url),'utf8'),c);
export const gemBalls=Array.from(c.window.WakppuGemBallData.balls,b=>({id:b.id,name:b.name,price:String(b.price),clicks:b.clicks,gem_reward:String(b.gemReward),unlock_order:b.unlockOrder,requires_ball_id:b.requiresBallId}));
export const gemBall=gemBalls[0];
export const gemBallState=a=>a.gemBalls||={owned:[],selected:null,clicks:0,requests:new Map()};
export const gemBallUsable=a=>!!gemBalls.find(b=>b.id===gemBallState(a).selected)&&(gemBallState(a).owned.includes(gemBallState(a).selected)||adminContentAccess(a));
export function gemBallSnapshot(a){const s=gemBallState(a);return {owned:[...s.owned],selected:gemBallUsable(a)?s.selected:null,clicks:s.clicks,admin_access:adminContentAccess(a),catalog:gemBalls};}
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
  const d=gemBalls.find(d=>d.id===b.ball_id);if(!d)fail('없는 볼입니다.');if(s.owned.includes(d.id))fail('이미 해금했습니다.',409);
  if(adminContentAccess(a))fail('관리자는 바로 선택할 수 있습니다.',409);
  if(d.requires_ball_id&&!s.owned.includes(d.requires_ball_id))fail('이전 푸른젬 볼을 먼저 해금해주세요.',403);
  const g=gemState(a);if(g.balance<BigInt(d.price))fail('푸른젬이 부족합니다.');g.balance-=BigInt(d.price);g.revision++;s.owned.push(d.id);
 }else if(b.action==='gem_ball_select'){
  if(!('ball_id' in b)||b.ball_id!==null&&!gemBalls.some(d=>d.id===b.ball_id))fail('없는 볼입니다.');
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
 const d=gemBalls.find(d=>d.id===s.selected);
 const hits=Math.min(d.clicks,s.clicks+hammerDamage(a.state.hammer_owned,a.state.hammer_level,a.state.hammer_selected_level)),broken=hits===d.clicks;
 const e=itemData.effective(inv.effects,0,0),ids=new Set(['animation','respawn','damage','add','difficulty'].map(k=>e[k]?.id).filter(Boolean));
 for(const id of ids){const d=itemData.list.find(d=>d.id===id);if(d&&!d.seconds&&(d.unit==='hit'||broken))inv.effects[id].remaining=Math.max(0,inv.effects[id].remaining-1);}
 if(broken){const g=gemState(a);g.balance+=BigInt(d.gem_reward);g.revision++;}
 s.clicks=broken?0:hits;inv.revision++;a.state.item_revision=inv.revision;
 const r={...snapshot(a),reward:'0',broken,clicks:hits,required_clicks:d.clicks,gem_reward:broken?d.gem_reward:'0',gem_balls:gemBallSnapshot(a),blue_gems:gemSnapshot(a)};
 inv.requests.set(b.request_id,{action:'item_hit',result:structuredClone(r)});return r;
}
