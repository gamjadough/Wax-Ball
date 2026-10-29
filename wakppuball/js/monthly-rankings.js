// The server owns periods, scores, rank order and permanent rewards.
(() => {
 const $=id=>document.getElementById(id),read=()=>window.WakppuItemGame?.read();
 let active=false,version=0,request=0,month=null,state=null,offset=0,owner=null;
 const number=value=>BigInt(value||0).toLocaleString('ko-KR');
 function countdown(){
  if(!state||!active||$('ranking').hidden||document.hidden)return;
  const left=Math.max(0,Date.parse(state.ends_at)-(Date.now()+offset)),days=Math.floor(left/86400000),hours=Math.floor(left/3600000)%24,minutes=Math.floor(left/60000)%60;
  $('monthlyCountdown').textContent=state.finalized?'결과 확정 · 보상 지급 완료':left===0?'시즌 종료 · 결과 확정 중':`종료까지 ${days}일 ${hours}시간 ${minutes}분`;
  if(state.trial&&state.finalized)$('monthlyCountdown').textContent='시험 집계 종료 · 보상 없음';
 }
 function render(){
  const options=state.seasons.map(m=>new Option(m.replace('-','년 ')+'월'+(m==='2026-10'?' · 시험':''),m));
  $('monthlySeason').replaceChildren(...options);$('monthlySeason').value=state.month;
  $('monthlyTrial').hidden=!state.trial;
  $('monthlyMe').textContent=(state.eligible?`내 순위 ${state.me.rank?state.me.rank+'위':'집계 전'} · ${number(state.me.clicks)}클릭`:'월간 경쟁 제외 계정')+(state.trial?'':` · 참여 배지 ${number(BigInt(state.me.clicks||0)>1000n?1000:state.me.clicks)} / 1,000`);
  if(!read()?.account)$('monthlyMe').textContent='로그인하면 내 순위와 클릭 수를 확인할 수 있습니다.';
  const list=$('monthlyList');list.replaceChildren();
  for(const row of state.rows){
   const li=document.createElement('li'),button=document.createElement('button'),rank=document.createElement('b'),name=document.createElement('span'),count=document.createElement('strong');
   button.type='button';button.className='monthly-player';button.dataset.profileNickname=row.profile_nickname||row.nickname;button.setAttribute('aria-label',`${row.nickname} 프로필 보기`);
   rank.textContent=row.rank;name.textContent=row.nickname;name.className='monthly-name';count.textContent=number(row.clicks)+'클릭';
   if(row.online){const dot=document.createElement('i');dot.className='ranking-online';dot.setAttribute('role','img');dot.setAttribute('aria-label','온라인');name.prepend(dot);}
   if(row.monthly_badge){const badge=document.createElement('small');badge.textContent='🏅 '+row.monthly_badge;name.append(badge);}
   button.append(rank,name,count);button.onclick=()=>window.WakppuProfiles.open(row.profile_nickname||row.nickname,button);li.append(button);list.append(li);
  }
  $('monthlyState').textContent=state.rows.length?'상위 100명 · 동점이면 해당 클릭 수에 먼저 도달한 순서':'아직 집계된 클릭이 없습니다. 직접 공을 눌러 첫 점수를 올려보세요.';
  countdown();
 }
 async function refresh(){
  if(!active||!$('monthlyPanel'))return;
  const seq=++request,account=read()?.account,chosen=month;
  $('monthlyState').textContent='월간 랭킹을 불러오는 중…';
  try{
   const next=await WakppuAuth.invoke('monthly_rankings',chosen?{month:chosen}:{});
   if(seq!==request||!active||account!==read()?.account)return;
   state=next;owner=account;offset=Date.parse(next.server_now)-Date.now();month=next.month;render();
  }catch(e){if(seq===request&&active){$('monthlyList').replaceChildren();$('monthlyMe').textContent='';$('monthlyState').textContent='월간 랭킹을 불러오지 못했습니다. 다시 시도를 눌러주세요.';}}
 }
 function switchTab(next){
  active=next;++version;++request;
  $('rankingOverallTab').setAttribute('aria-pressed',String(!next));$('rankingMonthlyTab').setAttribute('aria-pressed',String(next));
  $('rankingList').hidden=next;$('rankingStatus').hidden=next;$('monthlyPanel').hidden=!next;
  if(next)refresh();else $('rankingBtn').click();
 }
 document.addEventListener('DOMContentLoaded',()=>{
  $('rankingTitle').textContent='랭킹';
  const controls=document.createElement('div');controls.className='monthly-tabs';controls.innerHTML='<button id="rankingOverallTab" class="btn" aria-pressed="true">전체 랭킹</button><button id="rankingMonthlyTab" class="btn" aria-pressed="false">월간 클릭</button>';
  $('rankingStatus').before(controls);
  const panel=document.createElement('section');panel.id='monthlyPanel';panel.hidden=true;panel.innerHTML='<div class="monthly-toolbar"><label for="monthlySeason">집계 월</label><select id="monthlySeason" class="btn"></select><button id="monthlyRefresh" class="btn">다시 시도</button></div><p id="monthlyTrial">10월은 업데이트 이후 시험 집계입니다. 보상은 11월 정식 시즌부터 지급합니다.</p><p id="monthlyCountdown"></p><p id="monthlyMe" class="monthly-me"></p><details class="monthly-rules"><summary>집계 기준과 보상 보기</summary><p>한국 시간 매월 1일 00시 시작. 서버가 처리한 수동 클릭 1번 = 1점. 망치 공격력과 무관하며 일반·이벤트·한정 공과 푸른젬 볼 모두 포함합니다. 불씨 자동 공격은 제외합니다.</p><p>월 종료 후 자동 지급 · 1위: 월별 클릭왕 카드·칭호 / 2~3위: 은빛·동빛 카드 / 1~10위: TOP 10 칭호 / 1,000클릭 이상: 참여 배지. 모두 영구 보관하며 능력치 보너스는 없습니다. 인벤토리 → 프로필에서 장착합니다.</p><p>관리자·랭킹 숨김·제재 중인 계정·정리 대상 게스트는 경쟁에서 제외됩니다. 월말 확정 시의 참가 자격을 적용합니다. 지난달 확정 순위는 고정됩니다.</p></details><p id="monthlyState" role="status" aria-live="polite"></p><ol id="monthlyList"></ol>';
  controls.after(panel);$('rankingOverallTab').onclick=()=>switchTab(false);$('rankingMonthlyTab').onclick=()=>switchTab(true);$('monthlyRefresh').onclick=refresh;
  $('monthlySeason').onchange=()=>{month=$('monthlySeason').value;refresh();};
  window.addEventListener('wakppu-account-restored',()=>{if(owner!==read()?.account){++request;state=null;owner=read()?.account;$('monthlyList').replaceChildren();$('monthlyMe').textContent='';if(active&&!$('ranking').hidden)refresh();}});
  setInterval(countdown,1000);
 });
 window.WakppuMonthly={get active(){return active;},get version(){return version;},refresh,focus:nickname=>([...$('monthlyList').querySelectorAll('button')].find(b=>b.dataset.profileNickname===nickname)||$('rankingMonthlyTab')).focus()};
})();
