-- Repair existing deployments whose original moderation schema excludes permanent bans.
begin;
alter table public.moderation_cases drop constraint if exists moderation_cases_status_check;
alter table public.moderation_cases add constraint moderation_cases_status_check check (status in ('active','review','suspended','banned'));
commit;
