(function(root){
const ranks=[{id:'common',name:'일반',weight:7000,color:'#bec5cf'},{id:'rare',name:'희귀',weight:2200,color:'#65acff'},{id:'hero',name:'영웅',weight:600,color:'#ba86ff'},{id:'legendary',name:'전설',weight:190,color:'#ffb060'},{id:'transcendent',name:'초월',weight:10,color:'#ff6f88'}];
const list=[["common_honey_small","🍯","작은 꿀병","common",300,"honey",125,0],["common_crack_piece","🪨","균열 조각","common",0,"add",2,30],["common_wax_polish","✨","왁스 광택제","common",0,"reward",125,1],["common_mini_hammer","🔨","미니 망치","common",0,"add",3,20],["common_lucky_wax","🟡","행운의 왁스 조각","common",0,"reward",150,10],["rare_honey","🍯","고급 꿀병","rare",600,"honey",150,0],["rare_crack_booster","💥","균열 촉진제","rare",120,"damage",150,0],["rare_wax_coating","🧴","강화 왁스 코팅제","rare",0,"reward",200,5],["rare_iron_hammer","🔨","철제 망치","rare",0,"add",10,50],["rare_lucky_crystal","💎","행운의 균열석","rare",600,"reward",150,0],["hero_golden_honey","🍯✨","황금 꿀병","hero",900,"honey",200,0],["hero_explosion_crystal","💥","폭렬 균열석","hero",300,"damage",200,0],["hero_time_wax","⏱️","시간 정지 왁스","hero",180,"difficulty",50,0],["legendary_destruction_core","🔴","파괴의 핵","legendary",600,"damage",300,0],["legendary_golden_coating","✨","황금 파괴 코팅","legendary",0,"reward",400,20],["transcendent_wax_heart","♾️","왁뿌볼의 심장","transcendent",1800,"heart",300,0]].map(([id,icon,name,rank,seconds,group,value,count])=>({id,icon,name,rank,seconds,group,value,count,unit:group==='add'?'hit':'break'}));
list.push(...[
 ['common_candle','🕯️','작은 양초','common',300,'add',1,0],
 ['common_wax_thread','🧵','왁스 실','common',0,'add',2,20],
 ['common_wax_feather','🪶','가벼운 왁스 깃털','common',300,'animation',125,0],
 ['common_micro_elixir','🧪','미세 강화액','common',0,'reward',125,3],
 ['common_wax_coin','🪙','왁스 동전','common',0,'reward',120,10],
 ['rare_concentrated_honey','🍯','농축 꿀','rare',600,'honey',175,0],
 ['rare_strong_crack_booster','💥','강력 균열 촉진제','rare',180,'damage',175,0],
 ['rare_advanced_coating','🧴','고급 왁스 코팅제','rare',0,'reward',175,10],
 ['rare_reinforced_hammer','🔨','강화 철제 망치','rare',0,'add',15,50],
 ['rare_amplifying_crystal','💎','균열 증폭석','rare',600,'reward',175,0],
 ['hero_explosive_wax','🔥','폭발성 왁스','hero',300,'damage',250,0],
 ['hero_gem_honey','🍯💎','보석 꿀병','hero',900,'honey',250,0],
 ['hero_haste_wax','⚡','초가속 왁스','hero',300,'damage',200,0],
 ['hero_destruction_crystal','💎','파괴 증폭석','hero',0,'reward',300,10],
].map(([id,icon,name,rank,seconds,group,value,count])=>({id,icon,name,rank,seconds,group,value,count,unit:group==='add'?'hit':'break'})));
list.sort((a,b)=>ranks.findIndex(r=>r.id===a.rank)-ranks.findIndex(r=>r.id===b.rank));
const prices={1:'5000000000000000000',3:'14000000000000000000',5:'22000000000000000000'};
function channels(d){return d.group==='heart'?[['reward',300],['damage',200]]:d.id==='hero_haste_wax'?[['damage',200],['animation',150]]:[[d.group,d.value]];}
function description(d){const effect=channels(d).map(([g,v])=>g==='add'?'균열 +'+v:g==='difficulty'?'필요 타격량 ×'+v/100:(g==='damage'?'균열량':g==='animation'?'파괴 애니메이션 속도':'파괴 보상')+' ×'+v/100).join(' · ');return effect+' / '+(d.seconds?d.seconds/60+'분':'다음 '+d.count+(d.unit==='hit'?'클릭':'회 파괴'));}
function effective(effects,honey=0,coating=0,now=Date.now()){
 const winning={honey:{value:honey>now?200:100},reward:{value:coating>now?300:100},add:{value:0},damage:{value:100},difficulty:{value:100},animation:{value:100}};
 for(const d of list){const e=effects[d.id];if(!e||!(d.seconds?e.expires_at>now:e.remaining>0))continue;
  for(const [g,value] of channels(d))if(g==='difficulty'?value<winning[g].value:value>winning[g].value)winning[g]={value,id:d.id};
 }
 return winning;
}
function damage(base,e){return Math.max(1,Math.floor((base+e.add.value)*e.damage.value/100));}
function required(base,e,coated){return Math.max(1,Math.ceil(base*(coated?2:1)*e.difficulty.value/100));}
function reward(base,rebirth,goldEvent,e){return BigInt(base)*(2n**BigInt(rebirth))*BigInt(goldEvent)*BigInt(e.honey.value)*BigInt(e.reward.value)/10000n;}
root.WakppuItemData={ranks,list,prices,channels,description,effective,damage,required,reward};
})(typeof window==='undefined'?globalThis:window);
