(() => {
  const $=id=>document.getElementById(id);
  const pending=new Set(),done=new Set();let sending=false,playRequested=false,page=0,total=0,loading=false;
  async function recordPlay(realPlay=false){
    if(realPlay)playRequested=true;
    if(!window.WakppuAuth||sending)return;
    sending=true;
    try{
      const session=(await WakppuAuth.session()).data.session;
      const id=session?.user?.id;
      if(!id||done.has(id))return;
      const key='wakppu:first-play:'+id;
      if(playRequested){playRequested=false;pending.add(id);try{localStorage.setItem(key,'pending');}catch(_){}}
      let stored=false;try{stored=localStorage.getItem(key)==='pending';}catch(_){}
      if(!pending.has(id)&&!stored)return;
      await WakppuAuth.invoke('mark_first_play');
      done.add(id);pending.delete(id);try{localStorage.removeItem(key);}catch(_){}
    }catch(_){/* Retry persisted first play after reconnection. */}
    finally{sending=false;}
  }
  window.addEventListener('wakppu-real-play',()=>recordPlay(true));
  window.addEventListener('wakppu-account-restored',()=>recordPlay());
  window.addEventListener('online',()=>recordPlay());
  setInterval(()=>recordPlay(),10000);
  const date=value=>value?new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'없음';
  async function load(reset=false){
    if(loading||!window.WakppuAuth)return;
    if(reset)page=0;
    loading=true;$('guestLifecycleStatus').textContent='조회 중…';
    try{
      const result=await WakppuAuth.invoke('admin_guest_accounts',{filter:$('guestLifecycleFilter').value,query:$('guestLifecycleQuery').value.trim(),page});
      total=result.total;
      $('guestLifecycleRows').replaceChildren(...result.rows.map(row=>{
        const tr=document.createElement('tr');
        const age=Math.max(0,Math.floor((Date.parse(result.server_time)-Date.parse(row.created_at))/60000));
        const state=!row.eligible?'제외: '+row.exemption:row.delete_due?'삭제 대기':row.ranking_excluded?'랭킹 제외':'30분 대기';
        const values=[row.nickname,row.id,date(row.created_at),age>=1440?`${Math.floor(age/1440)}일 ${Math.floor(age%1440/60)}시간`:`${Math.floor(age/60)}시간 ${age%60}분`,date(row.first_play_at),state,row.eligible?date(row.delete_at):'대상 아님'];
        values.forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td);});return tr;
      }));
      $('guestLifecycleStatus').textContent=`총 ${total}개 · ${page+1}페이지 · 자동 삭제 예약: ${result.cleanup_enabled?'실행 중':'꺼짐'} · 조회 ${date(result.server_time)} (한국 시간)`;
    }catch(e){$('guestLifecycleStatus').textContent=e.message;$('guestLifecycleRows').replaceChildren();total=0;}
    finally{loading=false;$('guestLifecyclePrevious').disabled=page===0;$('guestLifecycleNext').disabled=(page+1)*50>=total;}
  }
  $('guestLifecycleSearch').onclick=()=>load(true);
  $('guestLifecycleFilter').onchange=()=>load(true);
  $('guestLifecyclePrevious').onclick=()=>{page=Math.max(0,page-1);load();};
  $('guestLifecycleNext').onclick=()=>{page++;load();};
})();
