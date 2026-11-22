-- PUBLIC PROJECT ONLY. No friends-server progress or rankings are changed.
begin;
create or replace function public.wakppu_supporter_percent(u uuid) returns integer language sql stable set search_path=public,pg_temp as $$select 0$$;
create or replace function public.wakppu_custom_owned(u uuid,t text) returns boolean language sql stable set search_path=public,pg_temp as $$select false$$;
-- Existing audit/order records are retained privately; paid effects and API are unavailable.
create function public.wakppu_public_unpaid(r jsonb) returns jsonb language plpgsql immutable set search_path=public,pg_temp as $$
declare result jsonb;begin
 if jsonb_typeof(r)='object' then
  select coalesce(jsonb_object_agg(key,case when key in ('title','profile_title') and value#>>'{}' in ('왁뿌볼 후원자','프리미엄 후원자') then 'null'::jsonb else public.wakppu_public_unpaid(value) end),'{}') into result
  from jsonb_each(r) where key not in ('supporter','premium_supporter','supporter_percent','supporter_title_visible','custom','auto_rebirth','supporter_glow','premium_celestial');return result;
 elsif jsonb_typeof(r)='array' then
  select coalesce(jsonb_agg(public.wakppu_public_unpaid(value) order by ordinal),'[]') into result from jsonb_array_elements(r) with ordinality a(value,ordinal)
  where (case when jsonb_typeof(value)='string' then value#>>'{}' else coalesce(value->>'id',value->>'card_id','') end) not in ('supporter','premium','supporter_glow','premium_celestial');return result;
 end if;return r;
end$$;
revoke all on function public.wakppu_public_unpaid(jsonb) from public,anon,authenticated;
alter function public.wakppu_monthly_record(uuid) rename to wakppu_monthly_record_before_launch;
create function public.wakppu_monthly_record(u uuid) returns void language plpgsql set search_path=public,pg_temp as $$
begin if public.wakppu_monthly_now()>='2026-12-01 00:00:00+09'::timestamptz then perform public.wakppu_monthly_record_before_launch(u);end if;end$$;
revoke all on function public.wakppu_monthly_record(uuid),public.wakppu_monthly_record_before_launch(uuid) from public,anon,authenticated;
update public.wakppu_profile_cards set equipped='wax_beginning' where equipped in ('supporter_glow','premium_celestial');
update public.wakppu_profile_cards set title_id='auto' where title_id in ('supporter','premium');
-- Remove the pre-launch November competition only. Ordinary game progress remains.
delete from public.wakppu_monthly_rewards where month='2026-11-01';
delete from public.wakppu_monthly_results where month='2026-11-01';
delete from public.wakppu_monthly_clicks where month='2026-11-01';
delete from public.wakppu_monthly_seasons where month='2026-11-01';
alter function public.wakppu_api(jsonb) rename to wakppu_api_before_public_launch;
revoke all on function public.wakppu_api_before_public_launch(jsonb) from public,anon,authenticated;
create function public.wakppu_api(b jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a text:=b->>'action';r jsonb;begin
 if a ~ '^(purchase|admin_purchase|admin_paid|custom|auto_rebirth)(_|$)' then raise sqlstate 'PT403' using message='공개 서버에는 유료 콘텐츠가 없습니다.';end if;
 if a='profile_title' and b->>'title_id' in ('supporter','premium') or a='profile_equip' and b->>'card_id' in ('supporter_glow','premium_celestial') then raise sqlstate 'PT403';end if;
 if a='monthly_rankings' then
  if b ?| array['user_id','target_user_id'] then raise sqlstate 'PT403';end if;
  if b ? 'month' and (jsonb_typeof(b->'month') is distinct from 'string' or b->>'month' !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' or b->>'month'<'2026-12') then raise sqlstate 'PT400' using message='월간 랭킹은 2026년 12월부터 시작합니다.';end if;
  if public.wakppu_monthly_now()<'2026-12-01 00:00:00+09'::timestamptz then
   perform public.wakppu_api_before_public_launch('{"action":"rankings"}');
   return jsonb_build_object('not_started',true,'starts_at','2026-12-01T00:00:00+09:00','server_now',public.wakppu_monthly_now(),'month',null,'seasons','[]'::jsonb,'rows','[]'::jsonb,'me',jsonb_build_object('rank',null,'clicks','0'),'eligible',false);
  end if;
 end if;
 r:=public.wakppu_api_before_public_launch(b);return public.wakppu_public_unpaid(r);
end$$;
revoke all on function public.wakppu_api(jsonb) from public,anon,authenticated;
grant execute on function public.wakppu_api(jsonb) to anon,authenticated,service_role;
commit;
