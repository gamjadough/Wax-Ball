(() => {
 const $=id=>document.getElementById(id),section=document.createElement('section');section.id='adminPaid';
 section.innerHTML='<h3>유료 상품 직접 지급</h3><p>이메일 인증 없이 선택한 계정에 지급합니다. 결제·입금 확인과 구분하여 0원 관리자 지급으로 기록합니다.</p><p id="adminPaidTarget">먼저 플레이어를 검색하고 선택하세요.</p><label>상품<select id="adminPaidProduct"></select></label><p id="adminPaidOwned"></p><label>지급·회수 사유<input id="adminPaidReason" minlength="3" maxlength="200" placeholder="예: 이메일 인증 오류 보상"></label><div class="admin-paid-actions"><button id="adminPaidGrant" class="btn" type="button" disabled>선택 계정에 직접 지급</button><button id="adminPaidRevoke" class="btn" type="button" disabled>관리자 지급 회수</button><button id="adminPaidRefresh" class="btn" type="button" disabled>보유 상태 새로고침</button></div><p id="adminPaidStatus" role="status"></p><h4>최근 직접 지급 이력 (20건)</h4><div id="adminPaidHistory"></div>';
 $('adminPlayerInfo').after(section);
 let target=null,data=null,version=0,busy=false,externalPending=false,retry=null;
 const node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
 function render(){
  const id=$('adminPaidProduct').value,owned=data?.owned[id],covered=id==='supporter_pack'&&!!data?.owned.premium_supporter_pack,used=id==='first_steps_pack'&&data?.starter_used;
  $('adminPaidTarget').textContent=target?'선택 대상: '+target.nickname+' · '+target.id:'먼저 플레이어를 검색하고 선택하세요.';
  $('adminPaidOwned').textContent=!data?'':owned?(owned.source==='admin_grant'?'관리자 지급으로 보유 중':'계좌이체 구매로 보유 중 · 이 메뉴에서 회수할 수 없습니다.'):covered?'프리미엄 후원팩에 포함된 혜택입니다.':used?'첫걸음 성장팩 지급 이력이 있어 재지급할 수 없습니다.':'미보유 · 직접 지급 가능';
  const disabled=busy||externalPending||!target||!data||!id;
  $('adminPaidGrant').disabled=disabled||!!owned||covered||used;
  $('adminPaidRevoke').disabled=disabled||owned?.source!=='admin_grant'||owned.revoke_blocked||owned.reclaimable===false;
  $('adminPaidRefresh').disabled=busy||externalPending||!target;
  $('adminPaidProduct').disabled=busy||externalPending||!data;
  if(owned?.revoke_blocked)$('adminPaidOwned').textContent+=' · 업그레이드한 프리미엄을 먼저 회수·환불하세요.';
  if(owned?.reclaimable===false)$('adminPaidOwned').textContent+=' · 지급 재화가 부족하여 자동 회수할 수 없습니다.';
 }
 async function load(){
  if(!target)return;const id=target.id,v=++version;data=null;render();
  try{const next=await WakppuAuth.invoke('admin_paid_status',{user_id:id});if(v!==version||target?.id!==id)return;data=next;const selected=$('adminPaidProduct').value;
   $('adminPaidProduct').replaceChildren(...next.products.map(p=>{const o=node('option',p.name);o.value=p.id;return o;}));if(next.products.some(p=>p.id===selected))$('adminPaidProduct').value=selected;
   $('adminPaidHistory').replaceChildren(...next.history.map(o=>node('p',o.product_name+' · '+(o.status==='revoked'?'회수 완료':'관리자 지급')+' · '+new Date(o.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}))));
   if(!next.history.length)$('adminPaidHistory').textContent='직접 지급 이력이 없습니다.';render();
  }catch(e){if(v===version){$('adminPaidStatus').textContent=e.message;render();}}
 }
 async function mutate(action){
  if(busy||externalPending||!target||!data)return;
  const reason=$('adminPaidReason').value.trim(),id=target.id,product=$('adminPaidProduct').value,p=data.products.find(p=>p.id===product),owned=data.owned[product];
  if(reason.length<3){$('adminPaidStatus').textContent='사유를 3~200자로 입력하세요.';$('adminPaidReason').focus();return;}
  if(!confirm('대상: '+target.nickname+'\nUser ID: '+id+'\n상품: '+p.name+'\n'+(action==='admin_paid_grant'?'결제 확인 없이 직접 지급합니다.':'관리자 지급 상품을 회수합니다. 실제 돈은 송금하지 않습니다.')))return;
  const key=id+':'+product+':'+action;if(!retry||retry.key!==key)retry={key,id:crypto.randomUUID()};busy=true;render();
  try{await WakppuAuth.invoke(action,{user_id:id,product_id:product,order_id:owned?.order_id,reason,request_id:retry.id});retry=null;if(target?.id===id)$('adminPaidStatus').textContent='처리 완료 · 관리자 지급 기록에 저장했습니다.';await WakppuPurchases?.refresh();}
  catch(e){if(target?.id===id)$('adminPaidStatus').textContent=e.message;}
  finally{busy=false;if(target)await load();else render();}
 }
 $('adminPaidProduct').onchange=()=>{retry=null;render();};$('adminPaidRefresh').onclick=load;$('adminPaidGrant').onclick=()=>mutate('admin_paid_grant');$('adminPaidRevoke').onclick=()=>mutate('admin_paid_revoke');
 window.addEventListener('wakppu-admin-target',e=>{externalPending=e.detail.pending;const next=e.detail.target;if(next?.id!==target?.id){target=next;data=null;retry=null;version++;$('adminPaidReason').value='';$('adminPaidStatus').textContent='';$('adminPaidHistory').replaceChildren();if(target)load();}render();});render();
})();
