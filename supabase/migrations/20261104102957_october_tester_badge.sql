-- October trial souvenir: any recorded accepted manual click qualifies.
-- Reuse the existing permanent badge entitlement and equip API; no stat bonus.
begin;
insert into public.wakppu_monthly_rewards(user_id,month,kind)
 select user_id,month,'participant' from public.wakppu_monthly_clicks
 where month=date '2026-10-01' and clicks>0
 on conflict(user_id,month,kind) do nothing;

create or replace function public.wakppu_monthly_badge_state(u uuid) returns jsonb
language sql stable set search_path=public,pg_temp as $$
 select jsonb_build_object('badge_catalog',coalesce((select jsonb_agg(jsonb_build_object(
  'id','monthly_'||to_char(month,'YYYYMM')||'_participant',
  'name',case when month=date '2026-10-01' then '2026년 10월 테스터 배지' else to_char(month,'YYYY년 MM월')||' 참여 배지' end) order by month desc)
  from public.wakppu_monthly_rewards where user_id=u and kind='participant'),'[]'),
  'badge_equipped',c.monthly_badge,'monthly_badge',(select
   case when r.month=date '2026-10-01' then '2026년 10월 테스터 배지' else to_char(r.month,'YYYY년 MM월')||' 참여 배지' end
   from public.wakppu_monthly_rewards r where r.user_id=u and r.kind='participant'
   and c.monthly_badge='monthly_'||to_char(r.month,'YYYYMM')||'_participant'))
 from (select (select monthly_badge from public.wakppu_profile_cards where user_id=u) monthly_badge)c;
$$;
revoke all on function public.wakppu_monthly_badge_state(uuid) from public,anon,authenticated;
commit;
