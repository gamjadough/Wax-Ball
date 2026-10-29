// Presentation only. Existing game handlers retain purchase, rewards and persistence rules.
(() => {
 const $=id=>document.getElementById(id),fmt=n=>WakppuGold.compact(n);
 let advanced=false,goalAction='help',opener=null;
 function text(id,value){const el=$(id);if(el&&el.textContent!==value)el.textContent=value;}
 function close(){ $('beginnerHelp').hidden=true;opener?.focus(); }
 function help(){opener=document.activeElement;$('beginnerHelp').hidden=false;$('beginnerHelpClose').focus();}
 function render(){
  const s=window.WakppuBeginnerRead?.();if(!s)return;
  const left=Math.max(0,s.required-s.clicks);
  text('ballProgressText',s.busy?'파괴 연출 중 · 곧 새 볼이 나와요':`균열 ${s.clicks.toLocaleString()} / ${s.required.toLocaleString()} · ${left.toLocaleString()} 남음`);
  text('ballRewardText',s.gemReward?`파괴 보상 💎 +${fmt(s.gemReward)} · Gold 없음`:`파괴 기본 보상 +${fmt(s.baseReward)}G`);
  $('ballProgressBar').max=s.required;$('ballProgressBar').value=s.clicks;
  $('beginnerGuide').hidden=!s.early;document.querySelector('#game').classList.toggle('has-beginner-guide',s.early);
  const gold=BigInt(s.gold);goalAction='help';let title,note;
  if(!s.green){title=gold===0n?'첫 목표 · 노란 볼을 한 번 깨보세요':`다음 목표 · 초록 볼 해금 (${fmt(gold)} / 10G)`;note='10G로 해금하면 기본 보상이 1G → 10G!';if(gold>=10n)goalAction='unlock';}
  else if(!s.hammer){title=`다음 목표 · 나무 망치 (${fmt(gold)} / 100G)`;note='초록 볼 8번 → 3번 타격 · 환생해도 유지';goalAction='hammer';}
  else{title=s.next?`다음 목표 · ${s.next.name}`:'모든 볼 해금 완료';note=s.next?`${fmt(s.next.price)}G로 해금 · 기본 보상 +${fmt(s.next.reward)}G · 필요 균열 ${s.next.clicks}`:'환생 메뉴에서 다음 성장 목표를 확인하세요.';if(s.next&&gold>=BigInt(s.next.price))goalAction='unlock';}
  text('beginnerGoal',title);text('beginnerGoalNote',note+(s.ready?'':' · 빠른 시작·저장 안내는 게임 방법에서 확인'));
  text('beginnerGoalAction',goalAction==='hammer'?'망치 보러가기':goalAction==='unlock'?'해금하기':'게임 방법');
  if($('unlockBenefit')){text('unlockBenefit',s.next?`해금 후 기본 보상 +${fmt(s.next.reward)}G · 필요 균열 ${s.next.clicks}`:'');$('unlockBenefit').hidden=!s.next;}
  if($('beginnerHammerTip'))text('beginnerHammerTip',s.hammer?'망치는 자동 적용 · 환생해도 보유 레벨 유지':'처음엔 이 아이템을 추천해요! 100G · 초록 볼 8번 → 3번 타격 · 환생해도 유지');
  $('shopDraw').classList.toggle('beginner-draw-locked',s.early&&!advanced);
  if($('beginnerDrawNote'))$('beginnerDrawNote').hidden=!s.early||advanced;
 }
 document.addEventListener('DOMContentLoaded',()=>{
  const hammer=$('hammerBtn').closest('article');$('shopPurchase').prepend(hammer);
  const accountTip=document.createElement('p');accountTip.className='beginner-tip';accountTip.textContent='처음이라면 닉네임으로 바로 시작하세요. 이메일 연결은 나중에 해도 돼요.';$('guestNicknameInput').closest('label').before(accountTip);
  const tip=document.createElement('p');tip.id='beginnerHammerTip';tip.className='beginner-tip';hammer.querySelector('h3').after(tip);
  const benefit=document.createElement('p');benefit.id='unlockBenefit';benefit.className='unlock-benefit';document.querySelector('.bottom .actions').before(benefit);
  const draw=document.createElement('section');draw.id='beginnerDrawNote';draw.innerHTML='<h3>뽑기는 후반 성장 콘텐츠예요</h3><p>아이템 1회는 5Qi G, 스킨 1회는 220Qi G예요. 초반에는 새 볼 해금과 100G 망치 구매를 먼저 추천해요.</p><button id="beginnerAdvanced" class="btn" type="button">그래도 뽑기 살펴보기</button>';$('shopDraw').prepend(draw);
  $('beginnerAdvanced').onclick=()=>{advanced=true;render();};
  $('beginnerGoalAction').onclick=()=>{if(goalAction==='unlock')$('unlockBtn').click();else if(goalAction==='hammer'){$('shopBtn').click();window.WakppuItems?.showShop('purchase');}else help();};
  $('beginnerHelpClose').onclick=close;$('beginnerStart').onclick=()=>{close();$('accountBtn').click();};
  $('beginnerHelp').addEventListener('click',e=>{if(e.target===$('beginnerHelp'))close();});
  document.addEventListener('keydown',e=>{if($('beginnerHelp').hidden)return;if(e.key==='Escape')close();if(e.key==='Tab'){const first=$('beginnerHelpClose'),last=$('beginnerStart');if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
  render();
 });
 window.WakppuOnboarding={render};
})();
