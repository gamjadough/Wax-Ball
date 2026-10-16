-- Keep legacy reward readers on effective slots, while manual reservations have
-- independent durable slots. This follows the legacy 20261020 weekly migration.
begin;
alter table public.server_settings add column if not exists manual_gold_event jsonb;
alter table public.server_settings add column if not exists manual_ball_event jsonb;
-- Run once: preserve existing manual events, never import an automatic reservation.
do $init$ begin
 if to_regprocedure('public.wakppu_separate_event(jsonb,jsonb,timestamptz)') is null then
  update public.server_settings set manual_gold_event=case when gold_event->>'source' is distinct from 'weekly' then gold_event end,
   manual_ball_event=case when admin_ball_event->>'source' is distinct from 'weekly' then admin_ball_event end where id=true;
 end if;
end $init$;
create or replace function public.wakppu_separate_event(manual jsonb,weekly jsonb,instant timestamptz)
returns jsonb language sql immutable set search_path=public,pg_temp as $$
 select case
 when instant>=(manual->>'starts_at')::timestamptz and instant<(manual->>'ends_at')::timestamptz then manual
 when instant>=(weekly->>'starts_at')::timestamptz and instant<(weekly->>'ends_at')::timestamptz then weekly
 when (manual->>'ends_at')::timestamptz>instant and (weekly is null or (manual->>'starts_at')::timestamptz<=(weekly->>'starts_at')::timestamptz) then manual
 else weekly end
$$;
create or replace function public.wakppu_refresh_weekly_events(instant timestamptz default clock_timestamp())
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare s server_settings;gold jsonb;ball jsonb;
begin
 select * into s from server_settings where id=true;
 if s.maintenance then return;end if;
 gold:=public.wakppu_separate_event(s.manual_gold_event,public.wakppu_weekly_candidate('gold',instant),instant);
 ball:=public.wakppu_separate_event(s.manual_ball_event,public.wakppu_weekly_candidate('ball',instant),instant);
 if s.gold_event is not distinct from gold and s.admin_ball_event is not distinct from ball then return;end if;
 select * into s from server_settings where id=true for update;
 if s.maintenance then return;end if;
 gold:=public.wakppu_separate_event(s.manual_gold_event,public.wakppu_weekly_candidate('gold',instant),instant);
 ball:=public.wakppu_separate_event(s.manual_ball_event,public.wakppu_weekly_candidate('ball',instant),instant);
 update server_settings set gold_event=gold,admin_ball_event=ball where id=true;
end $$;
create or replace function public.wakppu_separate_weekly_api(b jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid();role_name text;a text:=b->>'action';mode text:=b->>'mode';
 s server_settings;previous jsonb;result jsonb;instant timestamptz:=clock_timestamp();blocked boolean;
begin
 select role into role_name from players where user_id=actor;
 if a in ('admin_weekly_events','admin_gold_event','admin_ball_event','admin_event_schedule','admin_event_schedule_cancel') then
  if actor is null or role_name is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.';end if;
  if role_name<>'admin' or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise sqlstate 'PT403' using message='관리자 권한이 필요합니다.';end if;
  perform public.wakppu_api_before_weekly_events('{"action":"bootstrap"}');
  select * into s from server_settings where id=true for update;
  if a='admin_weekly_events' then
   if mode is null or mode not in ('enable','disable','list') then raise sqlstate 'PT400' using message='반복 예약 작업을 선택하세요.';end if;
   if mode='enable' and s.maintenance then raise sqlstate 'PT409' using message='점검 모드를 해제하세요.';end if;
   if mode<>'list' then
    select jsonb_agg(to_jsonb(w) order by local_time) into previous from wakppu_weekly_events w;
    update wakppu_weekly_events set enabled=(mode='enable');
    insert into admin_audit_logs(admin_user_id,action,reason,details) values(actor,'ADMIN_WEEKLY_EVENTS_'||upper(mode),'금요일 반복 이벤트',jsonb_build_object('before',previous,'enabled',mode='enable'));
   end if;
   result:=jsonb_build_object('ok',true);
  else
   -- Only administrator mutations use these temporary slots. Row locking and
   -- transaction isolation prevent players/cron from observing intermediate data.
   update server_settings set gold_event=s.manual_gold_event,admin_ball_event=s.manual_ball_event where id=true;
   result:=public.wakppu_api_before_weekly_events(b);
   update server_settings set manual_gold_event=gold_event,manual_ball_event=admin_ball_event where id=true;
  end if;
  perform public.wakppu_refresh_weekly_events();
  result:=result||public.wakppu_api_before_weekly_events('{"action":"status"}');
 else
  perform public.wakppu_refresh_weekly_events();
  result:=public.wakppu_api_before_weekly_events(b);
 end if;
 if a='status' or a in ('admin_weekly_events','admin_gold_event','admin_ball_event','admin_event_schedule','admin_event_schedule_cancel') then
  select * into s from server_settings where id=true;
  blocked:=s.maintenance or (coalesce((result->'sleep_hours'->>'active')::boolean,false) and role_name is distinct from 'admin');
  result:=result||jsonb_build_object(
   'manual_gold_event',case when not blocked and (s.manual_gold_event->>'ends_at')::timestamptz>instant then s.manual_gold_event end,
   'manual_ball_event',case when not blocked and (s.manual_ball_event->>'ends_at')::timestamptz>instant then s.manual_ball_event end);
  if role_name='admin' and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
   result:=result||jsonb_build_object('weekly_events',(select jsonb_agg(to_jsonb(w) order by local_time) from wakppu_weekly_events w),
    'weekly_gold_event',public.wakppu_weekly_candidate('gold',instant),'weekly_ball_event',public.wakppu_weekly_candidate('ball',instant));
  end if;
 end if;
 return result;
end $$;
-- Replace only the weekly layer, preserving newer outer API wrappers.
do $patch$
declare f record;counted integer:=0;body text;
begin
 for f in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname like 'wakppu_api%' and p.prokind='f' loop
  body:=pg_get_functiondef(f.oid);
  if position('if a=''admin_weekly_events'' then' in body)>0 or position('return public.wakppu_separate_weekly_api(b)' in body)>0 then
   execute format('create or replace function public.%I(b jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$begin return public.wakppu_separate_weekly_api(b);end$fn$',f.proname);
   counted:=counted+1;
  end if;
  -- Do not discard weekly progress when an independent manual ball starts/stops.
  if position('delete from wakppu_event_ball_progress where' in body)>0 then
   body:=replace(body,'delete from wakppu_event_ball_progress where','delete from wakppu_event_ball_progress where event_id not like ''weekly:%'' and');
   if position('event_id not like ''weekly:%'' and event_id not like' in body)>0 then continue;end if;
   execute body;
  end if;
 end loop;
 if counted<>1 then raise exception 'Expected exactly one weekly API layer, found %',counted;end if;
end $patch$;
revoke all on function public.wakppu_separate_event(jsonb,jsonb,timestamptz),public.wakppu_separate_weekly_api(jsonb),public.wakppu_refresh_weekly_events(timestamptz) from public,anon,authenticated;
select public.wakppu_refresh_weekly_events();
commit;
