import {execute as previous} from './blue-gems-service.mjs';
import {equippedPet} from './halloween-pet-service.mjs';
export function execute(store,actor,b){
 const {hit_source,...clean}=b;
 if(b.action!=='ember_auto_hit')return previous(store,actor,clean);
 previous(store,actor,{action:'bootstrap'});
 const fail=(message,status)=>{throw Object.assign(Error(message),{status});};
 if(!['item_hit','limited_hit'].includes(b.hit_action)||'user_id' in b||'target_user_id' in b||!/^[a-f0-9-]{36}$/.test(b.request_id||''))fail('잘못된 자동 공격입니다.',400);
 if(equippedPet(actor)!=='pumpkin_ember')fail('잭오랜턴 불씨를 장착해야 합니다.',403);
 const pet=actor.halloweenDecor,cache=pet.emberRequests||=new Map(),fp=JSON.stringify(clean),prior=cache.get(b.request_id);
 if(prior){if(prior.fp!==fp)fail('요청 ID 충돌',409);return structuredClone(prior.response);}
 const now=store.input_now_ms??Date.now();if(pet.emberLastHit!=null&&now-pet.emberLastHit<1000)fail('불씨는 1초마다 공격합니다.',429);
 const r=previous(store,actor,{...clean,action:b.hit_action,hit_source:'ember_auto'});
 pet.emberLastHit=now;cache.set(b.request_id,{fp,response:structuredClone(r)});if(cache.size>64)cache.delete(cache.keys().next().value);
 return r;
}
