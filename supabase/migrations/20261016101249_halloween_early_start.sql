-- Bring this season forward to October 17 00:00 KST; preserve the configured end and player data.
begin;
do $migration$ begin
 if not exists(select 1 from public.wakppu_limited_settings where id=true) then raise exception 'Halloween settings missing';end if;
end $migration$;
update public.wakppu_limited_settings set starts_at='2026-10-16T15:00:00Z' where id=true;
commit;
