import {hammerDamage} from './hammer-catalog.mjs';
import {ballCatalog} from './event-ball-catalog.mjs';
const catalog=await ballCatalog();
export const ballIds = catalog.map(b=>b.id);
export function isBanned(player, now=Date.now()) {
  const m=player.moderation;
  return m?.status==='banned' || (m?.status==='suspended' &&
    (!m.suspended_until || Date.parse(m.suspended_until)>now));
}
export function guestLifecycleInfo(player,now=Date.now()) {
  if(!player.lifecycle)return null;
  const {created_at,first_play_at}=player.lifecycle;
  const exemption=player.role==='admin'?'관리자':first_play_at?'플레이 기록 있음':player.email||player.localAuth?.pending||player.localAuth?.verified?'이메일 연결':null;
  const hide_at=new Date(Date.parse(created_at)+1800000).toISOString(),delete_at=new Date(Date.parse(created_at)+259200000).toISOString();
  return {id:player.id,nickname:player.nickname,created_at,first_play_at,eligible:!exemption,exemption,hide_at,delete_at,ranking_excluded:!exemption&&Date.parse(hide_at)<=now,delete_due:!exemption&&Date.parse(delete_at)<=now};
}
export function createStore() {
  const progress = () => ({gold:10000, rebirths:0, unlocked_ball_ids:['yellow'], discovered_ball_ids:['yellow'], selected_ball_id:'yellow', current_ball_id:'yellow', current_clicks:0, hammer_owned:false, hammer_level:0, honey_expires_at:null, coating_expires_at:null, progress_imported_at:'local'});
  return { maintenance:false, message:'현재 게임이 업데이트 중입니다.', announcement:null, logs:[], players:[
    {id:'local-admin', nickname:'감자떡 (로컬 테스트)', role:'admin', email:'dodoonglee@gmail.com', state:progress(), moderation:{status:'active'}},
    {id:'local-player', nickname:'테스트플레이어', role:'player', state:progress(), moderation:{status:'active'}},
  ]};
}
export function execute(store, actor, body) {
  const action = body.action;
  const error = (message, status=400) => { throw Object.assign(new Error(message), {status}); };
  if (!actor) error('로그인이 필요합니다.',401);
  if (action.startsWith('admin_') && actor.role !== 'admin') error('admin only',403);
  if (action==='status') return {admin_ball_always:actor.role==='admin'&&!actor.is_anonymous,admin_ball_event:store.maintenance?null:store.admin_ball_event||null,gold_event:store.gold_event||null,server_time:new Date().toISOString(),maintenance:store.maintenance, message:store.message, announcement:store.announcement, role:actor.role, admin_revision:actor.state.admin_revision||0, moderation:{...actor.moderation,blocked:isBanned(actor)}};
  if (store.maintenance && actor.role!=='admin' && !action.startsWith('admin_')) error('점검 중입니다.',503);
  if (isBanned(actor)) error('이 계정은 이용이 제한되었습니다.',403);
  if(action==='event_ball_hit'){
    const now=Date.now(),always=body.event_id==='admin-always'&&actor.role==='admin'&&!actor.is_anonymous;
    const e=always?{id:'admin-always',starts_at:new Date(now-1000).toISOString(),ends_at:new Date(now+1000).toISOString()}:store.admin_ball_event;
    if((store.maintenance&&!always)||!e||e.id!==body.event_id||now<Date.parse(e.starts_at)||now>=Date.parse(e.ends_at))error('관리자 볼 이벤트가 종료되었거나 아직 시작되지 않았습니다.',409);
    if(!/^[a-f0-9-]{36}$/.test(body.request_id||''))error('잘못된 타격 요청입니다.');
    store.event_progress||=new Map();const key=actor.id+':'+e.id,p=store.event_progress.get(key)||{clicks:0};
    if(p.request_id===body.request_id)return p.result;
    const damage=hammerDamage(actor.state.hammer_owned,actor.state.hammer_level);
    const coated=Date.parse(actor.state.coating_expires_at)>now,total=coated?1200:600;
    const clicks=Math.min(total,p.clicks+damage);let reward=0n;
    if(clicks===total){
      const best=catalog.reduce((n,b)=>actor.state.unlocked_ball_ids.includes(b.id)&&BigInt(b.reward)>n?BigInt(b.reward):n,1n),g=store.gold_event;
      reward=best*10n*(1n<<BigInt(actor.state.rebirths))*(Date.parse(actor.state.honey_expires_at)>now?2n:1n)*BigInt(coated?3:1)*BigInt(g&&now>=Date.parse(g.starts_at)&&now<Date.parse(g.ends_at)?g.multiplier:1);
      actor.state.gold=(BigInt(actor.state.gold)+reward).toString();
    }
    if(actor.lifecycle)actor.lifecycle.first_play_at||=new Date().toISOString();
    const result={clicks,required_clicks:total,reward:reward.toString(),gold:String(actor.state.gold)};
    store.event_progress.set(key,{clicks:clicks===total?0:clicks,request_id:body.request_id,result});return result;
  }
  if(action==='mark_first_play'){if(actor.lifecycle)actor.lifecycle.first_play_at||=new Date().toISOString();return {ok:true};}
  if(action==='admin_guest_accounts'){
    const filter=body.filter||'unplayed',page=Number(body.page||0),query=String(body.query||'').toLowerCase();
    if(!['all','unplayed','hidden','due','protected'].includes(filter)||!Number.isInteger(page)||page<0||page>999999||query.length>100)error('잘못된 조회 조건입니다.');
    const rows=store.players.map(p=>guestLifecycleInfo(p)).filter(Boolean).filter(p=>(p.nickname.toLowerCase().includes(query)||p.id.includes(query))&&(filter==='all'||filter==='unplayed'&&p.eligible||filter==='hidden'&&p.ranking_excluded||filter==='due'&&p.delete_due||filter==='protected'&&!p.eligible)).sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
    return {total:rows.length,page,rows:rows.slice(page*50,(page+1)*50),server_time:new Date().toISOString(),cleanup_enabled:false};
  }
  if (action==='bootstrap') return {player:{id:actor.id,nickname:actor.nickname,role:actor.role},state:actor.state,moderation:actor.moderation};
  if (action==='rankings') return store.players.filter(p=>!p.ranking_hidden&&!isBanned(p)&&!guestLifecycleInfo(p)?.ranking_excluded).map(p=>({nickname:p.nickname,gold:p.state.gold,rebirths:p.state.rebirths})).sort((a,b)=>b.rebirths-a.rebirths||(BigInt(a.gold)===BigInt(b.gold)?0:BigInt(a.gold)>BigInt(b.gold)?-1:1));
  if (action==='set_nickname') {if(!/^[가-힣a-zA-Z0-9_]{2,16}$/.test(body.nickname)) error('닉네임 형식 오류'); actor.nickname=body.nickname;return {nickname:actor.nickname};}
  // 로컬 샘플 진행도에만 사용됩니다. 운영 저장 검증은 별도 게임 서버에서 처리해야 합니다.
  if (action==='save_progress') { if((body.admin_revision||0)!==(actor.state.admin_revision||0)) error('관리자가 변경한 진행도를 다시 불러옵니다.',409);for(const k of Object.keys(actor.state)) if(k in body && k!=='admin_revision') actor.state[k]=body[k];return {state:actor.state}; }
  if (action==='admin_search') {const q=String(body.query||'').toLowerCase();return store.players.filter(p=>[p.id,p.nickname].some(v=>v.toLowerCase().includes(q))).map(p=>({id:p.id,nickname:p.nickname,ranking_hidden:p.ranking_hidden===true,state:p.state,moderation:p.moderation}));}
  if (action==='admin_logs') return store.logs.slice(-100).reverse();
  let before, after;
  const target = store.players.find(p=>p.id===body.user_id);
  if(action==='admin_ball_event'){
    if(!['start','stop'].includes(body.mode))error('이벤트 작업을 선택하세요.');before=store.admin_ball_event||null;
    if(body.mode==='start'){
      const duration=body.duration_seconds??300,delay=body.delay_seconds??0;
      if(store.maintenance||before&&Date.parse(before.ends_at)>Date.now())error('점검 또는 기존 이벤트를 종료해주세요.',409);
      if(!Number.isInteger(duration)||duration<1||duration>86400||!Number.isInteger(delay)||delay<0||delay>86400)error('시간 범위가 올바르지 않습니다.');
      const now=Date.now();store.admin_ball_event={id:crypto.randomUUID(),starts_at:new Date(now+delay*1000).toISOString(),ends_at:new Date(now+(delay+duration)*1000).toISOString()};
    }else store.admin_ball_event=null;
    after=store.admin_ball_event;
  }
  else if (action==='admin_gold_event') {
    if(!['start','stop'].includes(body.mode))error('이벤트 작업을 선택하세요.');
    before=store.gold_event||null;
    if(body.mode==='start'){
      if(store.maintenance)error('점검 모드를 끈 뒤 이벤트를 시작하세요.',409);
      if(before&&Date.parse(before.ends_at)>Date.now())error('이미 예고/진행 중인 이벤트가 있습니다.',409);
      const multiplier=body.multiplier??10,duration=body.duration_seconds??60,delay=body.delay_seconds??30;
      if(!Number.isInteger(multiplier)||multiplier<1||multiplier>1000||!Number.isInteger(duration)||duration<1||duration>86400||!Number.isInteger(delay)||delay<0||delay>86400)error('배율과 시간은 허용 범위의 정수로 입력하세요.');
      const now=Date.now();store.gold_event={id:crypto.randomUUID(),multiplier,starts_at:new Date(now+delay*1000).toISOString(),ends_at:new Date(now+(delay+duration)*1000).toISOString()};
    }else store.gold_event=null;
    after=store.gold_event;
  }
  else if (action==='admin_maintenance') {before={enabled:store.maintenance,message:store.message};store.maintenance=body.enabled===true;store.message=String(body.message||store.message).slice(0,500);after={enabled:store.maintenance,message:store.message};}
  else if (action==='admin_announcement') {
    if(body.clear===true){before=store.announcement;after=store.announcement=null;}
    else {const message=String(body.message||'').trim();if(!message||message.length>500) error('공지는 1~500자입니다.');before=store.announcement;after=store.announcement={message,author:actor.nickname,time:new Date().toISOString()};}
  }
  else if (action==='admin_test') {if(!ballIds.includes(body.ball_id)) error('잘못된 볼'); return {authorized:true,ball_id:body.ball_id};}
  else if (['admin_gold','admin_rebirths','admin_unlock','admin_discovery','admin_unban','admin_ban','admin_ranking_visibility'].includes(action)) {
    if(!target) error('대상 계정 없음',404);
    before=structuredClone({state:target.state,moderation:target.moderation,ranking_hidden:target.ranking_hidden===true});
    if(action==='admin_gold'||action==='admin_rebirths') {
      const key=action==='admin_gold'?'gold':'rebirths';if(!/^[0-9]{1,1000}$/.test(String(body.value))) error('0 이상의 정수를 입력하세요.');
      const n=BigInt(body.value);
      if(!['add','subtract','set'].includes(body.mode)) error('변경 방식 오류');
      const v=body.mode==='set'?n:body.mode==='add'?BigInt(target.state[key])+n:BigInt(target.state[key])>n?BigInt(target.state[key])-n:0n;
      if(v.toString().length>1000||(key==='rebirths'&&v>500n)) error('허용 범위를 벗어났습니다.');target.state[key]=key==='rebirths'?Number(v):v<=BigInt(Number.MAX_SAFE_INTEGER)?Number(v):v.toString();
      target.state.admin_revision=(target.state.admin_revision||0)+1;
    } else if(action==='admin_ban') {
      if(target.role==='admin') error('관리자 계정은 밴할 수 없습니다.');
      const reason=String(body.reason||'').trim();
      if(!reason||reason.length>500) error('밴 사유는 1~500자입니다.');
      if(!['temporary','permanent'].includes(body.mode)) error('밴 종류를 선택하세요.');
      if(body.mode==='temporary'&&(!Number.isInteger(body.duration_hours)||body.duration_hours<1||body.duration_hours>8760)) error('밴 기간은 1~8760시간입니다.');
      target.moderation={...target.moderation,status:body.mode==='permanent'?'banned':'suspended',
        suspended_until:body.mode==='permanent'?null:new Date(Date.now()+body.duration_hours*3600000).toISOString(),last_reason:reason};
    } else if(action==='admin_ranking_visibility') {
      if(typeof body.hidden!=='boolean') error('랭킹 숨김 여부를 선택하세요.');
      if(String(body.reason||'').length>500) error('사유는 500자 이내입니다.');
      target.ranking_hidden=body.hidden;
    } else if(action==='admin_unban') target.moderation={...target.moderation,status:'active',suspicion_score:0,suspended_until:null,last_reason:'관리자 밴 해제'};
    else {
      if(!['all','one','reset_one','reset_all'].includes(body.mode)) error('변경 방식 오류');
      if(body.mode.includes('one')&&!ballIds.includes(body.ball_id)) error('잘못된 볼');
      if(action==='admin_unlock') {if(!['all','one'].includes(body.mode)) error('변경 방식 오류');const ids=body.mode==='all'?ballIds:ballIds.slice(0,ballIds.indexOf(body.ball_id)+1);target.state.unlocked_ball_ids=[...new Set([...target.state.unlocked_ball_ids,...ids])];target.state.discovered_ball_ids=[...new Set([...target.state.discovered_ball_ids,...ids])];}
      else {const current=target.state.discovered_ball_ids;target.state.discovered_ball_ids=body.mode==='all'?[...ballIds]:body.mode==='reset_all'?[]:body.mode==='reset_one'?current.filter(id=>id!==body.ball_id):[...new Set([...current,body.ball_id])];}
    }
    if(['admin_ban','admin_unban','admin_ranking_visibility'].includes(action))target.state.admin_revision=(target.state.admin_revision||0)+1;
    after=structuredClone({state:target.state,moderation:target.moderation,ranking_hidden:target.ranking_hidden===true});
  } else error('unknown action',404);
  store.logs.push({admin:actor.id,action,target:target?.id||null,reason:String(body.reason||''),before,after,time:new Date().toISOString()});return {ok:true,...(action==='admin_ball_event'?{admin_ball_event:store.admin_ball_event,server_time:new Date().toISOString()}:{}),target:target?{id:target.id,nickname:target.nickname,ranking_hidden:target.ranking_hidden===true,state:target.state,moderation:target.moderation}:null};
}
