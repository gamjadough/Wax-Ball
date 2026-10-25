// Presentation only: keep existing candy transactions, ownership and inventory flows.
(() => {
 const root=document.getElementById('shopHalloween');if(!root)return;
 const tabs=[...root.querySelectorAll('[role="tab"]')];
 function select(tab,focus=false){
  const changed=tab.getAttribute('aria-selected')!=='true';
  for(const button of tabs){
   const active=button===tab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;
   document.getElementById(button.getAttribute('aria-controls')).hidden=!active;
  }
  if(changed)root.closest('.sheet').scrollTop=0;
  if(focus)tab.focus();
  if(tab.id==='halloweenPetsTab')window.WakppuHalloweenDecorUI?.refresh();
  else window.WakppuPumpkinInventory?.refresh();
 }
 for(const tab of tabs)tab.addEventListener('click',()=>select(tab));
 root.querySelector('[role="tablist"]').addEventListener('keydown',event=>{
  const index=tabs.indexOf(event.target);if(index<0)return;
  let next;
  if(event.key==='ArrowRight')next=(index+1)%tabs.length;
  else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;
  else if(event.key==='Home')next=0;
  else if(event.key==='End')next=tabs.length-1;
  else return;
  event.preventDefault();event.stopPropagation();select(tabs[next],true);
 });
})();
