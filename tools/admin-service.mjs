export const ballIds = ['yellow','green','strawberry','apple','chocolate','donut','rainbow','water','emerald','diamond','planet','sun','blackhole'];
export function createStore() {
  const progress = () => ({gold:10000, rebirths:0, unlocked_ball_ids:['yellow'], discovered_ball_ids:['yellow'], selected_ball_id:'yellow', current_ball_id:'yellow', current_clicks:0, hammer_owned:false, hammer_level:0, honey_expires_at:null, progress_imported_at:'local'});
  return { maintenance:false, message:'현재 게임이 업데이트 중입니다.', announcement:null, logs:[], players:[
    {id:'local-admin', nickname:'감자떡 (로컬 테스트)', role:'admin', email:'dodoonglee@gmail.com', state:progress(), moderation:{status:'active'}},
    {id:'local-player', nickname:'테스트플레이어', role:'player', state:progress(), moderation:{status:'suspended'}},
  ]};
}
export function execute(store, actor, body) {
  const action = body.action;
  const error = (message, status=400) => { throw Object.assign(new Error(message), {status}); };
  if (!actor) error('로그인이 필요합니다.',401);
  if (action.startsWith('admin_') && actor.role !== 'admin') error('admin only',403);
  if (action==='status') return {maintenance:store.maintenance, message:store.message, announcement:store.announcement, role:actor.role};
  if (store.maintenance && actor.role!=='admin' && !action.startsWith('admin_')) error('점검 중입니다.',503);
  if (action==='bootstrap') return {player:{id:actor.id,nickname:actor.nickname,role:actor.role},state:actor.state,moderation:actor.moderation};
  if (action==='rankings') return store.players.map(p=>({nickname:p.nickname,gold:p.state.gold,rebirths:p.state.rebirths})).sort((a,b)=>b.rebirths-a.rebirths||b.gold-a.gold);
  if (action==='set_nickname') {if(!/^[가-힣a-zA-Z0-9_]{2,16}$/.test(body.nickname)) error('닉네임 형식 오류'); actor.nickname=body.nickname;return {nickname:actor.nickname};}
  // 로컬 샘플 진행도에만 사용됩니다. 운영 저장 검증은 별도 게임 서버에서 처리해야 합니다.
  if (action==='save_progress') { if(actor.moderation.status==='suspended') error('정지된 계정입니다.',403); for(const k of Object.keys(actor.state)) if(k in body) actor.state[k]=body[k];return {state:actor.state}; }
  if (action==='admin_search') {const q=String(body.query||'').toLowerCase();return store.players.filter(p=>[p.id,p.nickname].some(v=>v.toLowerCase().includes(q))).map(p=>({id:p.id,nickname:p.nickname,state:p.state,moderation:p.moderation}));}
  if (action==='admin_logs') return store.logs.slice(-100).reverse();
  let before, after;
  const target = store.players.find(p=>p.id===body.user_id);
  if (action==='admin_maintenance') {before={enabled:store.maintenance,message:store.message};store.maintenance=body.enabled===true;store.message=String(body.message||store.message).slice(0,500);after={enabled:store.maintenance,message:store.message};}
  else if (action==='admin_announcement') {
    if(body.clear===true){before=store.announcement;after=store.announcement=null;}
    else {const message=String(body.message||'').trim();if(!message||message.length>500) error('공지는 1~500자입니다.');before=store.announcement;after=store.announcement={message,author:actor.nickname,time:new Date().toISOString()};}
  }
  else if (action==='admin_test') {if(!ballIds.includes(body.ball_id)) error('잘못된 볼'); return {authorized:true,ball_id:body.ball_id};}
  else if (['admin_gold','admin_rebirths','admin_unlock','admin_discovery','admin_unban'].includes(action)) {
    if(!target) error('대상 계정 없음',404);
    before=structuredClone({state:target.state,moderation:target.moderation});
    if(action==='admin_gold'||action==='admin_rebirths') {
      const key=action==='admin_gold'?'gold':'rebirths';const n=Number(body.value);if(!Number.isSafeInteger(n)||n<0) error('0 이상의 정수를 입력하세요.');
      if(!['add','subtract','set'].includes(body.mode)) error('변경 방식 오류');
      const v=body.mode==='set'?n:body.mode==='add'?target.state[key]+n:target.state[key]-n;
      if(!Number.isSafeInteger(v)||v<0||(key==='rebirths'&&v>25)) error('허용 범위를 벗어났습니다.');target.state[key]=v;
    } else if(action==='admin_unban') target.moderation={status:'active',suspicion_score:0,suspended_until:null};
    else {
      if(!['all','one','reset_one','reset_all'].includes(body.mode)) error('변경 방식 오류');
      if(body.mode.includes('one')&&!ballIds.includes(body.ball_id)) error('잘못된 볼');
      if(action==='admin_unlock') {if(!['all','one'].includes(body.mode)) error('변경 방식 오류');const ids=body.mode==='all'?ballIds:ballIds.slice(0,ballIds.indexOf(body.ball_id)+1);target.state.unlocked_ball_ids=[...new Set([...target.state.unlocked_ball_ids,...ids])];target.state.discovered_ball_ids=[...new Set([...target.state.discovered_ball_ids,...ids])];}
      else {const current=target.state.discovered_ball_ids;target.state.discovered_ball_ids=body.mode==='all'?[...ballIds]:body.mode==='reset_all'?[]:body.mode==='reset_one'?current.filter(id=>id!==body.ball_id):[...new Set([...current,body.ball_id])];}
    }
    after=structuredClone({state:target.state,moderation:target.moderation});
  } else error('unknown action',404);
  store.logs.push({admin:actor.id,action,target:target?.id||null,before,after,time:new Date().toISOString()});return {ok:true,target:target?{id:target.id,nickname:target.nickname,state:target.state,moderation:target.moderation}:null};
}
