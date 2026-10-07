import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const sandbox={};vm.runInNewContext(readFileSync(new URL('../wakppuball/js/items-data.js',import.meta.url),'utf8'),sandbox);
export const itemData=sandbox.WakppuItemData;
export function itemState(actor){return actor.items||=( {inventory:{},effects:{},pity:0,total:0,revision:0,requests:new Map()} );}
export function snapshot(actor){const s=itemState(actor);return {inventory:{...s.inventory},effects:structuredClone(s.effects),pity:s.pity,total:s.total,revision:s.revision,gold:String(actor.state.gold)};}
export function itemAction(actor,b,{rng=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296,now=Date.now()}={}){
 const s=itemState(actor),fail=(m,status=400)=>{throw Object.assign(new Error(m),{status});};
 if(b.action==='items')return snapshot(actor);
 if(!/^[a-f0-9-]{36}$/.test(b.request_id||''))fail('잘못된 요청입니다.');
 const cached=s.requests.get(b.request_id);if(cached){if(cached.action!==b.action)fail('다른 작업에서 사용한 요청 ID입니다.');return structuredClone(cached.result);}
 if(b.item_revision!==s.revision)fail('아이템 상태가 바뀌었습니다. 다시 불러옵니다.',409);
 let results=[];
 if(b.action==='item_draw'){
  if(![1,3,5].includes(b.count))fail('뽑기 횟수를 확인해주세요.');
  const cost=BigInt(itemData.prices[b.count]);if(BigInt(actor.state.gold)<cost)fail('Gold가 부족합니다.');
  for(let i=0;i<b.count;i++){
   let rank='transcendent';
   if(s.pity<99){let roll=Math.floor(rng()*10000);rank=itemData.ranks.find(r=>{roll-=r.weight;return roll<0;}).id;}
   const options=itemData.list.filter(d=>d.rank===rank),d=options[Math.min(options.length-1,Math.floor(rng()*options.length))];
   s.inventory[d.id]=(s.inventory[d.id]||0)+1;s.pity=rank==='transcendent'?0:s.pity+1;s.total++;results.push(d.id);
  }
  actor.state.gold=(BigInt(actor.state.gold)-cost).toString();
 }else if(b.action==='item_use'){
  const d=itemData.list.find(d=>d.id===b.item_id);if(!d||!(s.inventory[d.id]>0))fail('보유한 아이템이 없습니다.');
  const e=s.effects[d.id]||{};
  if(d.seconds){const end=Math.max(now,e.expires_at||0)+d.seconds*1000;if(end>now+7*86400000)fail('최대 연장 시간은 7일입니다.');s.effects[d.id]={expires_at:end};}
  else s.effects[d.id]={remaining:(e.remaining||0)+d.count};
  s.inventory[d.id]--;
 }else fail('알 수 없는 아이템 작업입니다.');
 s.revision++;actor.state.item_revision=s.revision;
 const result={...snapshot(actor),results};s.requests.set(b.request_id,{action:b.action,result:structuredClone(result)});return result;
}
export function consumeEffects(actor,unit,now=Date.now()){
 const s=itemState(actor),e=itemData.effective(s.effects,Date.parse(actor.state.honey_expires_at),Date.parse(actor.state.coating_expires_at),now);
 for(const id of new Set(Object.values(e).map(x=>x.id).filter(Boolean))){const d=itemData.list.find(d=>d.id===id);if(!d.seconds&&d.unit===unit)s.effects[id].remaining=Math.max(0,s.effects[id].remaining-1);}
}
