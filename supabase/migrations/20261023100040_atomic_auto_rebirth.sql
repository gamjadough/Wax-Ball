-- One network round trip; reuse the full save validation chain, never trust raw Gold.
begin;
do $patch$
declare f record;body text;patched text;matched integer:=0;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosrc like '%enabled_now and cost is not null%' and p.prosrc like '%auto_rebirth_run%' loop
  body:=pg_get_functiondef(f.oid);
  if position('-- atomic-auto-rebirth-progress' in body)=0 then
   patched:=replace(body,'  if enabled_now and cost is not null and s.gold>=cost',
    '  -- atomic-auto-rebirth-progress: stale/replayed requests must never save old rewards.
  if enabled_now and cost is not null and (b->>''rebirths'')::integer=s.rebirths and (b->>''item_revision'')::bigint=s.item_revision and b ? ''progress'' then
   if jsonb_typeof(b->''progress'') is distinct from ''object'' then raise sqlstate ''PT400'';end if;
   perform public.wakppu_api((b->''progress'')||jsonb_build_object(''action'',''save_progress'',''rebirths'',s.rebirths,''item_revision'',s.item_revision));
   select * into s from public.game_states where user_id=u for update;
  end if;
  if enabled_now and cost is not null and s.gold>=cost');
   if patched=body then raise exception 'Unexpected auto rebirth body; refusing partial patch';end if;
   execute patched;
  end if;
  matched:=matched+1;
 end loop;
 if matched<>1 then raise exception 'Expected one auto rebirth wrapper, found %',matched;end if;
end $patch$;
commit;
