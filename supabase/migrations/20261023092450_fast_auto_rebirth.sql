-- Preserve the existing entitlement, reset, lock and revision checks; add an atomic response.
begin;
do $patch$
declare f record;body text;patched text;matched integer:=0;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosrc like '%enabled_now and cost is not null%' and p.prosrc like '%auto_rebirth_run%' loop
  body:=pg_get_functiondef(f.oid);
  if position('-- fast-auto-rebirth-snapshot' in body)=0 then
   patched:=replace(body,'return jsonb_build_object(''performed'',done);',
    '-- fast-auto-rebirth-snapshot: no client-side bootstrap/items round trip.
   select * into s from public.game_states where user_id=u;
   return jsonb_build_object(''performed'',done,''progress'',to_jsonb(s)||jsonb_build_object(''gold'',s.gold::text),''items'',public.wakppu_api(''{"action":"items"}''::jsonb));');
   if patched=body then raise exception 'Unexpected auto rebirth response; refusing partial patch';end if;
   execute patched;
  end if;
  matched:=matched+1;
 end loop;
 if matched<>1 then raise exception 'Expected one auto rebirth wrapper, found %',matched;end if;
end $patch$;
commit;
