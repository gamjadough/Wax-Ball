-- Keep Supabase's safeupdate protection enabled and clean up only obsolete events.
-- Patch the installed wrapper without replacing later hammer or reward changes.
begin;
do $$
declare definition text;
begin
 definition:=pg_get_functiondef('public.wakppu_api(jsonb)'::regprocedure);
 if position('delete from wakppu_event_ball_progress;' in definition)>0 then
  execute replace(definition,'delete from wakppu_event_ball_progress;',
   'delete from wakppu_event_ball_progress where event_id is distinct from e->>''id'';');
 elsif position('delete from wakppu_event_ball_progress where event_id is distinct from e->>''id'';' in definition)=0 then
  raise exception 'Administrator event cleanup function does not match the expected version';
 end if;
end $$;
commit;
