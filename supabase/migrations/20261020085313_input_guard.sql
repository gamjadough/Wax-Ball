-- Local review first. Client samples are advisory; accepted server hits corroborate them.
begin;
create table if not exists public.wakppu_input_guard(
 user_id uuid primary key references public.players(user_id) on delete cascade,
 tokens numeric not null default 80,token_at timestamptz not null default clock_timestamp(),first_seen timestamptz not null default clock_timestamp(),
 hits timestamptz[] not null default '{}',score integer not null default 0,streak integer not null default 0,
 last_report timestamptz,last_session uuid,last_end bigint not null default -1
);
create table if not exists public.wakppu_input_reports(user_id uuid references public.players(user_id) on delete cascade,request_id uuid,response jsonb not null,created_at timestamptz not null default clock_timestamp(),primary key(user_id,request_id));
create table if not exists public.wakppu_input_events(id bigint generated always as identity primary key,user_id uuid references public.players(user_id) on delete cascade,created_at timestamptz not null default clock_timestamp(),score integer not null,reasons jsonb not null,metrics jsonb not null,server_hits integer not null,corroborated boolean not null,restricted_until timestamptz);
create index if not exists wakppu_input_events_created_idx on public.wakppu_input_events(created_at desc,id desc);
create index if not exists wakppu_input_events_user_created_idx on public.wakppu_input_events(user_id,created_at desc,id desc);
create index if not exists wakppu_input_reports_created_idx on public.wakppu_input_reports(user_id,created_at desc);
alter table public.wakppu_input_guard enable row level security;alter table public.wakppu_input_reports enable row level security;alter table public.wakppu_input_events enable row level security;
revoke all on public.wakppu_input_guard,public.wakppu_input_reports,public.wakppu_input_events from public,anon,authenticated;
create or replace function public.wakppu_input_metrics(samples jsonb) returns jsonb
language plpgsql immutable set search_path=public,pg_temp as $fn$
declare p jsonb;n integer;i integer:=0;t numeric;x numeric;y numeric;previous numeric;first_t numeric;span numeric:=0;dt numeric;sum_sq numeric:=0;min_dt numeric;max_dt numeric;mean numeric;variation numeric:=1;cps numeric:=0;fixed numeric:=0;cells jsonb:='{}';key text;largest integer:=0;count_cell integer;eligible boolean;fast boolean;regular boolean;reasons jsonb:='[]';
begin
 if samples is null or jsonb_typeof(samples)<>'array' or jsonb_array_length(samples)>512 then raise exception '입력 기록 형식 오류';end if;
 n:=jsonb_array_length(samples);
 for p in select value from jsonb_array_elements(samples) loop
  if jsonb_typeof(p)<>'array' or jsonb_array_length(p)<>3 or jsonb_typeof(p->0)<>'number' or jsonb_typeof(p->1)<>'number' or jsonb_typeof(p->2)<>'number' then raise exception '입력 기록 형식 오류';end if;
  t:=(p->>0)::numeric;x:=(p->>1)::numeric;y:=(p->>2)::numeric;
  if t<>trunc(t) or x<>trunc(x) or y<>trunc(y) or t not between 0 and 1000000000000 or x not between 0 and 1000 or y not between 0 and 1000 or (previous is not null and t<previous) then raise exception '입력 기록 범위 오류';end if;
  if i=0 then first_t:=t;else dt:=t-previous;sum_sq:=sum_sq+dt*dt;min_dt:=least(min_dt,dt);max_dt:=greatest(max_dt,dt);end if;
  key:=floor(x/5+.5)::text||':'||floor(y/5+.5)::text;count_cell:=coalesce((cells->>key)::integer,0)+1;cells:=jsonb_set(cells,array[key],to_jsonb(count_cell));largest:=greatest(largest,count_cell);
  previous:=t;i:=i+1;
 end loop;
 if n>1 then span:=previous-first_t;mean:=span/(n-1);if mean>0 then cps:=(n-1)*1000/span;variation:=sqrt(greatest(0,sum_sq/(n-1)-mean*mean))/mean;end if;end if;
 if n>0 then fixed:=largest::numeric/n;end if;
 eligible:=n>=120 and span between 10000 and 30000;fast:=eligible and cps>=10;regular:=eligible and variation<=.02 and max_dt-min_dt<=4;
 if fast then reasons:=reasons||jsonb_build_array('지속적인 고속 입력');end if;
 if regular then reasons:=reasons||jsonb_build_array('거의 동일한 입력 간격');end if;
 if eligible and fixed>=.95 then reasons:=reasons||jsonb_build_array('같은 상대 좌표 반복');end if;
 return jsonb_build_object('count',n,'span',span,'cps',cps,'variation',variation,'fixed',fixed,'fast',fast,'regular',regular,'suspect',fast and regular,'reasons',reasons);
end $fn$;
revoke all on function public.wakppu_input_metrics(jsonb) from public,anon,authenticated;
do $wrap$ begin
 if to_regprocedure('public.wakppu_api_before_input_guard(jsonb)') is null then alter function public.wakppu_api(jsonb) rename to wakppu_api_before_input_guard;end if;
end $wrap$;
revoke all on function public.wakppu_api_before_input_guard(jsonb) from public,anon,authenticated;
create or replace function public.wakppu_api(b jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $api$
declare a text:=b->>'action';u uuid:=auth.uid();instant timestamptz:=clock_timestamp();g public.wakppu_input_guard%rowtype;result jsonb;cached jsonb;m jsonb;observed integer;elapsed numeric;corroborated boolean;suspect boolean;staff boolean;until_at timestamptz;first_t bigint;end_t bigint;page_no integer;rows jsonb;total bigint;seen boolean:=false;
begin
 if a not in ('item_hit','limited_hit','event_ball_hit','input_report','admin_input_guard') then
  if a='admin_unban' and u is not null and exists(select 1 from public.players where user_id=u and role='admin') and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
   -- Match report lock order before the legacy moderation update.
   perform 1 from public.game_states where user_id=(b->>'user_id')::uuid for update;
   perform 1 from public.wakppu_input_guard where user_id=(b->>'user_id')::uuid for update;
  end if;
  result:=public.wakppu_api_before_input_guard(b);
  if a='admin_unban' then update public.wakppu_input_guard set score=0,streak=0,last_report=null,last_session=null,last_end=-1,hits='{}' where user_id=(b->>'user_id')::uuid;end if;
  return result;
 end if;
 perform public.wakppu_api_before_input_guard('{"action":"bootstrap"}'::jsonb);
 staff:=exists(select 1 from public.players where user_id=u and role='admin') and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false);
 if a='admin_input_guard' then
  if not staff then raise sqlstate 'PT403' using message='관리자 권한이 필요합니다.';end if;
  if coalesce(b->>'page','0') !~ '^[0-9]{1,6}$' then raise exception '잘못된 페이지';end if;
  page_no:=coalesce((b->>'page')::integer,0);if page_no>100000 then raise exception '잘못된 페이지';end if;
  select count(*) into total from public.wakppu_input_events;
  select coalesce(jsonb_agg(q.row order by q.created_at desc,q.id desc),'[]') into rows from
   (select e.id,e.created_at,jsonb_build_object('at',floor(extract(epoch from e.created_at)*1000),'user_id',e.user_id,'nickname',p.nickname,'score',e.score,'reasons',e.reasons,'metrics',e.metrics,'server_hits',e.server_hits,'corroborated',e.corroborated,'restricted_until',e.restricted_until) as row from public.wakppu_input_events e join public.players p on p.user_id=e.user_id order by e.created_at desc,e.id desc limit 20 offset page_no*20) q;
  return jsonb_build_object('rows',rows,'page',page_no,'total',total);
 end if;
 if coalesce(b->>'request_id','') !~ '^[a-f0-9-]{36}$' then raise exception '잘못된 요청 ID';end if;
 -- Consistent game-state then guard-row locking order across reports and hit APIs.
 perform 1 from public.game_states where user_id=u for update;
 insert into public.wakppu_input_guard(user_id) values(u) on conflict do nothing;
 select * into g from public.wakppu_input_guard where user_id=u for update;
 instant:=clock_timestamp();
 if a in ('item_hit','limited_hit','event_ball_hit') then
  select exists(select 1 from public.wakppu_item_requests where user_id=u and request_id=(b->>'request_id')::uuid)
   or exists(select 1 from public.wakppu_limited_requests where user_id=u and request_id=(b->>'request_id')::uuid)
   or exists(select 1 from public.wakppu_event_ball_progress where user_id=u and request_id=b->>'request_id') into seen;
  if seen then return public.wakppu_api_before_input_guard(b);end if;
  g.tokens:=least(80,g.tokens+greatest(0,extract(epoch from instant-g.token_at))*40);
  if g.tokens<1 then raise sqlstate 'PT429' using message='입력이 너무 빠릅니다. 잠시 쉬었다가 눌러주세요.';end if;
  result:=public.wakppu_api_before_input_guard(b);
  select coalesce(array_agg(t order by t),'{}') into g.hits from (select t from unnest(g.hits||array[instant]) t where t>=instant-interval '30 seconds' order by t desc limit 512) q;
  update public.wakppu_input_guard set tokens=g.tokens-1,token_at=instant,hits=g.hits where user_id=u;return result;
 end if;
 if b ? 'user_id' then raise exception '대상 계정을 지정할 수 없습니다.';end if;
 if coalesce(b->>'session_id','') !~ '^[a-f0-9-]{36}$' then raise exception '잘못된 입력 세션';end if;
 select response into cached from public.wakppu_input_reports where user_id=u and request_id=(b->>'request_id')::uuid;if found then return cached;end if;
 m:=public.wakppu_input_metrics(b->'samples');first_t:=coalesce((b->'samples'->0->>0)::bigint,0);end_t:=coalesce((b->'samples'->-1->>0)::bigint,0);
 if g.last_report is not null and instant<g.last_report+interval '10 seconds' then raise sqlstate 'PT429' using message='입력 기록 전송 간격이 너무 짧습니다.';end if;
 if g.last_session=(b->>'session_id')::uuid and first_t<=g.last_end then raise exception '이미 분석한 입력 구간입니다.';end if;
 select count(*) into observed from unnest(g.hits) t where t>=instant-interval '30 seconds';
 elapsed:=extract(epoch from instant-coalesce(g.last_report,g.first_seen))*1000;corroborated:=observed>=8 and elapsed>=10000;
 if g.last_session is distinct from (b->>'session_id')::uuid then g.streak:=0;end if;
 suspect:=(m->>'suspect')::boolean and corroborated;
 g.streak:=case when suspect then g.streak+1 else 0 end;g.score:=case when suspect then least(100,g.score+35+case when (m->>'fixed')::numeric>=.95 then 5 else 0 end) else greatest(0,g.score-10) end;
 if suspect and g.streak>=3 and g.score>=100 and not staff then
  until_at:=instant+interval '2 minutes';
  insert into public.moderation_cases(user_id,status,suspicion_score,strikes,suspended_until,last_reason,updated_at) values(u,'suspended',g.score,1,until_at,'입력 패턴 복수 신호 반복 · 자동 2분 제한',instant)
   on conflict(user_id) do update set status='suspended',suspicion_score=g.score,strikes=moderation_cases.strikes+1,suspended_until=until_at,last_reason=excluded.last_reason,updated_at=instant;
 end if;
 update public.wakppu_input_guard set hits='{}',last_report=instant,last_session=(b->>'session_id')::uuid,last_end=end_t,score=g.score,streak=g.streak where user_id=u;
 if jsonb_array_length(m->'reasons')>0 or g.score>0 then
  insert into public.wakppu_input_events(user_id,score,reasons,metrics,server_hits,corroborated,restricted_until) values(u,g.score,m->'reasons',m-'reasons',observed,corroborated,until_at);
 end if;
 result:=jsonb_build_object('ok',true,'input_guard',jsonb_build_object('score',g.score,'restricted_until',until_at));
 insert into public.wakppu_input_reports(user_id,request_id,response) values(u,(b->>'request_id')::uuid,result);
 -- Bounded per-account retention; normalized coordinates are never persisted.
 delete from public.wakppu_input_events where id in(select id from public.wakppu_input_events where created_at<instant-interval '7 days' order by created_at limit 500);
 delete from public.wakppu_input_events where user_id=u and id in(select id from public.wakppu_input_events where user_id=u order by created_at desc,id desc offset 200);
 delete from public.wakppu_input_reports where user_id=u and request_id in(select request_id from public.wakppu_input_reports where user_id=u order by created_at desc,request_id desc offset 64);
 return result;
end $api$;
revoke all on function public.wakppu_api(jsonb) from public;grant execute on function public.wakppu_api(jsonb) to anon,authenticated;
commit;
