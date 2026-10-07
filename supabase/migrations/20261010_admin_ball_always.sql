-- Local review first. Administrators use a private, persistent progress namespace.
begin;
do $migration$
declare source text; updated text;
begin
 source:=pg_get_functiondef('public.wakppu_api(jsonb)'::regprocedure);
 if position('admin-always' in source)=0 then
  updated:=replace(source,
   'if settings.maintenance or e is null or e->>''id'' is distinct from b->>''event_id''',
   'select role into role_name from players where user_id=u;
  if b->>''event_id''=''admin-always'' and role_name=''admin'' and not coalesce((auth.jwt()->>''is_anonymous'')::boolean,false) then
   e:=jsonb_build_object(''id'',''admin-always'',''starts_at'',instant-interval ''1 second'',''ends_at'',instant+interval ''1 second'');
  end if;
  if (settings.maintenance and e->>''id'' is distinct from ''admin-always'') or e is null or e->>''id'' is distinct from b->>''event_id''');
  if updated=source then raise exception 'Unexpected administrator ball hit validation'; end if;
  source:=updated;
  updated:=replace(source,
   'delete from wakppu_event_ball_progress where event_id is distinct from e->>''id'';',
   'delete from wakppu_event_ball_progress where event_id<>''admin-always'' and event_id is distinct from e->>''id'';');
  if updated=source then raise exception 'Apply administrator cleanup WHERE fix first'; end if;
  source:=updated;
  updated:=replace(source,
   'jsonb_build_object(''admin_ball_event'',case when settings.maintenance then null else settings.admin_ball_event end)',
   'jsonb_build_object(''admin_ball_event'',case when settings.maintenance then null else settings.admin_ball_event end,''admin_ball_always'',exists(select 1 from players where user_id=auth.uid() and role=''admin'') and not coalesce((auth.jwt()->>''is_anonymous'')::boolean,false))');
  if updated=source then raise exception 'Unexpected administrator event status'; end if;
  execute updated;
 end if;
end $migration$;
commit;
