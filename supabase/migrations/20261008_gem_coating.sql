-- Prepared for deployment after local review; preserve all existing API wrappers.
begin;
alter table public.game_states add column if not exists coating_expires_at timestamptz;
do $migration$
declare source text; updated text; fn record;
begin
 if to_regprocedure('public.wakppu_api_before_events(jsonb)') is null then raise exception 'Existing base API is required'; end if;
 select pg_get_functiondef('public.wakppu_api_before_events(jsonb)'::regprocedure) into source;
 if strpos(source,'coating_expires_at=(b->>')=0 then
  updated:=replace(source,'honey_expires_at=(b->>''honey_expires_at'')::timestamptz,','honey_expires_at=(b->>''honey_expires_at'')::timestamptz,coating_expires_at=(b->>''coating_expires_at'')::timestamptz,');
  if updated=source then raise exception 'Unexpected base save definition'; end if;
  execute updated;
 end if;
 if to_regclass('public.wakppu_event_ball_progress') is not null then
  alter table public.wakppu_event_ball_progress drop constraint if exists wakppu_event_ball_progress_clicks_check;
  alter table public.wakppu_event_ball_progress add constraint wakppu_event_ball_progress_clicks_check check(clicks between 0 and 1199);
 end if;
 for fn in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'wakppu_api%' and p.prokind='f' and p.prosrc like '%hits:=least(600,p.clicks+damage)%' loop
  select pg_get_functiondef(fn.oid) into source;
  updated:=replace(source,'hits integer; damage integer;','hits integer; total integer; damage integer;');
  updated:=replace(updated,'hits:=least(600,p.clicks+damage);','total:=case when s.coating_expires_at>instant then 1200 else 600 end; hits:=least(total,p.clicks+damage);');
  updated:=replace(updated,'if hits=600 then','if hits=total then');
  updated:=replace(updated,'*multiplier);','*multiplier*(case when s.coating_expires_at>instant then 3 else 1 end));');
  updated:=replace(updated,'''clicks'',hits,''reward''','''clicks'',hits,''required_clicks'',total,''reward''');
  updated:=replace(updated,'case when hits=600 then 0 else hits end','case when hits=total then 0 else hits end');
  if strpos(updated,'total integer;')=0 or strpos(updated,'*multiplier*(case when s.coating_expires_at>instant then 3 else 1 end)')=0 then raise exception 'Unexpected event definition'; end if;
  execute updated;
 end loop;
end $migration$;
commit;
