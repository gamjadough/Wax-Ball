(() => {
 const $=id=>document.getElementById(id),game=()=>window.WakppuItemGame?.read();
 let data=null,busy=false,owner=null,seq=0,detail=null;
 function errorText(error){
  if(/timeout|timed out|57014/i.test(String(error?.message||'')+' '+String(error?.code||'')))return '서버 응답이 늦어지고 있습니다. 잠시 후 다시 시도해주세요.';
  if(/[가-힣]/.test(error?.message||''))return error.message;
  return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.';
 }
 function entry(id){const local=WakppuGemBallData.get(id),remote=data?.catalog?.find(b=>b.id===id);return local&&remote?{...local,price:remote.price,clicks:Number(remote.clicks),gemReward:Number(remote.gem_reward),requiresBallId:remote.requires_ball_id??local.requiresBallId}:local;}
 function renderCollection(){
  const panel=$('gemCollection');if(!panel)return;const active=WakppuLimited.tab==='gem';panel.hidden=!active;if(!active)return;
  for(const id of ['collectionGrid','collectionDetail','collectionPager','limitedCollection'])$(id).hidden=true;
  const ready=!!game()?.ready&&!game().busy&&!game().blocked&&!game().test&&!busy;
  const balance=BigInt(window.WakppuBlueGems?.data?.balance||'0');
  $('gemCollectionBalance').textContent='💎 '+WakppuGold.compact(balance)+' 푸른젬 · 순서대로 영구 해금 · 골드 보상 없음';
  const state=ball=>{const owned=!!data?.owned?.includes(ball.id),available=owned||!!data?.admin_access,selected=data?.selected===ball.id,listed=!!data?.catalog?.some(b=>b.id===ball.id),prior=!ball.requiresBallId||!!data?.owned?.includes(ball.requiresBallId)||!!data?.admin_access;return {owned,available,selected,listed,prior};};
  const thumb=ball=>'<span class="thumb">'+buildBallThumb(ball)+'</span><span class="collection-name">'+ball.name+'</span>';
  const ball=detail&&entry(detail);
  if(ball){
   const v=state(ball),previous=ball.requiresBallId&&WakppuGemBallData.get(ball.requiresBallId),price=WakppuGold.compact(ball.price);
   $('gemCollectionCards').innerHTML='<button class="btn small" data-gem-back>〈 목록으로</button><article class="card limited-detail">'+thumb(ball)+'<p>해금: 푸른젬 '+price+' · 영구 보유</p><p>기본 타격량 '+ball.clicks+' · 망치 적용 · 파괴 시 푸른젬 '+ball.gemReward+'개</p><p>재생성 주기는 영겁의 왁스볼과 동일합니다. Gold 배율은 젬 보상에 영향을 주지 않습니다.</p>'+(previous?'<p class="gem-prerequisite">선행 해금: '+previous.name+'</p>':'')+(v.available?'<button class="btn" data-gem-select="'+ball.id+'" '+(!ready||v.selected?'disabled':'')+'>'+(v.selected?'사용 중':data.admin_access&&!v.owned?'관리자 바로 사용':'선택')+'</button>':'<button class="btn" data-gem-buy="'+ball.id+'" '+(!ready||!v.listed||!v.prior||balance<BigInt(ball.price)?'disabled':'')+'>'+(!v.listed?'준비 중':!v.prior?'이전 볼을 먼저 해금해주세요':'💎 '+price+'로 해금')+'</button>')+'</article>';
  }else $('gemCollectionCards').innerHTML=WakppuGemBallData.balls.map(local=>{const ball=entry(local.id),v=state(ball);return '<button type="button" class="card collection-card" data-gem-detail="'+ball.id+'">'+thumb(ball)+'<span class="collection-state">'+(v.selected?'사용 중':v.owned?'해금 완료':v.available?'관리자 이용 가능':'💎 '+WakppuGold.compact(ball.price)+' · 잠김')+'</span><span class="gem-card-reward">파괴 보상 '+ball.gemReward+'젬</span></button>';}).join('');
 }
 function accept(next,sync=true){
  if(!next)return;const previous=data?.selected,changed=previous!==next.selected;data=next;owner=game()?.account;
  if(sync&&changed&&game()?.ready)window.WakppuGemBallGame?.sync(!!next.selected,next.clicks,!!previous);
  renderCollection();
 }
 async function refresh(){
  const user=game()?.account,version=++seq;if(owner!==user){data=null;owner=user;}if(!user||!game()?.ready){renderCollection();return;}
  try{const next=await WakppuAuth.invoke('gem_balls');if(user!==game()?.account||version!==seq)return;accept(next);if($('gemCollectionStatus'))$('gemCollectionStatus').textContent='';}
  catch(e){if(user===game()?.account&&version===seq&&$('gemCollectionStatus'))$('gemCollectionStatus').textContent=errorText(e);}
 }
 async function transact(action,ball_id){
  if(busy||!game()?.ready||game().busy||game().blocked||game().test)return false;
  busy=true;seq++;const user=game().account;renderCollection();
  try{
   await WakppuItemGame.flush();const request={ball_id,request_id:crypto.randomUUID(),item_revision:game().revision};let r;
   try{r=await WakppuAuth.invoke(action,request);}catch(e){if(e.status)throw e;r=await WakppuAuth.invoke(action,request);}
   if(user!==game()?.account)return false;
   if(WakppuItems.accept(r)===false)throw Error('상태를 다시 확인해주세요.');
   if(r.limited)WakppuLimited.accept(r.limited);accept(r.gem_balls);
   $('gemCollectionStatus').textContent=action==='gem_ball_buy'?(WakppuGemBallData.get(ball_id)?.name||'볼')+'을 영구 해금했습니다.':'볼을 변경했습니다.';return true;
  }catch(e){if(user===game()?.account)$('gemCollectionStatus').textContent=errorText(e);return false;}
  finally{busy=false;renderCollection();}
 }
 document.addEventListener('DOMContentLoaded',()=>{
  const tabs=$('normalCollectionTab').parentElement,tab=document.createElement('button');tab.id='gemCollectionTab';tab.className='btn small';tab.type='button';tab.textContent='푸른젬 도감';tab.dataset.collectionTab='gem';tab.setAttribute('role','tab');tab.setAttribute('aria-controls','gemCollection');tab.setAttribute('aria-selected','false');tab.tabIndex=-1;tabs.append(tab);
  const panel=document.createElement('section');panel.id='gemCollection';panel.hidden=true;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','gemCollectionTab');panel.innerHTML='<h3>💎 푸른젬 도감</h3><p id="gemCollectionBalance"></p><p id="gemCollectionStatus" role="status"></p><div id="gemCollectionCards"></div>';$('collectionGrid').before(panel);
  panel.onclick=async e=>{const target=e.target.closest('button');if(!target)return;if(target.hasAttribute('data-gem-detail')){detail=target.dataset.gemDetail;renderCollection();}else if(target.hasAttribute('data-gem-back')){detail=null;renderCollection();}else if(target.hasAttribute('data-gem-buy'))await transact('gem_ball_buy',target.dataset.gemBuy);else if(target.hasAttribute('data-gem-select')){if(await transact('gem_ball_select',target.dataset.gemSelect))$('collectionClose').click();}};
  $('collectionBtn').addEventListener('click',refresh);window.addEventListener('wakppu-account-restored',refresh);
  setInterval(()=>{if(!document.hidden&&game()?.ready&&!game().busy&&!busy)refresh();},15000);refresh();
 });
 window.WakppuGemBalls={get data(){return data;},get busy(){return busy;},get current(){return entry(data?.selected);},accept,refresh,renderCollection,select:id=>transact('gem_ball_select',id),clear:()=>{data=null;detail=null;owner=null;++seq;}};
})();
