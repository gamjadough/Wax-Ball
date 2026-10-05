-- Apply after rebirth_100_big_gold; extend only the base allowlist and keep all wrappers intact.
begin;
do $migration$
declare source text; updated text; base regprocedure:=to_regprocedure('public.wakppu_api_before_events(jsonb)');
begin
 if base is null then raise exception 'Base API is missing; apply the existing game migrations first'; end if;
 select pg_get_functiondef(base) into source;
 if strpos(source,'''whitehole''')>0 then return; end if;
 updated:=replace(source,'''planet'',''sun'',''blackhole'']','''planet'',''sun'',''blackhole'',''whitehole'']');
 if updated=source then raise exception 'Unexpected base allowlist; whitehole upgrade aborted'; end if;
 execute updated;
end $migration$;
revoke all on function public.wakppu_api_before_events(jsonb) from public,anon,authenticated;
commit;
