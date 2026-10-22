begin;
-- Admin access is virtual: removing the role preserves only earned cosmetics.
create or replace function public.wakppu_halloween_cosmetic_snapshot(u uuid) returns jsonb language sql stable set search_path=public,pg_temp as $$
 select jsonb_build_object('owned',c.effective_owned,'admin_content_access',c.admin_access,'equipped',case when c.effective_owned?c.equipped then c.equipped else null end,'shards',c.shards::text,'opened',c.opened::text,'decor_revision',c.revision,
 'tokens',coalesce(l.tokens,0)::text,'gold',g.gold::text,'revision',g.item_revision,'price','100','exchange_cost','3',
 'active',coalesce((select clock_timestamp()>=starts_at and clock_timestamp()<ends_at from public.wakppu_limited_settings ls where ls.id=true),false),
 'catalog',jsonb_build_array(
 jsonb_build_object('id','little_ghost','name','길 잃은 꼬마 유령','kind','equip','weight',1),
 jsonb_build_object('id','pumpkin_ember','name','잭오랜턴의 불씨','kind','equip','weight',1),
 jsonb_build_object('id','bat_swarm','name','박쥐 무리','kind','use','weight',1)))
 from (select raw.*, raw.owned || case when u=auth.uid() and public.wakppu_admin_content_access() then '{"little_ghost":true,"pumpkin_ember":true,"bat_swarm":true}'::jsonb else '{}'::jsonb end effective_owned, coalesce(u=auth.uid() and public.wakppu_admin_content_access(),false) admin_access from public.wakppu_halloween_cosmetics raw) c join public.game_states g on g.user_id=c.user_id
 left join public.wakppu_limited_players l on l.user_id=c.user_id where c.user_id=u;
$$;
revoke all on function public.wakppu_halloween_cosmetic_snapshot(uuid) from public,anon,authenticated;
-- Preserve the existing API wrapper chain, including concurrently added handlers.
do $patch$
declare target regprocedure; definition text; changed text; matches integer;
begin
 select count(*),min(p.oid::bigint)::oid::regprocedure into matches,target from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prosrc like '%cached public.wakppu_halloween_cosmetic_requests%';
 if matches<>1 then raise exception 'Expected exactly one Halloween cosmetics handler, found %',matches;end if;
 definition:=pg_get_functiondef(target);
 changed:=replace(definition,'or not(c.owned?id)','or (not(c.owned?id) and not public.wakppu_admin_content_access())');
 if changed=definition and position('and not public.wakppu_admin_content_access()' in definition)=0 then raise exception 'Cosmetics ownership guard was not found';end if;
 if changed<>definition then execute changed;end if;
end $patch$;
commit;
