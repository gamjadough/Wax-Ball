(() => {
 document.addEventListener('DOMContentLoaded',()=>{
  const section=document.createElement('section');section.className='input-guard-admin';
  section.innerHTML='<h3>입력 패턴 감지 기록</h3><p>좌표만으로 제재하지 않습니다. 반복된 복수 신호와 실제 서버 타격 기록을 함께 확인합니다. 자동 제한은 2분이며 기존 정지 해제로 풀 수 있습니다.</p><div class="input-guard-controls"><button id="inputGuardRefresh" class="btn small">기록 새로고침</button><button id="inputGuardPrev" class="btn small">이전</button><button id="inputGuardNext" class="btn small">다음</button></div><p id="inputGuardStatus" role="status"></p><div id="inputGuardRows"></div>';
  document.getElementById('admin').querySelector('.sheet').append(section);
  let page=0,busy=false,epoch=0;
  function clear(){epoch++;page=0;document.getElementById('inputGuardRows').replaceChildren();document.getElementById('inputGuardStatus').textContent='';}
  window.addEventListener('wakppu-auth-changed',clear);window.addEventListener('wakppu-account-restored',clear);
  async function refresh(){
   if(busy)return;const version=epoch,user=window.WakppuItemGame?.read().account;busy=true;section.querySelectorAll('button').forEach(b=>b.disabled=true);
   try{
    const result=await WakppuAuth.invoke('admin_input_guard',{page});if(version!==epoch||user!==window.WakppuItemGame?.read().account)return;const rows=document.getElementById('inputGuardRows');rows.replaceChildren();
    for(const r of result.rows){const item=document.createElement('article');item.className='input-guard-record';
     const title=document.createElement('strong');title.textContent=r.nickname+' · 의심 점수 '+r.score;
     const text=document.createElement('p');text.textContent=new Date(r.at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+' (한국 시간)\n'+r.reasons.join(' · ')+'\n서버 타격 '+r.server_hits+'회 · '+(r.corroborated?'서버 기록 조건 충족':'관찰 기록')+(r.restricted_until?'\n자동 제한 종료: '+new Date(r.restricted_until).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'');
     item.append(title,text);rows.append(item);
    }
    document.getElementById('inputGuardStatus').textContent=result.total?`${page+1}페이지 · 총 ${result.total}건`:'감지 기록이 없습니다.';
    document.getElementById('inputGuardPrev').disabled=page===0;document.getElementById('inputGuardNext').disabled=(page+1)*20>=result.total;
   }catch(e){if(version===epoch)document.getElementById('inputGuardStatus').textContent=e.message;}
   finally{busy=false;document.getElementById('inputGuardRefresh').disabled=false;}
  }
  document.getElementById('inputGuardRefresh').onclick=refresh;
  document.getElementById('inputGuardPrev').onclick=()=>{page--;refresh();};document.getElementById('inputGuardNext').onclick=()=>{page++;refresh();};
  document.getElementById('adminBtn').addEventListener('click',()=>{page=0;refresh();});
 });
})();
