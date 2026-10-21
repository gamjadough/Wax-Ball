(() => {
 const $=id=>document.getElementById(id),section=document.createElement('section');section.id='adminKeepsake';
 section.innerHTML='<h3>개발자 소장품 지급</h3><p>누군가의 엉덩이 피어싱 조각 · 더럽다</p><p>효과 없음 · 한 번 지급하면 영구 보유하며 반복 사용할 수 있습니다.</p><p id="adminKeepsakeTarget">먼저 플레이어를 검색하고 선택하세요.</p><label>지급 사유<input id="adminKeepsakeReason" minlength="3" maxlength="200"></label><div class="admin-paid-actions"><button class="btn" id="adminKeepsakeGrant" type="button" disabled>소장품 영구 지급</button><button class="btn" id="adminKeepsakeRefresh" type="button" disabled>보유 상태 새로고침</button></div><p id="adminKeepsakeOwned"></p><p id="adminKeepsakeStatus" role="status"></p>';
 $('adminPlayerInfo').after(section);
 let target=null,data=null,busy=false,pending=false,version=0,retry=null;
 function render(){
  $('adminKeepsakeTarget').textContent=target?'선택 대상: '+target.nickname+' · '+target.id:'먼저 플레이어를 검색하고 선택하세요.';
  $('adminKeepsakeOwned').textContent=data?(data.owned?'영구 보유 중':'미보유'):'';
  $('adminKeepsakeGrant').disabled=busy||pending||!target||!data||data.owned;
  $('adminKeepsakeRefresh').disabled=busy||pending||!target;
 }
 async function load(){
  if(!target)return;const id=target.id,v=++version;data=null;render();
  try{const next=await WakppuAuth.invoke('admin_keepsake_status',{user_id:id});if(v!==version||target?.id!==id)return;data=next;render();}
  catch(e){if(v===version)$('adminKeepsakeStatus').textContent=e.message;}
 }
 $('adminKeepsakeRefresh').onclick=load;
 $('adminKeepsakeGrant').onclick=async()=>{
  if(busy||pending||!target||!data||data.owned)return;
  const id=target.id,reason=$('adminKeepsakeReason').value.trim();
  if(reason.length<3){$('adminKeepsakeStatus').textContent='사유를 3~200자로 입력하세요.';return;}
  retry||=crypto.randomUUID();busy=true;render();
  try{await WakppuAuth.invoke('admin_keepsake_grant',{user_id:id,item_id:'developer_piercing_fragment',reason,request_id:retry});retry=null;if(target?.id===id)$('adminKeepsakeStatus').textContent='영구 지급 완료';}
  catch(e){if(target?.id===id)$('adminKeepsakeStatus').textContent=e.message;}
  finally{busy=false;await load();render();}
 };
 window.addEventListener('wakppu-admin-target',e=>{pending=e.detail.pending;const next=e.detail.target;if(next?.id!==target?.id){target=next;data=null;retry=null;version++;$('adminKeepsakeStatus').textContent='';$('adminKeepsakeReason').value='';if(target)load();}render();});render();
})();
