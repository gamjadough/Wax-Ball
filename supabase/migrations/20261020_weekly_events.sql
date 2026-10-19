-- Weekly KST windows. Migration seeds disabled schedules; activation is separate.
begin;
create table if not exists public.wakppu_weekly_events(
 id text primary key,weekday integer not null check(weekday between 1 and 7),
 local_time time not null,ball_seconds integer not null check(ball_seconds between 1 and 86400),
 gold_seconds integer not null check(gold_seconds between 1 and 86400),
 multiplier integer not null check(multiplier between 1 and 1000),enabled boolean not null default false,
 skip_gold date,skip_ball date
);
alter table public.wakppu_weekly_events enable row level security;
revoke all on public.wakppu_weekly_events from public,anon,authenticated;
insert into public.wakppu_weekly_events(id,weekday,local_time,ball_seconds,gold_seconds,multiplier)
 values('friday-morning',5,'07:00',600,600,10),('friday-evening',5,'21:30',900,600,100)
 on conflict(id) do nothing;
create or replace function public.wakppu_weekly_candidate(kind text,instant timestamptz)
returns jsonb language sql stable set search_path=public,pg_temp as $fn$
 with windows as (
 select s.*,((date_trunc('week',instant at time zone 'Asia/Seoul')::date
  +(s.weekday-1)+7*w.n)+s.local_time) at time zone 'Asia/Seoul' as starts,
  case when kind='gold' then s.gold_seconds else s.ball_seconds end as duration
 from public.wakppu_weekly_events s cross join generate_series(-1,2) w(n) where s.enabled
 ), next_window as (
 select * from windows where starts+make_interval(secs=>duration)>instant
 and (starts at time zone 'Asia/Seoul')::date is distinct from case when kind='gold' then skip_gold else skip_ball end
 order by starts,id limit 1
 ) select jsonb_build_object('id','weekly:'||id||':'||extract(epoch from starts)::bigint,
 'source','weekly','schedule_id',id,'starts_at',starts,'ends_at',starts+make_interval(secs=>duration))
 ||case when kind='gold' then jsonb_build_object('multiplier',multiplier) else '{}'::jsonb end from next_window
$fn$;
create or replace function public.wakppu_refresh_weekly_events(instant timestamptz default clock_timestamp())
returns void language plpgsql security definer set search_path=public,pg_temp as $fn$
declare s server_settings;gold jsonb;ball jsonb;change_gold boolean;change_ball boolean;
begin
 select * into s from public.server_settings where id=true;
 if s.maintenance then return;end if;
 gold:=public.wakppu_weekly_candidate('gold',instant);ball:=public.wakppu_weekly_candidate('ball',instant);
 change_gold:=(s.gold_event is null or s.gold_event->>'source'='weekly' or (s.gold_event->>'ends_at')::timestamptz<=instant) and s.gold_event is distinct from gold;
 change_ball:=(s.admin_ball_event is null or s.admin_ball_event->>'source'='weekly' or (s.admin_ball_event->>'ends_at')::timestamptz<=instant) and s.admin_ball_event is distinct from ball;
 if not coalesce(change_gold,false) and not coalesce(change_ball,false) then return;end if;
 -- Lock only when a window changes, not on every player hit.
 select * into s from public.server_settings where id=true for update;
 if s.maintenance then return;end if;
 gold:=public.wakppu_weekly_candidate('gold',instant);ball:=public.wakppu_weekly_candidate('ball',instant);
 if s.gold_event is null or s.gold_event->>'source'='weekly' or (s.gold_event->>'ends_at')::timestamptz<=instant then
  if s.gold_event is distinct from gold then update public.server_settings set gold_event=gold where id=true;end if;
 end if;
 if s.admin_ball_event is null or s.admin_ball_event->>'source'='weekly' or (s.admin_ball_event->>'ends_at')::timestamptz<=instant then
  if s.admin_ball_event is distinct from ball then update public.server_settings set admin_ball_event=ball where id=true;end if;
 end if;
end $fn$;
revoke all on function public.wakppu_weekly_candidate(text,timestamptz),public.wakppu_refresh_weekly_events(timestamptz) from public,anon,authenticated;
do $wrap$ begin
 if to_regprocedure('public.wakppu_api_before_weekly_events(jsonb)') is null then
  alter function public.wakppu_api(jsonb) rename to wakppu_api_before_weekly_events;
 end if;
end $wrap$;
revoke all on function public.wakppu_api_before_weekly_events(jsonb) from public,anon,authenticated;
create or replace function public.wakppu_api(b jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $fn$
declare actor uuid:=auth.uid();role_name text;a text:=b->>'action';mode text:=b->>'mode';
 s server_settings;previous jsonb;result jsonb;kind text;instant timestamptz:=clock_timestamp();
begin
 select role into role_name from public.players where user_id=actor;
 if a='admin_weekly_events' then
  if actor is null or role_name is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.';end if;
  if role_name<>'admin' or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise sqlstate 'PT403' using message='관리자 권한이 필요합니다.';end if;
  perform public.wakppu_api_before_weekly_events('{"action":"bootstrap"}');
  if mode is null or mode not in ('enable','disable','list') then raise sqlstate 'PT400' using message='반복 예약 작업을 선택하세요.';end if;
  if mode<>'list' then
   select * into s from public.server_settings where id=true for update;
   if mode='enable' and s.maintenance then raise sqlstate 'PT409' using message='점검 모드를 해제한 뒤 반복 예약을 켜세요.';end if;
   select jsonb_agg(to_jsonb(w) order by local_time) into previous from public.wakppu_weekly_events w;
   update public.wakppu_weekly_events set enabled=(mode='enable');
   -- Disable clears only our windows, never another manually configured event.
   if mode='disable' then
    update public.server_settings set gold_event=case when gold_event->>'source'='weekly' then null else gold_event end,
     admin_ball_event=case when admin_ball_event->>'source'='weekly' then null else admin_ball_event end where id=true;
   end if;
   insert into public.admin_audit_logs(admin_user_id,action,reason,details)
    values(actor,'ADMIN_WEEKLY_EVENTS_'||upper(mode),'금요일 반복 이벤트',jsonb_build_object('before',previous,'enabled',mode='enable'));
  end if;
  perform public.wakppu_refresh_weekly_events();
  select * into s from public.server_settings where id=true;
  return jsonb_build_object('ok',true,'weekly_events',(select jsonb_agg(to_jsonb(w) order by local_time) from public.wakppu_weekly_events w),
   'gold_event',s.gold_event,'admin_ball_event',s.admin_ball_event,'server_time',clock_timestamp());
 end if;
 -- Preserve manual scheduling and make cancellation skip only that occurrence.
 if a in ('admin_gold_event','admin_ball_event','admin_event_schedule','admin_event_schedule_cancel') then
  if actor is null or role_name is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.';end if;
  if role_name<>'admin' or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise sqlstate 'PT403' using message='관리자 권한이 필요합니다.';end if;
  perform public.wakppu_api_before_weekly_events('{"action":"bootstrap"}');
  kind:=case when a='admin_gold_event' then 'gold' when a='admin_ball_event' then 'ball' else b->>'event_type' end;
  select * into s from public.server_settings where id=true for update;
  previous:=case when kind='gold' then s.gold_event else s.admin_ball_event end;
  if previous->>'source'='weekly' then
   if mode='stop' or a='admin_event_schedule_cancel' then
    if a='admin_event_schedule_cancel' and previous->>'id' is distinct from b->>'event_id' then raise sqlstate 'PT409' using message='이벤트가 변경되었습니다.';end if;
    if kind='gold' then update public.wakppu_weekly_events set skip_gold=((previous->>'starts_at')::timestamptz at time zone 'Asia/Seoul')::date where id=previous->>'schedule_id';
    else update public.wakppu_weekly_events set skip_ball=((previous->>'starts_at')::timestamptz at time zone 'Asia/Seoul')::date where id=previous->>'schedule_id';end if;
   elsif (mode='start' or a='admin_event_schedule') and instant<(previous->>'starts_at')::timestamptz then
    if kind='gold' then update public.server_settings set gold_event=null where id=true;
    else update public.server_settings set admin_ball_event=null where id=true;end if;
   end if;
  end if;
  return public.wakppu_api_before_weekly_events(b);
 end if;
 perform public.wakppu_refresh_weekly_events();
 result:=public.wakppu_api_before_weekly_events(b);
 if a='status' and role_name='admin' and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
  result:=result||jsonb_build_object('weekly_events',(select jsonb_agg(to_jsonb(w) order by local_time) from public.wakppu_weekly_events w));
 end if;
 return result;
end $fn$;
revoke all on function public.wakppu_api(jsonb) from public;
grant execute on function public.wakppu_api(jsonb) to anon,authenticated;
-- Existing pg_cron installation; exact event timestamps do not depend on cron lag.
do $cron$ begin
 if to_regnamespace('cron') is not null then
  if not exists(select 1 from cron.job where jobname='wakppu-weekly-events') then
   perform cron.schedule('wakppu-weekly-events','* * * * *','select public.wakppu_refresh_weekly_events();');
  end if;
 end if;
end $cron$;
commit;
