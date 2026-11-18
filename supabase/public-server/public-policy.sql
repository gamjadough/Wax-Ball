-- Public-server-only policy, applied after the fresh baseline.
alter function public.wakppu_state_json(public.game_states) set search_path=public,pg_temp;
create or replace function public.wakppu_limited_admin() returns boolean
language sql stable set search_path=public,pg_temp as $$select false$$;
create or replace function public.wakppu_equipped_pet(u uuid) returns text
language sql stable set search_path=public,pg_temp as $$select null::text$$;
create or replace function public.wakppu_halloween_goods_expiry(u uuid) returns jsonb
language sql stable set search_path=public,pg_temp as $$select '{}'::jsonb$$;
create or replace function public.wakppu_custom_known(t text) returns boolean
language sql stable set search_path=public,pg_temp as $$
select coalesce(exists(select 1 from public.wakppu_item_balls where ball_id=t) or t='admin-event',false)$$;
create or replace function public.wakppu_custom_preset(u uuid,t text) returns boolean
language sql stable set search_path=public,pg_temp as $$
select public.wakppu_custom_known(t) or (t like 'skin:%'
and exists(select 1 from public.wakppu_skin_defs d where d.skin_id='eternity_'||substr(t,6))
and (public.wakppu_admin_content_access() or exists(select 1 from public.wakppu_skins where user_id=u and owned?('eternity_'||substr(t,6)))))$$;
create or replace function public.wakppu_profile_title_state(u uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
select public.wakppu_profile_title_before_halloween_goods(u)$$;
create or replace function public.wakppu_halloween_cosmetic_snapshot(u uuid) returns jsonb
language sql stable set search_path=public,pg_temp as $$
select '{"owned":{},"equipped":null,"catalog":[],"admin_content_access":false,"active":false,"shards":"0","opened":"0","decor_revision":0}'::jsonb$$;
create or replace function public.wakppu_api(b jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare a text:=b->>'action';r jsonb;
begin
 if a ~ '^(limited|pumpkin|halloween|ember_auto)(_|$)' or a='admin_limited' then
  raise sqlstate 'PT403' using message='공개 서버에서는 할로윈 콘텐츠를 이용할 수 없습니다.';
 end if;
 if a='admin_background' and b->>'mode' is distinct from 'default' then
  raise sqlstate 'PT403' using message='공개 서버는 기본 배경을 사용합니다.';
 end if;
 if a='profile_title' and b->>'title_id' like 'halloween_%' then raise sqlstate 'PT403';end if;
 r:=public.wakppu_public_base_api(b);
 if jsonb_typeof(r)='object' then
  r:=r-'limited'-'halloween_goods'-'pet_timing'-'candy_drop';
  if r?'background_mode' then r:=r||'{"background_mode":"default"}';end if;
 end if;
 return r;
end$$;
-- Every helper is private. Only the authenticated RPC entry and two service
-- operations used by the image function may execute from outside Postgres.
revoke all on all functions in schema public from public,anon,authenticated;
grant execute on function public.wakppu_api(jsonb) to anon,authenticated,service_role;
grant execute on function public.wakppu_custom_commit(uuid,jsonb) to service_role;
grant execute on function public.wakppu_custom_gc_batch(text[]) to service_role;
-- Future functions remain private unless explicitly exposed.
alter default privileges in schema public revoke execute on functions from public;
update public.wakppu_purchase_config set enabled=false;
update public.server_settings set background_mode='default';
