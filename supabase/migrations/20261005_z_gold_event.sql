-- Apply after the account/moderation migrations; preserve their API unchanged.
begin;
alter table public.server_settings add column if not exists gold_event jsonb;
do $$ begin
 if to_regprocedure('public.wakppu_api_before_events(jsonb)') is null then
  alter function public.wakppu_api(jsonb) rename to wakppu_api_before_events;
 end if;
end $$;
revoke all on function public.wakppu_api_before_events(jsonb) from public,anon,authenticated;
create or replace function public.wakppu_api(b jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 actor uuid:=auth.uid(); role_name text; settings server_settings;
 previous jsonb; next_event jsonb; result jsonb; instant timestamptz:=clock_timestamp();
begin
 if b->>'action'='admin_gold_event' then
  select role into role_name from players where user_id=actor;
  if actor is null or role_name is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.'; end if;
  if role_name<>'admin' or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise sqlstate 'PT403' using message='관리자 권한이 필요합니다.'; end if;
  if exists(select 1 from moderation_cases where user_id=actor and (status='banned' or (status='suspended' and (suspended_until is null or suspended_until>instant)))) then raise sqlstate 'PT403' using message='이용 제한 계정입니다.'; end if;
  if coalesce(b->>'mode','') not in ('start','stop') then raise sqlstate 'PT400' using message='이벤트 작업을 선택하세요.'; end if;
  select * into settings from server_settings where id=true for update;
  instant:=clock_timestamp();previous:=settings.gold_event;
  if b->>'mode'='start' then
   if settings.maintenance then raise sqlstate 'PT409' using message='점검 모드를 끈 뒤 이벤트를 시작하세요.'; end if;
   if previous is not null and (previous->>'ends_at')::timestamptz>instant then raise sqlstate 'PT409' using message='이미 예고/진행 중인 이벤트가 있습니다.'; end if;
   next_event:=jsonb_build_object('id',gen_random_uuid(),'multiplier',10,'starts_at',instant+interval '30 seconds','ends_at',instant+interval '90 seconds');
  else next_event:=null;
  end if;
  update server_settings set gold_event=next_event where id=true;
  insert into admin_audit_logs(admin_user_id,target_user_id,action,reason,details)
   values(actor,null,'ADMIN_GOLD_EVENT_'||upper(b->>'mode'),'전체 골드 타임',jsonb_build_object('before',previous,'after',next_event));
  return jsonb_build_object('ok',true,'gold_event',next_event,'server_time',instant);
 end if;
 result:=public.wakppu_api_before_events(b);
 if b->>'action'='status' then
  select * into settings from server_settings where id=true;
  return result||jsonb_build_object('gold_event',case when settings.maintenance then null else settings.gold_event end,'server_time',clock_timestamp());
 end if;
 return result;
end $$;
revoke all on function public.wakppu_api(jsonb) from public;
grant execute on function public.wakppu_api(jsonb) to anon,authenticated;
commit;
