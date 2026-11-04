begin;
-- Copy the existing evening configuration. Re-running must not undo later admin changes.
insert into public.wakppu_weekly_events(id,weekday,local_time,ball_seconds,gold_seconds,multiplier,enabled)
select 'tuesday-evening',2,'21:30:00'::time,ball_seconds,gold_seconds,multiplier,enabled
from public.wakppu_weekly_events where id='friday-evening'
on conflict(id) do nothing;
do $check$ begin
 if not exists(select 1 from public.wakppu_weekly_events where id='tuesday-evening') then
  raise exception 'Missing existing evening event configuration';
 end if;
end $check$;
select public.wakppu_refresh_weekly_events();
commit;
