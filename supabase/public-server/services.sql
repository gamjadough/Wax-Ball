-- Private custom-image storage. Only the authenticated Edge Function writes here.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('wakppu-custom','wakppu-custom',false,1700000,array['image/png']) on conflict(id) do nothing;
create policy wakppu_custom_service_only on storage.objects as restrictive
for all to anon,authenticated using(bucket_id<>'wakppu-custom') with check(bucket_id<>'wakppu-custom');
create extension if not exists pg_cron;
select cron.schedule('wakppu-unplayed-guest-cleanup','*/5 * * * *','select public.wakppu_cleanup_unplayed_guests();');
select cron.schedule('wakppu-weekly-events','* * * * *','select public.wakppu_refresh_weekly_events();');
select cron.schedule('wakppu-monthly-settle','* * * * *','select public.wakppu_monthly_settle();');
select public.wakppu_refresh_weekly_events();
