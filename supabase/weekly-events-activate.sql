-- Operator-only activation, after applying the tested weekly migration.
-- No user roles/credentials or existing manual events are changed.
begin;
do $activate$
declare actor uuid;
begin
 select u.id into actor from auth.users u join public.players p on p.user_id=u.id
  where lower(u.email)='dodoonglee@gmail.com' and p.role='admin' and not coalesce(u.is_anonymous,false);
 if actor is null then raise exception 'Existing authorized developer account is required';end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'is_anonymous',false)::text,true);
 perform public.wakppu_api('{"action":"admin_weekly_events","mode":"enable"}');
end $activate$;
commit;
select id,weekday,local_time,ball_seconds,gold_seconds,multiplier,enabled from public.wakppu_weekly_events order by local_time;
select jobname,schedule,command,active from cron.job where jobname='wakppu-weekly-events';
