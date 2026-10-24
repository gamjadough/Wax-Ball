// Public ranking profiles; all ownership and visibility checks run on the server.
(() => {
 const $=id=>document.getElementById(id),read=()=>window.WakppuItemGame?.read();
 let data=null,owner=null,version=0,busy=false,profileVersion=0,activeNickname=null,opener=null,profileTab=false,rankFocusNickname=null,pendingRankFocus=null;
 const image='images/profile-cards/wax-beginning.png';
 const safeImage=card=>/^images\/profile-cards\/[a-z0-9-]+\.(png|webp)$/.test(card?.image||'')?card.image:image;
 function renderInventory(){
  if(!$('profileCardEquip'))return;
  const select=$('profileCardSelect'),ids=(data?.catalog||[]).map(c=>c.id);
  if(JSON.stringify(ids)!==select.dataset.ids){const current=select.value;select.replaceChildren(...(data?.catalog||[]).map(c=>new Option(c.name,c.id)));select.dataset.ids=JSON.stringify(ids);select.value=ids.includes(current)?current:(data?.equipped||ids[0]||'');}
  const card=data?.catalog?.find(c=>c.id===select.value),equipped=!!card&&data?.equipped===card.id,ready=!!data&&owner===read()?.account&&!busy&&read()?.ready&&!read()?.blocked;
  if(card){
   const champion=card.id==='golden_champion';
   $('profileInventoryArt').src=safeImage(card);$('profileInventoryArt').alt=champion?'황금 왕관과 월계관, 숫자 1이 새겨진 황금빛 왁뿌볼 카드':'황금빛 왁뿌볼이 놓인 보라색 배경의 기본 카드';
   $('profileInventoryName').textContent=card.name;$('profileInventoryRarity').textContent=card.rarity+(card.free?' · 무료 지급':champion?' · 영구 보관':' · 관리자 이용 가능');
   $('profileInventoryDescription').textContent=champion?'랭킹의 정점에 오른 플레이어에게 바치는 황금 왕관. 한 번 지급받으면 순위가 내려가도 계속 장착할 수 있습니다.':'처음 만나는 왁뿌볼의 따뜻한 빛. 모든 플레이어가 무료로 사용할 수 있습니다.';
   $('profileInventoryArt').closest('article').dataset.card=card.id;
  }
  $('profileCardEquip').textContent=equipped?'장착 중':'장착';$('profileCardEquip').disabled=!ready||equipped||!card;$('profileCardUnequip').disabled=!ready||!data?.equipped;$('profileCardSelf').disabled=!ready;
  $('profileCardState').textContent=equipped?'보유 중 · 현재 장착 중':'보유 중 · 미장착';
  const titles=$('profileTitleSelect'),catalog=data?.title_catalog||[];
  titles.replaceChildren(...catalog.map(t=>new Option(t.name,t.id)));titles.value=data?.title_equipped||'auto';titles.disabled=!ready;
  $('profileTitleSave').disabled=!ready;$('profileEquippedTitle').textContent='현재 칭호: '+(data?.title||'없음');
 }
 async function refresh(){
  const account=read()?.account,seq=++version;if(owner!==account){data=null;owner=account;}renderInventory();if(!account||!read()?.ready)return;
  try{const next=await WakppuAuth.invoke('profile_status');if(seq!==version||account!==read()?.account)return;data=next;renderInventory();}
  catch(e){if(seq===version)$('profileInventoryStatus').textContent=e.message;}
 }
 async function equip(card_id){
  if(busy||!data||owner!==read()?.account)return;const account=owner;busy=true;++version;renderInventory();
  try{const next=await WakppuAuth.invoke('profile_equip',{card_id});if(account!==read()?.account)return;data=next;$('profileInventoryStatus').textContent=card_id?'프로필 카드를 장착했습니다.':'카드를 해제했습니다. 기본 배경으로 표시됩니다.';}
  catch(e){if(account===read()?.account)$('profileInventoryStatus').textContent=e.message;}
  finally{busy=false;renderInventory();}
 }
 async function saveTitle(){
  if(busy||!data||owner!==read()?.account)return;const account=owner,title_id=$('profileTitleSelect').value;
  busy=true;++version;renderInventory();
  try{const next=await WakppuAuth.invoke('profile_title',{title_id});if(account!==read()?.account)return;data=next;$('profileInventoryStatus').textContent='칭호 설정을 저장했습니다.';window.WakppuPurchases?.refresh?.();}
  catch(e){if(account===read()?.account)$('profileInventoryStatus').textContent=e.message;}
  finally{busy=false;renderInventory();}
 }
 function showCards(){
  profileTab=true;for(const id of ['inventoryItemsPage','inventorySkinsPage','inventoryPetsPage'])$(id).hidden=true;
  $('inventoryProfileCardsPage').hidden=false;for(const id of ['inventoryItemsTab','inventorySkinsTab','inventoryPetsTab'])$(id).setAttribute('aria-pressed','false');$('inventoryProfileCardsTab').setAttribute('aria-pressed','true');refresh();
 }
 function close(){++profileVersion;activeNickname=null;const nickname=opener?.dataset.profileNickname;$('playerProfileDialog').close();if(opener?.isConnected)opener.focus();else if(nickname){rankFocusNickname=nickname;pendingRankFocus=nickname;linkRankings();}}
 function paintProfile(p){
  $('playerProfileDialog').dataset.card=p.card?.id||'';
  $('profileLoading').hidden=true;$('profileBody').hidden=false;
  $('profileNickname').textContent=p.nickname;$('profileTitle').textContent=p.title||'';$('profileTitle').hidden=!p.title;
  $('profilePresence').textContent=p.online?'온라인':'오프라인';$('profilePresence').dataset.online=String(!!p.online);
  $('profileArt').hidden=!p.card;if(p.card)$('profileArt').src=safeImage(p.card);$('profileCardBadge').textContent=p.card?p.card.name+' · '+p.card.rarity+' 카드':'기본 프로필 · 카드 미장착';
  $('profileRank').textContent=p.rank?`${p.rank}위`:'랭킹 외';$('profileGold').textContent=WakppuGold.compact(p.gold)+' G';$('profileGold').title=WakppuGold.integer(p.gold).toLocaleString('ko-KR')+' G';
  $('profileRebirths').textContent=Number(p.rebirths).toLocaleString('ko-KR')+'회';$('profileDiscoveries').textContent=p.discovered_count+' / '+p.discovery_total;
 }
 async function loadProfile(nickname,initial=false){
  const seq=++profileVersion,account=read()?.account;
  if(initial){$('profileBody').hidden=true;$('profileLoading').hidden=false;$('profileLoading').textContent='프로필을 불러오는 중…';}
  try{const p=await WakppuAuth.invoke('player_profile',{nickname});if(seq!==profileVersion||account!==read()?.account||!$('playerProfileDialog').open)return;paintProfile(p);}
  catch(e){if(seq===profileVersion&&$('playerProfileDialog').open){$('profileBody').hidden=true;$('profileLoading').hidden=false;$('profileLoading').textContent=e.message;}}
 }
 function open(nickname,source){
  if(!read()?.account)return;activeNickname=nickname;opener=source||document.activeElement;if(!$('playerProfileDialog').open)$('playerProfileDialog').showModal();loadProfile(nickname,true);
 }
 function linkRankings(){
  for(const span of $('rankingList').querySelectorAll('.ranking-nickname')){
   if(span.closest('.profile-rank-button'))continue;const copy=span.cloneNode(true);copy.querySelectorAll('i,small').forEach(n=>n.remove());const nickname=copy.textContent.trim();
   const button=document.createElement('button');button.type='button';button.className='profile-rank-button';button.setAttribute('aria-label',nickname+' 프로필 보기');button.dataset.profileNickname=nickname;
   const row=span.closest('li');button.append(...row.childNodes);row.append(button);button.onclick=()=>open(nickname,button);
  }
  if((pendingRankFocus||rankFocusNickname&&document.activeElement===document.body)&&!$('playerProfileDialog').open&&!$('ranking').hidden){
   const target=[...$('rankingList').querySelectorAll('.profile-rank-button')].find(b=>b.dataset.profileNickname===(pendingRankFocus||rankFocusNickname));if(target){pendingRankFocus=null;target.focus();}
  }
 }
 document.addEventListener('DOMContentLoaded',()=>{
  const dialog=document.createElement('dialog');dialog.id='playerProfileDialog';dialog.className='profile-dialog';dialog.setAttribute('aria-labelledby','profileDialogTitle');
  dialog.innerHTML=`<header class="profile-dialog-head"><h2 id="profileDialogTitle">플레이어 프로필</h2><button id="profileClose" class="btn small" type="button">닫기</button></header><p id="profileLoading" class="profile-loading" role="status"></p><article id="profileBody" hidden><div class="profile-hero"><img id="profileArt" width="1536" height="1024" decoding="async" alt=""><div class="profile-hero-top"><span id="profileCardBadge" class="profile-card-badge"></span><span id="profilePresence" class="profile-presence" role="status"></span></div><div class="profile-identity"><h3 id="profileNickname"></h3><span id="profileTitle" class="profile-player-title"></span></div></div><p class="profile-caption">왁뿌볼 플레이어 카드</p><dl class="profile-stats"><div><dt>현재 순위</dt><dd id="profileRank"></dd></div><div><dt>보유 Gold</dt><dd id="profileGold" class="profile-gold"></dd></div><div><dt>환생</dt><dd id="profileRebirths"></dd></div><div><dt>도감 발견</dt><dd id="profileDiscoveries"></dd></div></dl><p class="profile-footnote">현재 온라인 여부만 표시합니다. 개인 접속 기록은 공개하지 않습니다.</p></article>`;
  document.body.append(dialog);$('profileClose').onclick=close;dialog.addEventListener('keydown',e=>{if(e.key==='Escape')e.stopPropagation();});dialog.addEventListener('cancel',e=>{e.preventDefault();e.stopPropagation();close();});dialog.addEventListener('click',e=>{if(e.target===dialog&&e.clientX!==0){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
  const tabs=$('inventoryItemsTab').parentElement,tab=document.createElement('button');tab.id='inventoryProfileCardsTab';tab.type='button';tab.className='btn small';tab.textContent='프로필';tab.setAttribute('aria-pressed','false');tabs.append(tab);tab.onclick=showCards;
  const section=document.createElement('section');section.id='inventoryProfileCardsPage';section.hidden=true;section.innerHTML=`<h3>프로필 카드</h3><p>랭킹에서 플레이어를 누르면 장착한 카드로 프로필을 보여줍니다.</p><article class="profile-inventory-card"><img src="${image}" width="1536" height="1024" loading="lazy" decoding="async" alt="황금빛 왁뿌볼이 놓인 보라색 배경의 기본 카드"><div><small>기본 · 무료 지급</small><h4>왁스의 시작</h4><p id="profileCardState" class="profile-owned"></p><p>처음 만나는 왁뿌볼의 따뜻한 빛.<br>모든 플레이어가 무료로 사용할 수 있습니다.</p><div class="profile-inventory-actions"><button id="profileCardEquip" class="btn">장착</button><button id="profileCardUnequip" class="btn">장착 해제</button><button id="profileCardSelf" class="btn">내 프로필 보기</button></div></div></article><p id="profileInventoryStatus" role="status"></p><p>카드는 외형만 변경합니다. Gold·보상·능력치에는 영향을 주지 않습니다.</p>`;$('itemsModal').querySelector('.sheet').append(section);
  const select=document.createElement('select');select.id='profileCardSelect';select.setAttribute('aria-label','프로필 카드 선택');select.className='btn';section.querySelector('.profile-inventory-actions').before(select);select.onchange=renderInventory;
  const art=section.querySelector('img');art.id='profileInventoryArt';section.querySelector('h4').id='profileInventoryName';section.querySelector('small').id='profileInventoryRarity';
  section.querySelector('.profile-inventory-card p:not([id])').id='profileInventoryDescription';
  const championHelp=document.createElement('p');championHelp.className='profile-champion-help';championHelp.textContent='♛ 1위 기념 카드 「황금의 정점」 · 서버 랭킹 1위 달성 시 자동 지급 · 영구 보관';section.querySelector('h3').after(championHelp);
  art.style.height='auto';art.style.maxWidth='100%';section.querySelector('h3').textContent='프로필';
  const titleSettings=document.createElement('div');titleSettings.className='profile-title-settings';titleSettings.innerHTML='<label for="profileTitleSelect">칭호 선택</label><p id="profileEquippedTitle"></p><select id="profileTitleSelect"></select><button id="profileTitleSave" type="button" class="btn">칭호 적용</button><p>보유한 칭호만 선택할 수 있습니다. 칭호를 바꿔도 보상 배율은 변하지 않습니다.</p>';section.querySelector('#profileInventoryStatus').before(titleSettings);$('profileTitleSave').onclick=saveTitle;
  $('profileCardEquip').onclick=()=>equip(select.value);$('profileCardUnequip').onclick=()=>equip(null);$('profileCardSelf').onclick=()=>open(data.nickname,$('profileCardSelf'));
  tabs.addEventListener('click',e=>{if(e.target.closest('button')?.id!==tab.id){profileTab=false;section.hidden=true;tab.setAttribute('aria-pressed','false');}});
  const sync=window.WakppuSkins.syncInventory;window.WakppuSkins.syncInventory=()=>{sync();if(profileTab)showCards();};
  new MutationObserver(linkRankings).observe($('rankingList'),{childList:true});linkRankings();
  document.addEventListener('focusin',e=>{if(!dialog.open){pendingRankFocus=null;rankFocusNickname=e.target.closest?.('.profile-rank-button')?.dataset.profileNickname||null;}});
  window.addEventListener('wakppu-account-restored',()=>{if(dialog.open)close();++version;data=null;owner=null;refresh();});
  setInterval(()=>{if(activeNickname&&dialog.open&&!document.hidden)loadProfile(activeNickname);},15000);
  refresh();
 });
 window.WakppuProfiles={open,refresh};
})();
