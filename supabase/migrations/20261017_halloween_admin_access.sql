-- Patch the limited API in place, preserving newer presence/item wrappers.
begin;
create or replace function public.wakppu_limited_admin() returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.players where user_id=auth.uid() and role='admin')
 and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
$$;
revoke all on function public.wakppu_limited_admin() from public,anon,authenticated;
do $migration$
declare f record; body text; patched integer:=0;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname like 'wakppu_api%' and p.prokind='f' loop
  body:=pg_get_functiondef(f.oid);
  if position('if a not in (''limited'',''limited_buy'',''limited_select'',''limited_hit'',''item_hit'')' in body)=0 then continue;end if;
  body:=replace(body,'and not l.owned ? (b->>''ball_id''))','and not l.owned ? (b->>''ball_id'') and not (public.wakppu_limited_admin() and b->>''ball_id''=''halloween-pumpkin-2026''))');
  body:=replace(body,'if l.selected is null or not l.owned ? l.selected then','if l.selected is null or (not l.owned ? l.selected and not (public.wakppu_limited_admin() and l.selected=''halloween-pumpkin-2026'')) then');
  body:=replace(body,'info:=jsonb_build_object(''season'',','info:=jsonb_build_object(''admin_access'',public.wakppu_limited_admin(),''season'',');
  body:=replace(body,'''selected'',l.selected,','''selected'',case when l.owned ? l.selected or (public.wakppu_limited_admin() and l.selected=''halloween-pumpkin-2026'') then l.selected else null end,');
  if position('''admin_access'',public.wakppu_limited_admin()' in body)=0 or position('and b->>''ball_id''=''halloween-pumpkin-2026''' in body)=0 or position('and l.selected=''halloween-pumpkin-2026'')) then' in body)=0 then
   raise exception 'Unexpected limited API definition: %',f.oid::regprocedure;
  end if;
  execute body;patched:=patched+1;
 end loop;
 if patched<>1 then raise exception 'Expected one limited API, found %',patched;end if;
end $migration$;
commit;
