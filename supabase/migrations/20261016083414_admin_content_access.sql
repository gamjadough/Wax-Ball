-- Apply after the existing item, limited, sleep and weekly wrappers.
begin;
create or replace function public.wakppu_admin_content_access() returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select auth.uid() is not null
 and exists(select 1 from public.players where user_id=auth.uid() and role='admin')
 and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
$$;
revoke all on function public.wakppu_admin_content_access() from public,anon,authenticated;
-- Retain item transaction, request cache, duration and revision validation.
do $patch$
declare f record; body text; patched integer:=0;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname like 'wakppu_api%' and p.prokind='f' loop
  body:=pg_get_functiondef(f.oid);
  if position('select * into d from public.wakppu_item_defs where item_id=b->>''item_id''' in body)=0 then continue;end if;
  body:=replace(body,'if not found or coalesce((inv.inventory->>d.item_id)::bigint,0)<=0 then',
   'if not found or (not public.wakppu_admin_content_access() and coalesce((inv.inventory->>d.item_id)::bigint,0)<=0) then');
  body:=replace(body,'  inv.inventory:=jsonb_set(inv.inventory,array[d.item_id],to_jsonb((inv.inventory->>d.item_id)::bigint-1));',
   '  if not public.wakppu_admin_content_access() then inv.inventory:=jsonb_set(inv.inventory,array[d.item_id],to_jsonb((inv.inventory->>d.item_id)::bigint-1));end if;');
  if position('not public.wakppu_admin_content_access() and coalesce' in body)=0 or position('if not public.wakppu_admin_content_access() then inv.inventory:=' in body)=0 then raise exception 'Unexpected item API: %',f.oid::regprocedure;end if;
  execute body;patched:=patched+1;
 end loop;
 if patched<>1 then raise exception 'Expected one item API, found %',patched;end if;
end $patch$;
do $wrap$ begin
 if to_regprocedure('public.wakppu_api_before_admin_content(jsonb)') is null then
  alter function public.wakppu_api(jsonb) rename to wakppu_api_before_admin_content;
 end if;
end $wrap$;
revoke all on function public.wakppu_api_before_admin_content(jsonb) from public,anon,authenticated;
create or replace function public.wakppu_api(b jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $api$
declare result jsonb; s public.game_states%rowtype; access boolean; catalog jsonb; unlocked jsonb; discovered jsonb; virtual_inventory jsonb;
begin
 -- Delegate first: preserve authentication, maintenance, sleep and ban rules.
 result:=public.wakppu_api_before_admin_content(b);
 access:=public.wakppu_admin_content_access();
 if not access then return result;end if;
 if b->>'action' in ('bootstrap','save_progress') then
  select coalesce(jsonb_agg(ball_id order by ball_id),'[]') into catalog from public.wakppu_item_balls;
  select * into s from public.game_states where user_id=auth.uid() for update;
  select jsonb_agg(id order by id) into unlocked from (select distinct value as id from jsonb_array_elements(s.unlocked_ball_ids||catalog)) q;
  select jsonb_agg(id order by id) into discovered from (select distinct value as id from jsonb_array_elements(s.discovered_ball_ids||catalog)) q;
  update public.game_states set unlocked_ball_ids=unlocked,discovered_ball_ids=discovered
   where user_id=auth.uid() and (unlocked_ball_ids is distinct from unlocked or discovered_ball_ids is distinct from discovered);
  if result ? 'state' then result:=jsonb_set(result,'{state}',result->'state'||jsonb_build_object('unlocked_ball_ids',unlocked,'discovered_ball_ids',discovered));end if;
 end if;
 if result ? 'inventory' then
  select coalesce(jsonb_object_agg(item_id,greatest(1,coalesce((result->'inventory'->>item_id)::bigint,0))),'{}') into virtual_inventory from public.wakppu_item_defs;
  result:=result||jsonb_build_object('inventory',result->'inventory'||virtual_inventory,'admin_content_access',true);
 end if;
 return result;
end $api$;
revoke all on function public.wakppu_api(jsonb) from public;
grant execute on function public.wakppu_api(jsonb) to anon,authenticated;
commit;
