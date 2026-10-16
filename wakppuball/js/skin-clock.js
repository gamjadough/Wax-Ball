// Korean standard time, independent of the viewer's local timezone.
(() => {
 function angles(instant=Date.now()){
  const date=new Date(Number(instant)+9*60*60*1000);
  const second=date.getUTCSeconds()+date.getUTCMilliseconds()/1000;
  const minute=date.getUTCMinutes()+second/60;
  return {hour:(date.getUTCHours()%12+minute/60)*30,minute:minute*6};
 }
 function update(root=document,instant=Date.now()){
  const time=angles(instant);
  root.querySelectorAll('[data-clock-hand]').forEach(hand=>{
   const angle=time[hand.dataset.clockHand];
   if(Number.isFinite(angle))hand.setAttribute('transform',`rotate(${angle} 100 100)`);
  });
 }
 window.WakppuSkinClock={angles,update};
 document.addEventListener('DOMContentLoaded',()=>{update();setInterval(()=>{if(!document.hidden)update();},1000);});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});
})();
