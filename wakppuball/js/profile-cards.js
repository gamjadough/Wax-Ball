// Public ranking profiles; all ownership and visibility checks run on the server.
(() => {
 const $=id=>document.getElementById(id),read=()=>window.WakppuItemGame?.read();
 let data=null,owner=null,version=0,busy=false,profileVersion=0,activeNickname=null,opener=null,profileTab=false,rankFocusNickname=null,pendingRankFocus=null;
 const image='images/profile-cards/wax-beginning.png';
 const titleTheme=text=>text?.includes('마녀의 계약자')?'witch':text?.includes('유령의 친구')?'ghost':text?.includes('호박불의 수호자')?'pumpkin':'';
 const cardDetails={
  halloween_witch:{note:' · 할로윈 한정 · 영구 보관',alt:'보랏빛 마법진과 초승달에 둘러싸인 마녀의 구체',description:'마녀의 심야. 초승달 아래 새겨진 비밀스러운 계약을 기념합니다.'},
  halloween_ghost:{note:' · 할로윈 한정 · 영구 보관',alt:'유령 불빛이 감도는 달빛 아래 오래된 저택',description:'유령의 저택. 안개 너머에서 건네는 창백한 빛을 기념합니다.'},
  halloween_pumpkin:{note:' · 할로윈 한정 · 영구 보관',alt:'수확의 달 아래 빛나는 잭오랜턴과 가을 불씨',description:'잭오랜턴의 밤. 깊은 밤을 지키는 따뜻한 호박불을 기념합니다.'},
  golden_champion:{note:' · 영구 보관',alt:'황금 왕관과 월계관, 숫자 1이 새겨진 황금빛 왁뿌볼 카드',description:'랭킹의 정점에 오른 플레이어에게 바치는 황금 왕관. 한 번 지급받으면 순위가 내려가도 계속 장착할 수 있습니다.'},
  supporter_glow:{note:' · 후원팩 보유 혜택',alt:'은은한 호박빛 구체와 작은 별이 빛나는 후원자 카드',description:'따뜻한 응원에 감사하는 은은한 호박빛 별. 응원팩 또는 프리미엄 후원팩 보유 시 사용할 수 있습니다. 환생해도 유지되며, 환불·지급 회수 시 사용 권한도 회수됩니다.'},
  premium_celestial:{note:' · 프리미엄 보유 혜택',alt:'보석 장식과 찬란한 별빛으로 둘러싸인 프리미엄 구체 카드',description:'찬란한 보석과 성좌가 수놓인 프리미엄 전용 카드. 「따뜻한 응원」 카드도 함께 사용할 수 있습니다. 환생해도 유지되며, 환불·지급 회수 시 해당 사용 권한도 회수됩니다.'}
 };
 const safeImage=card=>/^images\/profile-cards\/[a-z0-9-]+\.(png|webp|svg)$/.test(card?.image||'')?card.image:image;
 function renderInventory(){
  if(!$('profileCardEquip'))return;
  const select=$('profileCardSelect'),ids=(data?.catalog||[]).map(c=>c.id);
  if(JSON.stringify(ids)!==select.dataset.ids){const current=select.value;select.replaceChildren(...(data?.catalog||[]).map(c=>new Option(c.name,c.id)));select.dataset.ids=JSON.stringify(ids);select.value=ids.includes(current)?current:(data?.equipped||ids[0]||'');}
  const card=data?.catalog?.find(c=>c.id===select.value),equipped=!!card&&data?.equipped===card.id,ready=!!data&&owner===read()?.account&&!busy&&read()?.ready&&!read()?.blocked;
  if(card){
   const detail=cardDetails[card.id]||(card.id.startsWith('monthly_')?{note:' · 영구 보관',alt:card.name+' 초승달과 별자리, 시간의 고리가 빛나는 기념 카드',description:'월간 수동 클릭 랭킹에서 획득한 기념 카드입니다. 해당 월의 기록으로 영구 보관하며 능력치는 변경하지 않습니다.'}:null);
   $('profileInventoryArt').src=safeImage(card);$('profileInventoryArt').alt=detail?.alt||'황금빛 왁뿌볼이 놓인 보라색 배경의 기본 카드';
   $('profileInventoryName').textContent=card.name;$('profileInventoryRarity').textContent=card.rarity+(card.free?' · 무료 지급':detail?.note||' · 관리자 이용 가능');
   $('profileInventoryDescription').textContent=detail?.description||'처음 만나는 왁뿌볼의 따뜻한 빛. 모든 플레이어가 무료로 사용할 수 있습니다.';
   $('profileInventoryArt').closest('article').dataset.card=card.id;
  }
  $('profileCardEquip').textContent=equipped?'장착 중':'장착';$('profileCardEquip').disabled=!ready||equipped||!card;$('profileCardUnequip').disabled=!ready||!data?.equipped;$('profileCardSelf').disabled=!ready;
  $('profileCardState').textContent=equipped?'보유 중 · 현재 장착 중':'보유 중 · 미장착';
  const titles=$('profileTitleSelect'),catalog=data?.title_catalog||[];
  titles.replaceChildren(...catalog.map(t=>new Option(t.name,t.id)));titles.value=data?.title_equipped||'auto';titles.disabled=!ready;
  $('profileTitleSave').disabled=!ready;$('profileEquippedTitle').textContent='현재 칭호: '+(data?.title||'없음');
  $('profileEquippedTitle').dataset.halloweenTitle=titleTheme(data?.title);
  $('profileEquippedTitle').classList.toggle('champion-title',data?.title==='👑 왁뿌볼의 정점');
  const badges=$('profileBadgeSelect');badges.replaceChildren(new Option('배지 없음',''),...(data?.badge_catalog||[]).map(b=>new Option(b.name,b.id)));badges.value=data?.badge_equipped||'';badges.disabled=!ready;$('profileBadgeSave').disabled=!ready;
  $('profileBadgeOwned').textContent=data?.badge_catalog?.length?'월간 참여 배지 · 영구 보관':'월간 1,000클릭 달성 후 월말 확정 시 참여 배지를 받습니다.';
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
 async function saveBadge(){
  if(busy||!data||owner!==read()?.account)return;const account=owner,badge_id=$('profileBadgeSelect').value||null;
  busy=true;++version;renderInventory();
  try{const next=await WakppuAuth.invoke('monthly_badge_equip',{badge_id});if(account!==read()?.account)return;data=next;$('profileInventoryStatus').textContent=badge_id?'참여 배지를 장착했습니다.':'참여 배지를 해제했습니다.';}
  catch(e){if(account===read()?.account)$('profileInventoryStatus').textContent=e.message;}
  finally{busy=false;renderInventory();}
 }
 function showCards(){
  profileTab=true;for(const id of ['inventoryItemsPage','inventorySkinsPage','inventoryPetsPage'])$(id).hidden=true;
  $('inventoryProfileCardsPage').hidden=false;for(const id of ['inventoryItemsTab','inventorySkinsTab','inventoryPetsTab'])$(id).setAttribute('aria-pressed','false');$('inventoryProfileCardsTab').setAttribute('aria-pressed','true');refresh();
 }
 function close(){++profileVersion;activeNickname=null;const nickname=opener?.dataset.profileNickname;$('playerProfileDialog').close();if(opener?.isConnected)opener.focus();else if(nickname&&window.WakppuMonthly?.active){window.WakppuMonthly.focus(nickname);}else if(nickname){rankFocusNickname=nickname;pendingRankFocus=nickname;linkRankings();}}
 function paintProfile(p){
  $('playerProfileDialog').dataset.card=p.card?.id||'';
  $('profileLoading').hidden=true;$('profileBody').hidden=false;
  $('profileNickname').textContent=p.nickname;$('profileTitle').textContent=p.title||'';$('profileTitle').hidden=!p.title;
  $('profileTitle').dataset.halloweenTitle=titleTheme(p.title);
  $('profileTitle').classList.toggle('champion-title',p.title==='👑 왁뿌볼의 정점');
  $('profileMonthlyBadge').textContent=p.monthly_badge?'🏅 '+p.monthly_badge:'';$('profileMonthlyBadge').hidden=!p.monthly_badge;
  $('profilePresence').textContent=p.online?'온라인':'오프라인';$('profilePresence').dataset.online=String(!!p.online);
  $('profileArt').hidden=!p.card;if(p.card)$('profileArt').src=safeImage(p.card);$('profileCardBadge').textContent=p.card?p.card.name+' · '+p.card.rarity+(p.card.id.startsWith('monthly_')?'':' 카드'):'기본 프로필 · 카드 미장착';
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
   const title=span.querySelector('small');if(title){title.classList.toggle('champion-title',title.textContent==='👑 왁뿌볼의 정점');title.dataset.halloweenTitle=titleTheme(title.textContent);}
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
  const badge=document.createElement('span');badge.id='profileMonthlyBadge';badge.className='monthly-badge';dialog.querySelector('.profile-identity').append(badge);
  document.body.append(dialog);$('profileClose').onclick=close;dialog.addEventListener('keydown',e=>{if(e.key==='Escape')e.stopPropagation();});dialog.addEventListener('cancel',e=>{e.preventDefault();e.stopPropagation();close();});dialog.addEventListener('click',e=>{if(e.target===dialog&&e.clientX!==0){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
  const tabs=$('inventoryItemsTab').parentElement,tab=document.createElement('button');tab.id='inventoryProfileCardsTab';tab.type='button';tab.className='btn small';tab.textContent='프로필';tab.setAttribute('aria-pressed','false');tabs.append(tab);tab.onclick=showCards;
  const section=document.createElement('section');section.id='inventoryProfileCardsPage';section.hidden=true;section.innerHTML=`<h3>프로필 카드</h3><p>랭킹에서 플레이어를 누르면 장착한 카드로 프로필을 보여줍니다.</p><article class="profile-inventory-card"><img src="${image}" width="1536" height="1024" loading="lazy" decoding="async" alt="황금빛 왁뿌볼이 놓인 보라색 배경의 기본 카드"><div><small>기본 · 무료 지급</small><h4>왁스의 시작</h4><p id="profileCardState" class="profile-owned"></p><p>처음 만나는 왁뿌볼의 따뜻한 빛.<br>모든 플레이어가 무료로 사용할 수 있습니다.</p><div class="profile-inventory-actions"><button id="profileCardEquip" class="btn">장착</button><button id="profileCardUnequip" class="btn">장착 해제</button><button id="profileCardSelf" class="btn">내 프로필 보기</button></div></div></article><p id="profileInventoryStatus" role="status"></p><p>카드는 외형만 변경합니다. Gold·보상·능력치에는 영향을 주지 않습니다.</p>`;$('itemsModal').querySelector('.sheet').append(section);
  const select=document.createElement('select');select.id='profileCardSelect';select.setAttribute('aria-label','프로필 카드 선택');select.className='btn';section.querySelector('.profile-inventory-actions').before(select);select.onchange=renderInventory;
  const art=section.querySelector('img');art.id='profileInventoryArt';section.querySelector('h4').id='profileInventoryName';section.querySelector('small').id='profileInventoryRarity';
  section.querySelector('.profile-inventory-card p:not([id])').id='profileInventoryDescription';
  const championHelp=document.createElement('p');championHelp.className='profile-champion-help';championHelp.textContent='♛ 1위 기념 카드 「황금의 정점」 · 서버 랭킹 1위 달성 시 자동 지급 · 영구 보관';section.querySelector('h3').after(championHelp);
  art.style.height='auto';art.style.maxWidth='100%';section.querySelector('h3').textContent='프로필';
  const titleSettings=document.createElement('div');titleSettings.className='profile-title-settings';titleSettings.innerHTML='<label for="profileTitleSelect">칭호 선택</label><p id="profileEquippedTitle"></p><select id="profileTitleSelect"></select><button id="profileTitleSave" type="button" class="btn">칭호 적용</button><p>보유한 칭호만 선택할 수 있습니다. 칭호를 바꿔도 보상 배율은 변하지 않습니다.</p>';section.querySelector('#profileInventoryStatus').before(titleSettings);$('profileTitleSave').onclick=saveTitle;
  const badgeSettings=document.createElement('div');badgeSettings.className='profile-badge-settings';badgeSettings.innerHTML='<label for="profileBadgeSelect">월간 참여 배지</label><p id="profileBadgeOwned"></p><select id="profileBadgeSelect"></select><button id="profileBadgeSave" type="button" class="btn">배지 적용</button>';section.querySelector('#profileInventoryStatus').before(badgeSettings);$('profileBadgeSave').onclick=saveBadge;
  $('profileCardEquip').onclick=()=>equip(select.value);$('profileCardUnequip').onclick=()=>equip(null);$('profileCardSelf').onclick=()=>open(data.nickname,$('profileCardSelf'));
  tabs.addEventListener('click',e=>{if(e.target.closest('button')?.id!==tab.id){profileTab=false;section.hidden=true;tab.setAttribute('aria-pressed','false');}});
  const sync=window.WakppuSkins.syncInventory;window.WakppuSkins.syncInventory=()=>{sync();if(profileTab)showCards();};
  new MutationObserver(linkRankings).observe($('rankingList'),{childList:true});linkRankings();
  document.addEventListener('focusin',e=>{if(!dialog.open){pendingRankFocus=null;rankFocusNickname=e.target.closest?.('.profile-rank-button')?.dataset.profileNickname||null;}});
  window.addEventListener('wakppu-account-restored',()=>{if(dialog.open)close();++version;data=null;owner=null;refresh();});
  setInterval(()=>{if(document.hidden)return;if(activeNickname&&dialog.open)loadProfile(activeNickname);if(profileTab&&!$('itemsModal').hidden&&!busy)refresh();},15000);
  refresh();
 });
 window.WakppuProfiles={open,refresh};
})();
