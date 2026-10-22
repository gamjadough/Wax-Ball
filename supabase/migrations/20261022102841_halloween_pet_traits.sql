begin;
alter table public.wakppu_halloween_cosmetics drop constraint if exists wakppu_halloween_cosmetics_equipped_check;
alter table public.wakppu_halloween_cosmetics add constraint wakppu_halloween_cosmetics_equipped_check check(equipped in ('little_ghost','pumpkin_ember','bat_swarm'));
alter table public.wakppu_halloween_cosmetics add column if not exists pet_gold_remainder smallint not null default 0 check(pet_gold_remainder between 0 and 99);
-- Only earned ownership or the shared signed-in administrator entitlement counts.
create or replace function public.wakppu_equipped_pet(u uuid) returns text language sql stable set search_path=public,pg_temp as $$
 select c.equipped from public.wakppu_halloween_cosmetics c where c.user_id=u and u=auth.uid()
 and (c.owned?c.equipped or public.wakppu_admin_content_access());
$$;
revoke all on function public.wakppu_equipped_pet(uuid) from public,anon,authenticated;
do $rename$ begin
 if to_regprocedure('public.wakppu_supporter_reward_before_pets(uuid,numeric)') is null then
  alter function public.wakppu_supporter_reward(uuid,numeric) rename to wakppu_supporter_reward_before_pets;
 end if;
end $rename$;
revoke all on function public.wakppu_supporter_reward_before_pets(uuid,numeric) from public,anon,authenticated;
-- Pet bonus follows all existing multipliers/supporter bonuses, with its own fractional carry.
create or replace function public.wakppu_supporter_reward(u uuid,base numeric) returns numeric language plpgsql set search_path=public,pg_temp as $$
declare paid numeric; carry integer; parts numeric;
begin
 paid:=public.wakppu_supporter_reward_before_pets(u,base);
 if paid=0 or public.wakppu_equipped_pet(u) is distinct from 'little_ghost' then return paid;end if;
 perform 1 from public.game_states where user_id=u for update;
 select pet_gold_remainder into carry from public.wakppu_halloween_cosmetics where user_id=u for update;
 parts:=paid*10+carry;
 update public.wakppu_halloween_cosmetics set pet_gold_remainder=mod(parts,100)::integer where user_id=u;
 return paid+floor(parts/100);
end $$;
revoke all on function public.wakppu_supporter_reward(uuid,numeric) from public,anon,authenticated;
-- Preserve unrelated API wrappers and make old bat-use clients equip the permanent pet.
do $patch$
declare f record; body text; changed text; matched integer:=0;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prosrc like '%cached public.wakppu_halloween_cosmetic_requests%' loop
  matched:=matched+1;body:=pg_get_functiondef(f.oid);
  changed:=replace(body,$old$id not in ('little_ghost','pumpkin_ember')$old$,$new$id not in ('little_ghost','pumpkin_ember','bat_swarm')$new$);
  if position($guard$c.equipped:='bat_swarm';$guard$ in changed)=0 then
   changed:=replace(changed,$old$reward:=jsonb_build_object('used','bat_swarm');$old$,$new$c.equipped:='bat_swarm';reward:=jsonb_build_object('used','bat_swarm');$new$);
  end if;
  if changed<>body then execute changed;end if;
 end loop;
 if matched<>1 then raise exception 'Expected one cosmetics handler';end if;
end $patch$;
do $snapshot$ begin
 if to_regprocedure('public.wakppu_halloween_cosmetic_snapshot_before_pets(uuid)') is null then
  alter function public.wakppu_halloween_cosmetic_snapshot(uuid) rename to wakppu_halloween_cosmetic_snapshot_before_pets;
 end if;
end $snapshot$;
revoke all on function public.wakppu_halloween_cosmetic_snapshot_before_pets(uuid) from public,anon,authenticated;
create or replace function public.wakppu_halloween_cosmetic_snapshot(u uuid) returns jsonb language sql stable set search_path=public,pg_temp as $$
 select public.wakppu_halloween_cosmetic_snapshot_before_pets(u)||jsonb_build_object('pet_version',1,'catalog',jsonb_build_array(
 jsonb_build_object('id','little_ghost','name','길 잃은 꼬마 유령','kind','equip','weight',1,'effect','골드 +10%'),
 jsonb_build_object('id','pumpkin_ember','name','잭오랜턴의 불씨','kind','equip','weight',1,'effect','파괴 모션 시간 10% 단축'),
 jsonb_build_object('id','bat_swarm','name','꼬마 박쥐','kind','equip','weight',1,'effect','재생성 대기 시간 10% 단축')));
$$;
revoke all on function public.wakppu_halloween_cosmetic_snapshot(uuid) from public,anon,authenticated;
do $api$ begin
 if to_regprocedure('public.wakppu_api_before_pet_traits(jsonb)') is null then alter function public.wakppu_api(jsonb) rename to wakppu_api_before_pet_traits;end if;
end $api$;
revoke all on function public.wakppu_api_before_pet_traits(jsonb) from public,anon,authenticated;
create or replace function public.wakppu_api(b jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;pet text;
begin
 result:=public.wakppu_api_before_pet_traits(b);
 if b->>'action' in ('item_hit','limited_hit','items') then
  pet:=public.wakppu_equipped_pet(auth.uid());
  result:=result||jsonb_build_object('pet_timing',jsonb_build_object('equipped',pet,'animation',case when pet='pumpkin_ember' then 0.9 else 1 end,'respawn',case when pet='bat_swarm' then 0.9 else 1 end));
 end if;
 return result;
end $$;
revoke all on function public.wakppu_api(jsonb) from public,anon,authenticated;
grant execute on function public.wakppu_api(jsonb) to anon,authenticated;
commit;
