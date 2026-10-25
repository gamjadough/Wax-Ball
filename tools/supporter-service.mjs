// Isolated loopback preview equivalent of wakppu_supporter_reward; not production authority.
import {petReward} from './halloween-pet-service.mjs';
import {gemReward} from './blue-gem-data.mjs';
export function supporterReward(actor,base){return gemReward(actor,petReward(actor,supporterRewardBeforePets(actor,base)));}
function supporterRewardBeforePets(actor,base){
 base=BigInt(base);const percent=actor.premiumSupporterPack?30n:actor.supporterPack?5n:0n;if(!percent||base===0n)return base;
 const parts=base*percent+BigInt(actor.supporterGoldRemainder||0);
 actor.supporterGoldRemainder=Number(parts%100n);return base+parts/100n;
}
