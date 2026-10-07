-- One-shot absolute schedules. Existing timestamp-based event reward/status logic
-- automatically observes starts_at/ends_at; no player/browser timer or cron needed.
begin;
do $$begin
 if to_regprocedure('public.wakppu_api_before_event_schedule(jsonb)') is null then
  alter function public.wakppu_api(jsonb) rename to wakppu_api_before_event_schedule;
 end if;
end$$;
revoke all on function public.wakppu_api_before_event_schedule(jsonb) from public,anon,authenticated;
create or replace function public.wakppu_api(b jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); role_name text; kind text:=b->>'event_type';
 instant timestamptz; starts timestamptz; settings server_settings; event jsonb; result jsonb; action_name text;
begin
 if b->>'action' not in ('admin_event_schedule','admin_event_schedule_cancel') or b->>'action' is null then
  return public.wakppu_api_before_event_schedule(b);
 end if;
 select role into role_name from players where user_id=actor;
 if actor is null or role_name is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.'; end if;
 if role_name<>'admin' or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise sqlstate 'PT403' using message='관리자 권한이 필요합니다.'; end if;
 perform public.wakppu_api_before_event_schedule(jsonb_build_object('action','bootstrap'));
 if kind is null or kind not in ('gold','ball') then raise sqlstate 'PT400' using message='이벤트 종류를 선택하세요.'; end if;
 select * into settings from server_settings where id=true for update;
 instant:=clock_timestamp();
 action_name:=case when kind='gold' then 'admin_gold_event' else 'admin_ball_event' end;
 event:=case when kind='gold' then settings.gold_event else settings.admin_ball_event end;
 if b->>'action'='admin_event_schedule_cancel' then
  if event is null or event->>'id' is distinct from b->>'event_id' then raise sqlstate 'PT409' using message='이벤트가 변경되었습니다. 다시 확인해주세요.'; end if;
  return public.wakppu_api_before_event_schedule(jsonb_build_object('action',action_name,'mode','stop'));
 end if;
 if coalesce(b->>'starts_at','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?Z$' then raise sqlstate 'PT400' using message='UTC 시작 시각 형식이 올바르지 않습니다.'; end if;
 begin starts:=(b->>'starts_at')::timestamptz;
 exception when others then raise sqlstate 'PT400' using message='시작 날짜와 시각이 올바르지 않습니다.'; end;
 if to_char(starts at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS') is distinct from left(b->>'starts_at',19) then raise sqlstate 'PT400' using message='올바른 날짜와 시각을 입력하세요.'; end if;
 if starts<=instant or starts>instant+interval '365 days' then raise sqlstate 'PT400' using message='서버 현재 시각 이후부터 365일 이내로 예약하세요.'; end if;
 -- Delegate validation, singleton conflict, maintenance/moderation checks and
 -- existing event setup to the current wrapper stack, in this same transaction.
 result:=public.wakppu_api_before_event_schedule((b-'starts_at'-'event_type')||jsonb_build_object('action',action_name,'mode','start','delay_seconds',0));
 select * into settings from server_settings where id=true;
 event:=case when kind='gold' then settings.gold_event else settings.admin_ball_event end;
 event:=event||jsonb_build_object('starts_at',starts,'ends_at',starts+((event->>'ends_at')::timestamptz-(event->>'starts_at')::timestamptz));
 if kind='gold' then update server_settings set gold_event=event where id=true;
 else update server_settings set admin_ball_event=event where id=true;end if;
 insert into admin_audit_logs(admin_user_id,action,reason,details) values(actor,'ADMIN_EVENT_SCHEDULE','시각 지정 예약',jsonb_build_object('event_type',kind,'after',event));
 return jsonb_build_object('ok',true,case when kind='gold' then 'gold_event' else 'admin_ball_event' end,event,'server_time',clock_timestamp());
end$$;
revoke all on function public.wakppu_api(jsonb) from public;
grant execute on function public.wakppu_api(jsonb) to anon,authenticated;
commit;
