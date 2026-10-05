-- Apply after guest lifecycle. Replace only its inner event wrapper; retain all game APIs.
begin;
create or replace function public.wakppu_api_before_guest_lifecycle(b jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 actor uuid:=auth.uid(); role_name text; settings server_settings;
 previous jsonb; next_event jsonb; result jsonb; instant timestamptz:=clock_timestamp();
 event_multiplier integer; duration_seconds integer; delay_seconds integer;
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
   if coalesce(b->>'multiplier','10') !~ '^[0-9]{1,4}$'
    or coalesce(b->>'duration_seconds','60') !~ '^[0-9]{1,5}$'
    or coalesce(b->>'delay_seconds','30') !~ '^[0-9]{1,5}$' then raise sqlstate 'PT400' using message='배율과 시간은 정수로 입력하세요.'; end if;
   event_multiplier:=coalesce(b->>'multiplier','10')::integer;
   duration_seconds:=coalesce(b->>'duration_seconds','60')::integer;
   delay_seconds:=coalesce(b->>'delay_seconds','30')::integer;
   if event_multiplier not between 1 and 1000 or duration_seconds not between 1 and 86400 or delay_seconds not between 0 and 86400 then raise sqlstate 'PT400' using message='배율은 1~1000배, 진행은 1~86400초, 대기는 0~86400초입니다.'; end if;
   next_event:=jsonb_build_object('id',gen_random_uuid(),'multiplier',event_multiplier,'starts_at',instant+make_interval(secs=>delay_seconds),'ends_at',instant+make_interval(secs=>delay_seconds+duration_seconds));
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
revoke all on function public.wakppu_api_before_guest_lifecycle(jsonb) from public,anon,authenticated;
commit;
