-- Enable only after the lifecycle migration, browser deployment and verification.
begin;
create extension if not exists pg_cron;
select cron.schedule('wakppu-unplayed-guest-cleanup','*/5 * * * *','select public.wakppu_cleanup_unplayed_guests();');
commit;
