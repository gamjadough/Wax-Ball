-- Patch the final reward before Gold and idempotency responses are persisted.
-- Existing auth, bans, revisions, item consumption and request caches stay intact.
begin;
do $patch$
declare f record;body text;updated text;formula text;matched integer:=0;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname like 'wakppu_api%' and p.prokind='f' loop
  body:=pg_get_functiondef(f.oid);updated:=body;
  foreach formula in array array[
   'floor(base_reward*power(2::numeric,s.rebirths)*honey*bonus*multiplier)',
   'floor(1500000000::numeric*power(2::numeric,s.rebirths)*honey*bonus*multiplier)',
   'trunc(best*10*power(2::numeric,s.rebirths)*(case when s.honey_expires_at>instant then 2 else 1 end)*multiplier*(case when s.coating_expires_at>instant then 3 else 1 end))'
  ] loop
   if position('public.wakppu_supporter_reward(u,'||formula||')' in body)>0 then matched:=matched+1;
   elsif position(':='||formula||';' in body)>0 then
    updated:=replace(updated,':='||formula||';',':=public.wakppu_supporter_reward(u,'||formula||');');matched:=matched+1;
   end if;
  end loop;
  if updated<>body then execute updated;end if;
 end loop;
 if matched<>3 then raise exception 'Expected three final reward paths, found %',matched;end if;
end $patch$;
commit;
