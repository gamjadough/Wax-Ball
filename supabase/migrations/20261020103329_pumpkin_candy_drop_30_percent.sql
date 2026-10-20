-- Add pumpkin-only drops inside the existing locked/idempotent limited API.
-- Ordinary balls retain 10%; outer moderation/presence/supporter wrappers are preserved.
begin;
create or replace function public.wakppu_pumpkin_candy_roll() returns double precision
language sql volatile security invoker set search_path=pg_catalog as $$
 select (('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint)/4294967296.0
$$;
revoke all on function public.wakppu_pumpkin_candy_roll() from public,anon,authenticated;
do $migration$
declare f record;body text;patched integer:=0;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prokind='f' and p.proname like 'wakppu_api%' loop
  body:=pg_get_functiondef(f.oid);
  if position('elsif a=''limited_hit'' then' in body)=0 then continue;end if;
  if position('-- pumpkin_candy_drop_v1' in body)=0 then
   if position('  if hits=total_hits then' in body)=0 then raise exception 'Unexpected limited hit definition';end if;
   body:=replace(body,'  if hits=total_hits then',E'  if hits=total_hits then\n   -- pumpkin_candy_drop_v1\n   if active and l.selected=''halloween-pumpkin-2026'' and public.wakppu_pumpkin_candy_roll()<0.3 then l.tokens:=l.tokens+1;dropped:=true;end if;');
  end if;
  body:=replace(body,'''dropChance'',0.1,''cost''','''dropChance'',0.1,''pumpkinDropChance'',0.3,''cost''');
  if position('public.wakppu_pumpkin_candy_roll()<0.3' in body)=0 or position('''pumpkinDropChance'',0.3' in body)=0 then raise exception 'Pumpkin drop verification failed';end if;
  execute body;patched:=patched+1;
 end loop;
 if patched<>1 then raise exception 'Expected one limited API, found %',patched;end if;
end $migration$;
commit;
