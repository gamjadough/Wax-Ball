import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {hammerDamage} from './hammer-catalog.mjs';
import {itemState,snapshot,itemData,consumeEffects} from './items-service.mjs';
const sandbox={window:{}};vm.runInNewContext(readFileSync(new URL('../wakppuball/js/limited-data.js',import.meta.url),'utf8'),sandbox);
export const limitedData=sandbox.window.WakppuLimitedData;
export const limitedState=a=>{const s=a.limited||={tokens:0,owned:{},selected:null,clicks:0,requests:new Map()};if(s.owned[limitedData.ball.id])s.owned[limitedData.ball.id].reward=String(limitedData.ball.reward);return s;};
export const limitedActive=store=>store.limited_preview==='active'||(!store.limited_preview&&Date.now()>=Date.parse(limitedData.season.starts_at)&&Date.now()<Date.parse(limitedData.season.ends_at));
export function limitedSnapshot(store,actor){const s=limitedState(actor);return {season:{...limitedData.season,active:limitedActive(store)},tokens:s.tokens,owned:structuredClone(s.owned),selected:s.selected,clicks:s.clicks};}
export function limitedAction(store,actor,b,catalog,rng=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296){
 const s=limitedState(actor),inv=itemState(actor),fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
 if(b.action==='limited')return limitedSnapshot(store,actor);
 if(!/^[a-f0-9-]{36}$/.test(b.request_id||''))fail('잘못된 요청 ID');
 const cached=s.requests.get(b.request_id);if(cached){if(cached.action!==b.action)fail('요청 ID 충돌');return structuredClone(cached.result);}
 if(b.item_revision!==inv.revision)fail('상태를 다시 불러옵니다.',409);
 let hit={};
 if(b.action==='limited_buy'){
  if(!limitedActive(store))fail('할로윈 이벤트 기간이 아닙니다.',409);
  if(s.owned[limitedData.ball.id])fail('이미 보유한 한정 볼입니다.',409);
  if(s.tokens<100)fail('할로윈 사탕이 부족합니다.');
  s.tokens-=100;s.owned[limitedData.ball.id]={reward:String(limitedData.ball.reward)};
 }else if(b.action==='limited_select'){
  if(b.ball_id!==null&&!s.owned[b.ball_id])fail('보유한 한정 볼이 아닙니다.');
  s.selected=b.ball_id;s.clicks=0;
 }else if(b.action==='limited_hit'){
  if(!s.selected||!s.owned[s.selected])fail('한정 볼을 선택해주세요.');
  const now=Date.now(),e=itemData.effective(inv.effects,Date.parse(actor.state.honey_expires_at),Date.parse(actor.state.coating_expires_at),now);
  const required=itemData.required(100,e,Date.parse(actor.state.coating_expires_at)>now),clicks=Math.min(required,s.clicks+itemData.damage(hammerDamage(actor.state.hammer_owned,actor.state.hammer_level),e));
  consumeEffects(actor,'hit',now);let reward=0n;
  if(clicks===required){const g=store.gold_event;reward=itemData.reward(limitedData.ball.reward,actor.state.rebirths,g&&now>=Date.parse(g.starts_at)&&now<Date.parse(g.ends_at)?g.multiplier:1,e);actor.state.gold=String(BigInt(actor.state.gold)+reward);consumeEffects(actor,'break',now);}
  s.clicks=clicks===required?0:clicks;hit={clicks,required_clicks:required,reward:String(reward)};
 }else fail('잘못된 한정 볼 요청');
 inv.revision++;actor.state.item_revision=inv.revision;const result={...snapshot(actor),...hit,limited:limitedSnapshot(store,actor)};
 s.requests.set(b.request_id,{action:b.action,result:structuredClone(result)});return result;
}
export function limitedDrop(store,actor,request,result,rng=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296){
 const s=limitedState(actor),key='drop:'+request.request_id;
 if(s.requests.has(key))return structuredClone(s.requests.get(key));
 let dropped=false;if(!request.event_id&&BigInt(result.reward)>0n&&limitedActive(store)&&rng()<.1){s.tokens++;dropped=true;}
 const next={...result,limited:limitedSnapshot(store,actor),candy_drop:dropped};s.requests.set(key,structuredClone(next));return next;
}
