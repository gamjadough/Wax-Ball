-- Move only Friday evening to 21:30 KST. Preserve enable/skip state and manual events.
-- Some legacy migrations have future-dated names. On a fresh database this patch
-- can precede the weekly table; its creation migration also seeds 21:30.
begin;
do $schedule$
begin
 if to_regclass('public.wakppu_weekly_events') is null then return;end if;
 update public.wakppu_weekly_events set local_time=time '21:30'
 where id='friday-evening';
 if not found then raise exception 'Friday evening recurring schedule is missing';end if;
 if to_regprocedure('public.wakppu_refresh_weekly_events(timestamptz)') is not null then
  perform public.wakppu_refresh_weekly_events(clock_timestamp());
 end if;
end $schedule$;
commit;
