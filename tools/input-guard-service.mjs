import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {execute as baseExecute} from './separate-events-service.mjs';
const box={};vm.runInNewContext(readFileSync(new URL('../wakppuball/js/input-guard-rules.js',import.meta.url),'utf8'),box);
export const {policy,analyze}=box.WakppuInputGuardRules;
const hits=new Set(['item_hit','limited_hit','event_ball_hit']),uuid=x=>/^[a-f0-9-]{36}$/.test(x||'');
const fail=(m,status=400)=>{throw Object.assign(new Error(m),{status});};
const admin=a=>a?.role==='admin'&&!a.is_anonymous;
export function guardState(actor,now){return actor.inputGuard||={tokens:policy.burst,tokenAt:now,firstSeen:now,hits:[],score:0,streak:0,lastReport:0,lastEnd:-1,session:null,restrictedUntil:null,speedUntil:null,reports:new Map(),accepted:new Map(),records:[]};}
export function execute(store,actor,b){
 const now=store.input_now_ms??Date.now(),a=b.action;
 if(!hits.has(a)&&a!=='input_report'&&a!=='admin_input_guard'){
  const result=baseExecute(store,actor,b);
  if(a==='admin_unban'){const p=store.players.find(x=>x.id===b.user_id);if(p?.inputGuard){p.inputGuard.score=0;p.inputGuard.streak=0;p.inputGuard.restrictedUntil=null;p.inputGuard.speedUntil=null;p.inputGuard.lastReport=0;p.inputGuard.session=null;p.inputGuard.lastEnd=-1;p.inputGuard.hits=[];}}
  return result;
 }
 baseExecute(store,actor,{action:'bootstrap'});const g=guardState(actor,now);
 if(a==='admin_input_guard'){
  if(!admin(actor))fail('관리자 권한이 필요합니다.',403);
  const page=b.page??0;if(!Number.isInteger(page)||page<0||page>100000)fail('잘못된 페이지');
  const rows=store.players.flatMap(p=>(p.inputGuard?.records||[]).map(r=>({...r,user_id:p.id,nickname:p.nickname}))).sort((x,y)=>y.at-x.at);
  return {rows:rows.slice(page*20,page*20+20),page,total:rows.length};
 }
 if(!uuid(b.request_id))fail('잘못된 요청 ID');
 if(hits.has(a)){
  const legacy=actor.items?.requests.get(b.request_id)||actor.limited?.requests.get(b.request_id);if(legacy)return baseExecute(store,actor,b);
  const cached=g.accepted.get(b.request_id);if(cached){if(cached.action!==a)fail('요청 ID 충돌');return structuredClone(cached.result);}
  const soft=g.speedUntil>now&&!admin(actor),tokens=Math.min(soft?policy.softBurst:policy.burst,g.tokens+Math.max(0,now-g.tokenAt)*(soft?policy.softRate:policy.rate)/1000);
  if(tokens<1)fail('입력이 너무 빠릅니다. 잠시 쉬었다가 눌러주세요.',429);
  const result=baseExecute(store,actor,b);g.tokens=tokens-1;g.tokenAt=now;g.hits=g.hits.filter(t=>t>=now-30000);if(b.hit_source!=='ember_auto')g.hits.push(now);g.hits=g.hits.slice(-512);
  g.accepted.set(b.request_id,{action:a,result:structuredClone(result)});if(g.accepted.size>512)g.accepted.delete(g.accepted.keys().next().value);return result;
 }
 if(b.user_id!==undefined)fail('대상 계정을 지정할 수 없습니다.');
 if(!uuid(b.session_id))fail('잘못된 입력 세션');
 const cached=g.reports.get(b.request_id);if(cached)return structuredClone(cached);
 const m=analyze(b.samples),first=b.samples[0]?.[0]??0,end=b.samples.at(-1)?.[0]??0;
 if(g.lastReport&&now-g.lastReport<policy.reportGap)fail('입력 기록 전송 간격이 너무 짧습니다.',429);
 if(g.session===b.session_id&&first<=g.lastEnd)fail('이미 분석한 입력 구간입니다.');
 const observed=g.hits.filter(t=>t>=now-30000).length,elapsed=g.lastReport?now-g.lastReport:now-g.firstSeen;
 const corroborated=observed>=policy.serverHits&&elapsed>=policy.reportGap;
 if((m.overspeed||m.cyclic)&&corroborated&&!admin(actor))g.speedUntil=now+policy.softMs;
 if(g.session!==b.session_id)g.streak=0;
 const suspect=m.suspect&&corroborated;g.streak=suspect?g.streak+1:0;g.score=suspect?Math.min(100,g.score+35+(m.fixed>=.95?5:0)):Math.max(0,g.score-10);
 g.session=b.session_id;g.lastEnd=end;g.lastReport=now;g.hits=[];
 const restricted=suspect&&g.streak>=3&&g.score>=100&&!admin(actor);
 if(restricted){g.restrictedUntil=now+policy.limitMs;actor.moderation={...actor.moderation,status:'suspended',suspicion_score:g.score,strikes:(actor.moderation?.strikes||0)+1,suspended_until:new Date(g.restrictedUntil).toISOString(),last_reason:'입력 패턴 복수 신호 반복 · 자동 2분 제한'};}
 if(m.reasons.length||g.score){g.records.push({at:now,score:g.score,streak:g.streak,reasons:m.reasons,server_hits:observed,corroborated,restricted_until:restricted?g.restrictedUntil:null,metrics:{...m,reasons:undefined,speed_limited_until:g.speedUntil>now?new Date(g.speedUntil).toISOString():null}});g.records=g.records.filter(r=>r.at>now-7*86400000).slice(-200);}
 const result={ok:true,input_guard:{score:g.score,restricted_until:restricted?new Date(g.restrictedUntil).toISOString():null,speed_limited_until:g.speedUntil>now?new Date(g.speedUntil).toISOString():null}};g.reports.set(b.request_id,structuredClone(result));if(g.reports.size>64)g.reports.delete(g.reports.keys().next().value);return result;
}
