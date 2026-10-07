-- Apply after the item API migration. Server time in Asia/Seoul is authoritative.
begin;
create or replace function public.wakppu_sleep_hours(instant timestamptz) returns jsonb
language sql stable set search_path=public,pg_temp as $$
 with local_time as (select instant at time zone 'Asia/Seoul' as t), schedule as (
  select t,extract(hour from t)>=23 or extract(hour from t)<6 as active,
   date_trunc('day',t)+case when extract(hour from t)<6 then interval '6 hours' else interval '30 hours' end as opens
  from local_time
 ) select jsonb_build_object('active',active,'next_open_at',opens at time zone 'Asia/Seoul',
  'next_change_at',(case when active then opens else date_trunc('day',t)+interval '23 hours' end) at time zone 'Asia/Seoul') from schedule;
$$;
revoke all on function public.wakppu_sleep_hours(timestamptz) from public,anon,authenticated;
do $migration$ begin
 if to_regprocedure('public.wakppu_api_before_sleep(jsonb)') is null then
  alter function public.wakppu_api(jsonb) rename to wakppu_api_before_sleep;
 end if;
end $migration$;
revoke all on function public.wakppu_api_before_sleep(jsonb) from public,anon,authenticated;
create or replace function public.wakppu_api(b jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $api$
declare a text:=b->>'action'; instant timestamptz:=clock_timestamp(); hours jsonb:=public.wakppu_sleep_hours(instant); result jsonb; is_admin boolean;
begin
 if a='status' then
  result:=public.wakppu_api_before_sleep(b);
  result:=result||jsonb_build_object('sleep_hours',hours,'server_time',instant);
  if (hours->>'active')::boolean and coalesce(result->>'role','player')<>'admin' then
   result:=result||jsonb_build_object('gold_event',null,'admin_ball_event',null);
  end if;
  return result;
 end if;
 if auth.uid() is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.'; end if;
 select exists(select 1 from public.players where user_id=auth.uid() and role='admin')
  and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false) into is_admin;
 if auth.uid() is not null and (hours->>'active')::boolean and not is_admin then
  raise sqlstate 'PT503' using message='수면 시간입니다. 오전 6시부터 다시 이용할 수 있습니다.';
 end if;
 return public.wakppu_api_before_sleep(b);
end $api$;
revoke all on function public.wakppu_api(jsonb) from public,anon;
-- Logged-out visitors may read status; all other actions require auth.uid().
grant execute on function public.wakppu_api(jsonb) to anon,authenticated;
commit;
