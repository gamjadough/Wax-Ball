(() => {
 'use strict';
 const $=id=>document.getElementById(id),game=()=>window.WakppuItemGame?.read();
 let data=null,owner=null,sequence=0,busy=false,config=null,adminOffset=0,adminBusy=false,adminOwner=null;
 const states={pending:'입금 대기',claimed:'입금 알림 접수 · 관리자 확인 대기',approved:'상품 지급 완료',cancelled:'주문 취소',refunded:'환불 완료 · 상품 회수',revoked:'관리자 지급 회수 완료'};
 const money=n=>Number(n).toLocaleString('ko-KR')+'원',time=t=>new Date(t).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false});
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const button=(text,fn,disabled=false)=>{const n=node('button',text,'btn small');n.type='button';n.onclick=fn;n.disabled=disabled;return n;};
 const status=text=>{$('purchaseStatus').textContent=text;};
 function cosmetics(){
  const active=owner===game()?.account&&data,premium=!!active?.owned?.premium_supporter_pack,supporter=premium||!!active?.owned?.supporter_pack;
  document.documentElement.classList.toggle('purchase-starlight',!!active?.equipped);window.WakppuPurchaseEffects?.setActive(!!active?.equipped);
  $('supporterBadge').hidden=!supporter||(premium&&active.title_visible===false);$('supporterBadge').textContent=premium?'♛ 프리미엄 후원자 · 골드 +30%':'✦ 왁뿌볼 후원자 · 골드 +5%';$('supporterBadge').classList.toggle('premium-supporter',premium);
  $('premiumProfileBadge').hidden=!premium;
  for(const id of ['accountBtn','renameNicknameInput']){$(id).classList.toggle('supporter-name',supporter);$(id).classList.toggle('premium-supporter',premium);}
 }
 function bankInfo(bank){return node('p',(bank.bank_name||'')+' '+(bank.account_number||'')+' / 예금주 '+(bank.account_holder||'')+'\n문의: '+(bank.support_contact||''),'purchase-bank');}
 function equipButton(id){const equip=button(data.equipped?'별빛 오라 스킨 해제':'별빛 오라 스킨 장착',()=>mutate('purchase_equip',{equipped:!data.equipped},data.equipped?'스킨을 해제했습니다.':'별빛 오라 스킨을 장착했습니다. 상점을 닫으면 볼에서 확인할 수 있습니다.'),busy);equip.id=id;equip.classList.add('primary');equip.dataset.purchaseEquip='starlight_skin';return equip;}
 function render(){
  cosmetics();$('purchaseProducts').replaceChildren();$('purchaseHistory').replaceChildren();$('purchaseOwned').replaceChildren();$('purchaseInventoryContent').replaceChildren();
  $('purchaseNotice').textContent=!game()?.account?'계정에서 로그인한 뒤 주문할 수 있습니다.':!data?'상품 정보를 불러오고 있습니다.':!data.enabled?'판매 준비 중입니다. 현재 새 주문을 받고 있지 않습니다.':!data.eligible?'빠른 시작 계정은 이메일 연결과 인증을 마친 뒤 주문할 수 있습니다.':'계좌이체 후 관리자가 실제 입금을 확인하면 상품을 지급합니다.';
  for(const p of data?.products||[]){
   const premium=p.id==='premium_supporter_pack',covered=p.id==='supporter_pack'&&!!data.owned.premium_supporter_pack;
   const card=node('article',undefined,'purchase-card'+(premium?' purchase-premium-card':''));const icon=node('div',premium?'♛':p.id==='starlight_skin'?'✦':p.id==='first_steps_pack'?'🎁':'💜',p.id==='starlight_skin'?'purchase-skin-sample':'purchase-pack-sample');icon.setAttribute('aria-hidden','true');
   const starter=p.id==='first_steps_pack',owned=!!data.owned[p.id]||(starter&&!!data.starter_grant),skin=p.id==='starlight_skin';
   const buy=owned&&skin?equipButton('purchaseCardEquip'):button(covered?'프리미엄에 포함':owned?(starter?'구매 완료 · 재구매 불가':'적용 중'):money(p.amount)+(premium&&p.amount===8900?' · 업그레이드':' · 주문하기'),()=>order(p.id),busy||!data.enabled||!data.eligible||owned||covered);buy.dataset.purchaseProduct=p.id;
   card.append(icon,node('h3',p.name),node('p',p.description));
   if(premium){card.append(node('p',p.amount===8900?'기존 응원팩 보유 · 차액 8,900원으로 업그레이드':'신규 구매 10,000원 · 기존 응원팩 보유자는 8,900원'));const sample=node('div','♛ 프리미엄 후원자','premium-supporter-sample');sample.setAttribute('aria-label','전용 칭호와 금빛 랭킹 디자인 미리보기');card.append(sample);}
   if(owned)card.append(node('p',skin?(data.equipped?'보유 중 · 장착 중':'보유 중 · 미장착'):starter?(data.starter_grant?.reclaimed_at?'환불 처리 완료 · 재구매 불가':'지급 완료 · 아이템은 인벤토리에서 사용'):premium?'전용 꾸미기 · 파괴 골드 +30% 적용 중':covered?'프리미엄의 +30%만 적용 중':'보유 중 · 외형·파괴 골드 +5% 적용 중','purchase-owned-state'));
   card.append(buy);$('purchaseProducts').append(card);
  }
  if(data?.starter_grant)$('purchaseOwned').append(node('p',data.starter_grant.reclaimed_at?'🎁 첫걸음 성장팩 · 환불 처리 완료':'🎁 첫걸음 성장팩 · 3,000G 및 아이템 지급 완료'));
  if(data?.owned.premium_supporter_pack){
   $('purchaseOwned').append(node('p','♛ 프리미엄 후원자 · 파괴 골드 +30% 적용 중 (응원팩과 합산하지 않음)'));
   const title=button(data.title_visible===false?'전용 칭호 표시':'전용 칭호 숨기기',()=>mutate('purchase_title',{visible:data.title_visible===false},'칭호 표시 설정을 저장했습니다.'),busy);title.id='purchaseTitleToggle';title.setAttribute('aria-pressed',String(data.title_visible!==false));$('purchaseOwned').append(title);
  }else if(data?.owned.supporter_pack)$('purchaseOwned').append(node('p','✦ 후원자 외형 · 파괴 골드 +5% 적용 중'));
  const hasPurchases=!!data&&(!!data.starter_grant||!!Object.keys(data.owned).length);
  $('purchaseOwnedSection').hidden=!hasPurchases;
  if(data?.owned.starlight_skin){$('purchaseOwned').append(equipButton('purchaseEquip'));$('purchaseInventoryContent').append(node('p','별빛 오라 스킨 · 모든 왁뿌볼에 적용 · '+(data.equipped?'장착 중':'미장착')),equipButton('purchaseInventoryEquip'));}
  else $('purchaseInventoryContent').textContent='보유한 유료 스킨이 없습니다. 상점의 유료 상점 탭에서 확인하세요.';
  if(!hasPurchases)$('purchaseOwned').textContent='보유한 유료 상품이 없습니다.';
  for(const o of data?.orders||[]){
   const row=node('article',undefined,'purchase-order');row.dataset.purchaseOrder=o.id;
   row.append(node('h4',o.product_name+' · '+money(o.amount)),node('p',states[o.status]),node('small','주문번호 '+o.id+' · '+time(o.created_at)),node('p','입금자명: '+o.depositor));
   if(o.source==='admin_grant')row.append(node('p','관리자 직접 지급 · 결제·입금 없음'));
   else if(['pending','claimed'].includes(o.status)){
    row.append(bankInfo(o.bank),node('p','위 계좌에 정확한 금액을 이체하세요. ‘입금 알림’은 입금 확인이나 상품 지급이 아닙니다. 입금 후에는 주문을 취소하지 말고 문의 방법으로 연락해주세요.'));
    if(o.status==='pending'){
     const claim=button('입금 알림 보내기',()=>{if(confirm('실제 입금을 완료하셨나요? 관리자 확인을 요청하며, 즉시 지급되지는 않습니다.'))mutate('purchase_claim',{order_id:o.id},'입금 알림을 보냈습니다. 관리자 확인 후 지급됩니다.');},busy);claim.dataset.purchaseClaim=o.id;
     row.append(claim,button('입금 전 주문 취소',()=>{if(confirm('아직 입금하지 않은 주문만 취소하세요. 취소 후 입금했다면 관리자에게 문의해야 합니다.'))mutate('purchase_cancel',{order_id:o.id},'주문을 취소했습니다.');},busy));
    }
   }else if(o.status==='approved')row.append(node('p','지급일: '+time(o.approved_at)+' · 환불 문의: '+o.bank.support_contact));
   $('purchaseHistory').append(row);
  }
  if(!data?.orders.length)$('purchaseHistory').textContent='최근 주문 내역이 없습니다.';
  $('purchaseRefresh').disabled=busy;
 }
 async function refresh(){
  if(busy)return;const version=++sequence,current=game()?.account;
  if(!current||!game()?.ready){data=null;owner=null;render();return;}
  try{const next=await WakppuAuth.invoke('purchase_catalog');if(version!==sequence||current!==game()?.account)return;data=next;owner=current;render();if(next.starter_grant&&Number(next.starter_grant.revision)>Number(game()?.revision||0)&&!game()?.busy){await WakppuItemGame.restore();await window.WakppuItems?.refresh();}}
  catch(e){if(version===sequence){data=null;owner=null;render();status(e.message);}}
 }
 async function mutate(action,payload,message){
  if(busy)return;busy=true;++sequence;const current=game()?.account;render();
  try{const next=await WakppuAuth.invoke(action,payload);if(current!==game()?.account)return;data=next;owner=current;status(message);}
  catch(e){status(e.message);}finally{busy=false;render();await refresh();}
 }
 function order(product){const depositor=$('purchaseDepositor').value.trim();if(depositor.length<2||depositor.length>30){status('실제 이체에 사용할 입금자명을 2~30자로 입력하세요.');$('purchaseDepositor').focus();return;}mutate('purchase_order',{product_id:product,depositor,request_id:crypto.randomUUID()},'주문이 생성됐습니다. 아래 주문 내역의 계좌·금액을 확인한 후 이체하세요.');}
 async function adminLoad(reset=false){
  if(adminBusy)return;if(reset)adminOffset=0;const current=game()?.account;adminOwner=current;
  try{
   const [cfg,list]=await Promise.all([WakppuAuth.invoke('admin_purchase_config'),WakppuAuth.invoke('admin_purchase_orders',{offset:adminOffset,status:$('purchaseAdminFilter').value})]);
   if(current!==game()?.account)return;config=cfg;
   if(!$('purchaseConfigForm').dataset.dirty){for(const key of ['bank_name','account_number','account_holder','support_contact'])$('purchaseConfigForm').elements[key].value=cfg[key];$('purchaseConfigForm').elements.enabled.checked=cfg.enabled;}
   $('purchaseAdminOrders').replaceChildren();
   for(const o of list.orders){
    const row=node('article',undefined,'purchase-order');row.dataset.adminOrder=o.id;
    row.append(node('h4',o.product_name+' · '+money(o.amount)+' · '+states[o.status]),node('p','플레이어 '+o.nickname+' / 입금자 '+o.depositor),node('small',o.id+' · '+time(o.created_at)),bankInfo(o.bank));
    if(['pending','claimed'].includes(o.status)){
     const label=node('label','실제 입금액');const amount=node('input');amount.type='number';amount.inputMode='numeric';amount.min='1';amount.dataset.confirmAmount=o.id;label.append(amount);
     const receipt=node('label','거래 식별 기록 (거래번호 또는 일시·입금자)');const reference=node('input');reference.maxLength=100;reference.dataset.depositReference=o.id;receipt.append(reference);
     const approve=button('실제 입금 확인 · 상품 지급',()=>{if(Number(amount.value)!==o.amount||reference.value.trim().length<4){$('purchaseAdminStatus').textContent='실제 입금액과 4자 이상의 거래 식별 기록을 입력하세요.';return;}if(confirm('은행 거래내역에서 '+o.depositor+'님의 '+money(o.amount)+' 입금을 확인했나요? 이 주문에 상품을 지급합니다.'))adminMutate('admin_purchase_approve',{order_id:o.id,confirmed_amount:Number(amount.value),deposit_reference:reference.value.trim()});});approve.dataset.approveOrder=o.id;
     row.append(label,receipt,approve);
    }
    if(o.supporter_upgrade_order_id)row.append(node('p','응원팩 업그레이드 주문 · 기존 응원팩을 유지해야 지급할 수 있습니다.'));
    if(o.source==='admin_grant')row.append(node('p','관리자 직접 지급 · 실제 결제 없음 · 플레이어 검색의 직접 지급 메뉴에서 회수할 수 있습니다.'));
    if(o.status==='approved'&&o.source!=='admin_grant'&&!o.supporter_refund_blocked&&!(o.product_id==='first_steps_pack'&&!o.starter_refundable)){
     if(o.product_id==='first_steps_pack')row.append(node('p','현재 지급 재화 회수 가능 · 송금 전에 보유 상태를 확인하세요. 사용 후에는 회수가 제한될 수 있습니다.'));
     const label=node('label','은행에서 실제 환불을 완료한 기록');const ref=node('input');ref.maxLength=100;label.append(ref);
     const refund=button('실제 환불 완료 · 상품 회수',()=>{if(ref.value.trim().length<4){$('purchaseAdminStatus').textContent='실제 환불 완료 기록을 4자 이상 입력하세요.';return;}if(confirm('은행에서 환불을 이미 완료했나요? 이 버튼은 송금하지 않고 상품만 회수합니다.'))adminMutate('admin_purchase_refund',{order_id:o.id,refund_reference:ref.value.trim()});});refund.dataset.refundOrder=o.id;row.append(label,refund);
    }
    if(o.status==='approved'&&o.product_id==='first_steps_pack'&&!o.starter_refundable)row.append(node('p','지급 재화 부족 · 자동 회수 불가. 환불 송금 전에 사용 내역과 별도 처리 방법을 확인하세요.'));
    if(o.status==='approved'&&o.supporter_refund_blocked)row.append(node('p','업그레이드에 사용한 응원팩입니다. 프리미엄 후원팩을 먼저 환불 처리한 뒤 회수할 수 있습니다. 송금 전에 확인하세요.'));
    $('purchaseAdminOrders').append(row);
   }
   if(!list.orders.length)$('purchaseAdminOrders').textContent='해당 주문이 없습니다.';
   $('purchaseAdminPrev').disabled=adminOffset===0;$('purchaseAdminNext').disabled=list.orders.length<50;
  }catch(e){config=null;$('purchaseAdminOrders').replaceChildren();$('purchaseAdminStatus').textContent=e.message;}
 }
 async function adminMutate(action,payload){if(adminBusy)return;adminBusy=true;try{await WakppuAuth.invoke(action,payload);if(adminOwner!==game()?.account)return;$('purchaseAdminStatus').textContent='처리했습니다. 거래 기록에 저장되었습니다.';}catch(e){$('purchaseAdminStatus').textContent=e.message;}finally{adminBusy=false;await adminLoad();await refresh();}}
 document.addEventListener('DOMContentLoaded',()=>{
  $('shopPremium').innerHTML='<h3>💜 유료 상점</h3><p id="purchaseNotice" role="status"></p><p>응원팩: 골드 +5% · 프리미엄 후원팩: 골드 +30%·전용 꾸미기 · 별빛 오라 스킨: 500원·외형 전용</p><p>후원 보너스는 환생·꿀·코팅·아이템·이벤트 계산 후 파괴 보상에만 적용됩니다. 높은 쪽 하나만 적용하며 1G 미만은 누적됩니다. 이미 생성된 주문은 주문 당시 금액을 유지합니다.</p><section id="purchaseOwnedSection" class="purchase-owned" hidden><h3>보유 상품</h3><div id="purchaseOwned"></div></section><p id="purchaseStatus" role="status"></p><label class="purchase-depositor">입금자명<input id="purchaseDepositor" maxlength="30" autocomplete="name" placeholder="실제 이체에 사용할 이름"></label><div id="purchaseProducts" class="purchase-products"></div><h3>최근 주문 내역 (최대 50건)</h3><button id="purchaseRefresh" class="btn small" type="button">주문·지급 상태 새로고침</button><div id="purchaseHistory"></div>';
  const inventory=node('section');inventory.id='purchaseInventory';inventory.className='purchase-owned';inventory.innerHTML='<h3>유료 스킨 · 모든 볼</h3><div id="purchaseInventoryContent"></div>';($('inventorySkinsPage')||$('itemsModal').querySelector('.sheet')).prepend(inventory);
  $('purchaseRefresh').onclick=refresh;
  const badge=node('span','✦ 왁뿌볼 후원자 · 골드 +5%','supporter-badge');badge.id='supporterBadge';badge.hidden=true;document.querySelector('.info').append(badge);
  const profile=node('p','♛ 프리미엄 후원자 · 영구 골드 +30%','premium-profile-badge');profile.id='premiumProfileBadge';profile.hidden=true;$('accountStatus').after(profile);
  const admin=node('section');admin.id='purchaseAdmin';
  admin.innerHTML='<h3>💰 유료 상점 · 계좌이체 주문</h3><p>실제 은행 거래내역을 직접 확인한 뒤 지급하세요. 입금 알림·송금 화면만으로 지급하지 마세요. 환불은 은행에서 먼저 완료한 뒤 아래에서 상품을 회수합니다.</p><form id="purchaseConfigForm"><label>은행명<input name="bank_name" maxlength="50" required></label><label>받을 계좌번호<input name="account_number" maxlength="50" inputmode="numeric" required></label><label>예금주<input name="account_holder" maxlength="50" required></label><label>문의 방법 (이메일 등)<input name="support_contact" maxlength="200" required></label><label class="purchase-check"><input name="enabled" type="checkbox">새 계좌이체 주문 받기</label><button class="btn" type="submit">계좌·판매 상태 저장</button></form><p>계좌 변경 전 생성된 주문은 당시 계좌 정보를 유지합니다. 변경 후에도 기존 계좌의 입금을 확인하세요.</p><p id="purchaseAdminStatus" role="status"></p><label>주문 상태<select id="purchaseAdminFilter"><option value="all">전체</option><option value="pending">입금 대기</option><option value="claimed">입금 알림 접수</option><option value="approved">지급 완료</option><option value="cancelled">취소</option><option value="refunded">환불 완료</option></select></label><button id="purchaseAdminRefresh" class="btn">주문·설정 새로고침</button><div id="purchaseAdminOrders"></div><div class="purchase-pages"><button id="purchaseAdminPrev" class="btn">이전 50건</button><button id="purchaseAdminNext" class="btn">다음 50건</button></div>';
  $('admin').querySelector('.sheet').append(admin);
  $('purchaseConfigForm').oninput=()=>{$('purchaseConfigForm').dataset.dirty='1';};
  $('purchaseConfigForm').onsubmit=e=>{e.preventDefault();if(!config||adminBusy){$('purchaseAdminStatus').textContent='먼저 설정을 새로고침하세요.';return;}const form=e.currentTarget;const payload={mode:'set',revision:config.revision,enabled:form.elements.enabled.checked};for(const key of ['bank_name','account_number','account_holder','support_contact'])payload[key]=form.elements[key].value.trim();if(confirm('입력한 계좌와 예금주를 확인했나요? 판매를 켜면 이 계좌가 구매자에게 안내됩니다.')){delete form.dataset.dirty;adminMutate('admin_purchase_config',payload);}};
  $('purchaseAdminRefresh').onclick=()=>{delete $('purchaseConfigForm').dataset.dirty;adminLoad(true);};$('purchaseAdminFilter').onchange=()=>adminLoad(true);
  $('purchaseAdminPrev').onclick=()=>{adminOffset=Math.max(0,adminOffset-50);adminLoad();};$('purchaseAdminNext').onclick=()=>{adminOffset+=50;adminLoad();};
  new MutationObserver(()=>{if(!$('admin').hidden)adminLoad();}).observe($('admin'),{attributes:true,attributeFilter:['hidden']});
  window.addEventListener('wakppu-account-restored',()=>{data=null;owner=null;config=null;++sequence;adminOffset=0;$('purchaseAdminOrders').replaceChildren();$('purchaseConfigForm').reset();delete $('purchaseConfigForm').dataset.dirty;render();refresh();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  setInterval(()=>{if(!document.hidden&&!$('shopPremium').hidden&&!$('shop').hidden)refresh();},15000);refresh();render();
 });
 window.WakppuPurchases={refresh,serverHits:()=>!!game()?.account&&(owner!==game()?.account||!data||!!data.owned?.supporter_pack||!!data.owned?.premium_supporter_pack||data.orders?.some(o=>o.product_id==='first_steps_pack'&&['pending','claimed'].includes(o.status)))};
})();
