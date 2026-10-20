// Isolated loopback preview equivalent of wakppu_supporter_reward; not production authority.
export function supporterReward(actor,base){
 base=BigInt(base);if(!actor.supporterPack||base===0n)return base;
 const parts=base*5n+BigInt(actor.supporterGoldRemainder||0);
 actor.supporterGoldRemainder=Number(parts%100n);return base+parts/100n;
}
