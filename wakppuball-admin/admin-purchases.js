// Generated from purchase-ui.js by build-admin-site.mjs. No player shop or game effects.
(() => {
 if(window.WAKPPU_SERVER?.paidContent===false)return;
 const $=id=>document.getElementById(id),game=()=>window.WakppuItemGame?.read();
 let config=null,adminOffset=0,adminBusy=false,adminOwner=null,adminRead=0,adminNoticeId=new URLSearchParams(location.search).get('order');
 const refresh=async()=>{};
 const states={pending:'입금 대기',claimed:'입금 알림 접수 · 관리자 확인 대기',approved:'상품 지급 완료',cancelled:'주문 취소',refunded:'환불 완료 · 상품 회수',revoked:'관리자 지급 회수 완료'};
 const money=n=>Number(n).toLocaleString('ko-KR')+'원',time=t=>new Date(t).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false});
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const button=(text,fn,disabled=false)=>{const n=node('button',text,'btn small');n.type='button';n.onclick=fn;n.disabled=disabled;return n;};
 const status=text=>{$('purchaseStatus').textContent=text;};

 async function adminLoad(reset=false){
  if(adminBusy)return;const read=++adminRead;$('purchaseAdminRefresh').disabled=true;if(reset)adminOffset=0;const current=game()?.account;adminOwner=current;
  try{
   const [cfg,list]=await Promise.all([WakppuAuth.invoke('admin_purchase_config'),adminNoticeId?WakppuAuth.invoke('admin_purchase_inbox',{order_id:adminNoticeId}):WakppuAuth.invoke('admin_purchase_orders',{offset:adminOffset,status:$('purchaseAdminFilter').value})]);
   if(current!==game()?.account||read!==adminRead)return;config=cfg;
   $('purchaseConfigForm').elements.enabled.disabled=cfg.shop_closed===true;
   if(cfg.shop_closed)$('purchaseAdminStatus').textContent='친구 서버의 유료 상점은 이용 중단 상태입니다. 기존 주문만 관리할 수 있습니다.';
   if(!$('purchaseConfigForm').dataset.dirty){for(const key of ['bank_name','account_number','account_holder','support_contact'])$('purchaseConfigForm').elements[key].value=cfg[key];$('purchaseConfigForm').elements.enabled.checked=cfg.enabled;}
   const drafts=new Map([...$('purchaseAdminOrders').querySelectorAll('input[data-confirm-amount],input[data-deposit-reference]')].map(n=>[(n.dataset.confirmAmount?'amount:':'reference:')+(n.dataset.confirmAmount||n.dataset.depositReference),n.value]));
   $('purchaseAdminOrders').replaceChildren();
   for(const o of list.orders){
    const row=node('article',undefined,'purchase-order');row.dataset.adminOrder=o.id;
    row.append(node('h4',o.product_name+' · '+money(o.amount)+' · '+states[o.status]),node('p','플레이어 '+o.nickname+' / 입금자 '+o.depositor),node('small',o.id+' · '+time(o.created_at)),bankInfo(o.bank));
    if(['pending','claimed'].includes(o.status)){
     const label=node('label','실제 입금액');const amount=node('input');amount.type='number';amount.inputMode='numeric';amount.min='1';amount.dataset.confirmAmount=o.id;amount.value=drafts.get('amount:'+o.id)||'';label.append(amount);
     const receipt=node('label','거래 식별 기록 (거래번호 또는 일시·입금자)');const reference=node('input');reference.maxLength=100;reference.dataset.depositReference=o.id;reference.value=drafts.get('reference:'+o.id)||'';receipt.append(reference);
     const approve=button('실제 입금 확인 · 상품 지급',()=>{if(Number(amount.value)!==o.amount||reference.value.trim().length<4){$('purchaseAdminStatus').textContent='실제 입금액과 4자 이상의 거래 식별 기록을 입력하세요.';return;}if(confirm('은행 거래내역에서 '+o.depositor+'님의 '+money(o.amount)+' 입금을 확인했나요? 이 주문에 상품을 지급합니다.'))adminMutate('admin_purchase_approve',{order_id:o.id,confirmed_amount:Number(amount.value),deposit_reference:reference.value.trim()});});approve.dataset.approveOrder=o.id;
     row.append(label,receipt,approve);
    }
    if(o.supporter_upgrade_order_id)row.append(node('p','응원팩 업그레이드 주문 · 기존 응원팩을 유지해야 지급할 수 있습니다.'));
    if(o.custom_target)row.append(node('p','커스텀 적용 대상: '+([...WAKPPU_BALLS,ADMIN_EVENT_BALL,WakppuLimitedData.ball].find(b=>b.id===o.custom_target)?.name||o.custom_target)));
   if(o.custom_upgrade_order_id)row.append(node('p','단일 이용권에서 전체 볼로 업그레이드하는 주문입니다.'));
   if(o.source==='admin_grant')row.append(node('p','관리자 직접 지급 · 실제 결제 없음 · 플레이어 검색의 직접 지급 메뉴에서 회수할 수 있습니다.'));
    if(o.status==='approved'&&o.source!=='admin_grant'&&!o.supporter_refund_blocked&&!o.custom_refund_blocked&&!(o.product_id==='first_steps_pack'&&!o.starter_refundable)){
     if(o.product_id==='first_steps_pack')row.append(node('p','현재 지급 재화 회수 가능 · 송금 전에 보유 상태를 확인하세요. 사용 후에는 회수가 제한될 수 있습니다.'));
     const label=node('label','은행에서 실제 환불을 완료한 기록');const ref=node('input');ref.maxLength=100;label.append(ref);
     const refund=button('실제 환불 완료 · 상품 회수',()=>{if(ref.value.trim().length<4){$('purchaseAdminStatus').textContent='실제 환불 완료 기록을 4자 이상 입력하세요.';return;}if(confirm('은행에서 환불을 이미 완료했나요? 이 버튼은 송금하지 않고 상품만 회수합니다.'))adminMutate('admin_purchase_refund',{order_id:o.id,refund_reference:ref.value.trim()});});refund.dataset.refundOrder=o.id;row.append(label,refund);
    }
    if(o.status==='approved'&&o.product_id==='first_steps_pack'&&!o.starter_refundable)row.append(node('p','지급 재화 부족 · 자동 회수 불가. 환불 송금 전에 사용 내역과 별도 처리 방법을 확인하세요.'));
    if(o.status==='approved'&&o.custom_refund_blocked)row.append(node('p','업그레이드에 사용한 단일 이용권입니다. 전체 볼 이용권을 먼저 회수·환불한 뒤 처리하세요. 송금 전에 확인하세요.'));
    if(o.status==='approved'&&o.supporter_refund_blocked)row.append(node('p','업그레이드에 사용한 응원팩입니다. 프리미엄 후원팩을 먼저 환불 처리한 뒤 회수할 수 있습니다. 송금 전에 확인하세요.'));
    $('purchaseAdminOrders').append(row);
   }
   if(!list.orders.length)$('purchaseAdminOrders').textContent=adminNoticeId?'이미 처리되었거나 취소된 주문입니다. 전체 주문에서 이력을 확인하세요.':'해당 주문이 없습니다.';
   $('purchaseAdminNoticeClear').hidden=!adminNoticeId;
   $('purchaseAdminPrev').disabled=!!adminNoticeId||adminOffset===0;$('purchaseAdminNext').disabled=!!adminNoticeId||list.orders.length<50;
  }catch(e){if(read===adminRead){config=null;$('purchaseAdminOrders').replaceChildren();$('purchaseAdminStatus').textContent=e.message;}}finally{if(read===adminRead)$('purchaseAdminRefresh').disabled=false;}
 }
 async function adminMutate(action,payload){if(adminBusy)return;adminBusy=true;try{await WakppuAuth.invoke(action,payload);if(adminOwner!==game()?.account)return;$('purchaseAdminStatus').textContent='처리했습니다. 거래 기록에 저장되었습니다.';}catch(e){$('purchaseAdminStatus').textContent=e.message;}finally{adminBusy=false;await adminLoad();await refresh();window.WakppuPurchaseNotices?.refresh();}}

 document.addEventListener('DOMContentLoaded',()=>{
  const admin=node('section');admin.id='purchaseAdmin';
  admin.innerHTML='<h3>💰 유료 상점 · 계좌이체 주문</h3><p>실제 은행 거래내역을 직접 확인한 뒤 지급하세요. 입금 알림·송금 화면만으로 지급하지 마세요. 환불은 은행에서 먼저 완료한 뒤 아래에서 상품을 회수합니다.</p><form id="purchaseConfigForm"><label>은행명<input name="bank_name" maxlength="50" required></label><label>받을 계좌번호<input name="account_number" maxlength="50" inputmode="numeric" required></label><label>예금주<input name="account_holder" maxlength="50" required></label><label>문의 방법 (이메일 등)<input name="support_contact" maxlength="200" required></label><label class="purchase-check"><input name="enabled" type="checkbox">새 계좌이체 주문 받기</label><button class="btn" type="submit">계좌·판매 상태 저장</button></form><p>계좌 변경 전 생성된 주문은 당시 계좌 정보를 유지합니다. 변경 후에도 기존 계좌의 입금을 확인하세요.</p><p id="purchaseAdminStatus" role="status"></p><label>주문 상태<select id="purchaseAdminFilter"><option value="all">전체</option><option value="pending">입금 대기</option><option value="claimed">입금 알림 접수</option><option value="approved">지급 완료</option><option value="cancelled">취소</option><option value="refunded">환불 완료</option></select></label><button id="purchaseAdminRefresh" class="btn">주문·설정 새로고침</button><div id="purchaseAdminOrders"></div><div class="purchase-pages"><button id="purchaseAdminPrev" class="btn">이전 50건</button><button id="purchaseAdminNext" class="btn">다음 50건</button></div>';
  $('admin').querySelector('.sheet').append(admin);
  const clearNotice=button('전체 주문 보기',()=>{adminNoticeId=null;adminLoad(true);});clearNotice.id='purchaseAdminNoticeClear';clearNotice.hidden=true;$('purchaseAdminOrders').before(clearNotice);
  $('purchaseConfigForm').oninput=()=>{$('purchaseConfigForm').dataset.dirty='1';};
  $('purchaseConfigForm').onsubmit=e=>{e.preventDefault();if(!config||adminBusy){$('purchaseAdminStatus').textContent='먼저 설정을 새로고침하세요.';return;}const form=e.currentTarget;const payload={mode:'set',revision:config.revision,enabled:form.elements.enabled.checked};for(const key of ['bank_name','account_number','account_holder','support_contact'])payload[key]=form.elements[key].value.trim();if(confirm('입력한 계좌와 예금주를 확인했나요? 판매를 켜면 이 계좌가 구매자에게 안내됩니다.')){delete form.dataset.dirty;adminMutate('admin_purchase_config',payload);}};
  $('purchaseAdminRefresh').onclick=()=>{delete $('purchaseConfigForm').dataset.dirty;adminLoad(true);};$('purchaseAdminFilter').onchange=()=>{adminNoticeId=null;adminLoad(true);};
  $('purchaseAdminPrev').onclick=()=>{adminOffset=Math.max(0,adminOffset-50);adminLoad();};$('purchaseAdminNext').onclick=()=>{adminOffset+=50;adminLoad();};

 window.addEventListener('wakppu-account-restored',()=>{config=null;++adminRead;adminOffset=0;});
 window.addEventListener('wakppu-auth-changed',()=>{config=null;++adminRead;adminOffset=0;$('purchaseAdminOrders').replaceChildren();$('purchaseConfigForm').reset();delete $('purchaseConfigForm').dataset.dirty;});
 window.addEventListener('wakppu-admin-locked',()=>{config=null;++adminRead;adminOffset=0;adminNoticeId=null;$('purchaseAdminOrders').replaceChildren();$('purchaseConfigForm').reset();delete $('purchaseConfigForm').dataset.dirty;});
 new MutationObserver(()=>{if(!$('admin').hidden)adminLoad();}).observe($('admin'),{attributes:true,attributeFilter:['hidden']});
 });
 window.WakppuPurchases={refresh:()=>adminLoad(),openNotice:async id=>{adminNoticeId=id;document.querySelector('[data-page="payments"]').click();await adminLoad();}};
})();