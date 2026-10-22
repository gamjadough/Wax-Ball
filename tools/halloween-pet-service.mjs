import {adminContentAccess} from './admin-content.mjs';
export function equippedPet(actor){const c=actor?.halloweenDecor;return c?.equipped&&(c.owned[c.equipped]||adminContentAccess(actor))?c.equipped:null;}
export function petTiming(actor){const equipped=equippedPet(actor);return {equipped,animation:equipped==='pumpkin_ember'?.9:1,respawn:equipped==='bat_swarm'?.9:1};}
export function petReward(actor,base){base=BigInt(base);if(equippedPet(actor)!=='little_ghost'||base===0n)return base;const c=actor.halloweenDecor,parts=base*10n+BigInt(c.petGoldRemainder||0);c.petGoldRemainder=Number(parts%100n);return base+parts/100n;}
