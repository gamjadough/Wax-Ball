-- Accepted manual hits only. All counts, snapshots and awards are server-owned.
begin;
create table public.wakppu_monthly_seasons(
 month date primary key check(extract(day from month)=1 and month>='2026-10-01'),
 finalized_at timestamptz
);
create table public.wakppu_monthly_clicks(
 month date not null references public.wakppu_monthly_seasons(month),
 user_id uuid not null references public.players(user_id) on delete cascade,
 clicks bigint not null check(clicks>0),reached_at timestamptz not null,
 primary key(month,user_id)
);
create index wakppu_monthly_clicks_rank_idx on public.wakppu_monthly_clicks(month,clicks desc,reached_at,user_id);
create index wakppu_monthly_clicks_user_idx on public.wakppu_monthly_clicks(user_id,month);
create table public.wakppu_monthly_results(
 month date not null references public.wakppu_monthly_seasons(month),
 user_id uuid not null references public.players(user_id) on delete cascade,
 rank bigint not null,clicks bigint not null,nickname text not null,
 primary key(month,user_id),unique(month,rank)
);
create index wakppu_monthly_results_user_idx on public.wakppu_monthly_results(user_id,month);
create table public.wakppu_monthly_rewards(
 user_id uuid not null references public.players(user_id) on delete cascade,
 month date not null references public.wakppu_monthly_seasons(month),
 kind text not null check(kind in ('champion','top10','participant')),
 primary key(user_id,month,kind)
);
alter table public.wakppu_monthly_seasons enable row level security;
alter table public.wakppu_monthly_clicks enable row level security;
alter table public.wakppu_monthly_results enable row level security;
alter table public.wakppu_monthly_rewards enable row level security;
revoke all on public.wakppu_monthly_seasons,public.wakppu_monthly_clicks,public.wakppu_monthly_results,public.wakppu_monthly_rewards from public,anon,authenticated;
alter table public.wakppu_profile_cards add column monthly_badge text;
alter table public.wakppu_profile_cards drop constraint wakppu_profile_cards_title_id_check;
alter table public.wakppu_profile_cards add constraint wakppu_profile_cards_title_id_check
 check(title_id in ('auto','none','supporter','premium','champion') or title_id ~ '^monthly_[0-9]{6}_(champion|top10)$');
alter table public.wakppu_profile_card_defs drop constraint wakppu_profile_card_defs_image_check;
alter table public.wakppu_profile_card_defs add constraint wakppu_profile_card_defs_image_check
 check(image ~ '^images/profile-cards/[a-z0-9-]+\.(png|webp|svg)$');

create function public.wakppu_monthly_now() returns timestamptz language sql volatile set search_path=public,pg_temp as $$select clock_timestamp()$$;
create function public.wakppu_monthly_eligible(u uuid) returns boolean language sql stable set search_path=public,pg_temp as $$
 select exists(select 1 from public.players p where p.user_id=u and p.role<>'admin' and not p.ranking_hidden
 and not exists(select 1 from public.moderation_cases m where m.user_id=u and (m.status='banned' or (m.status='suspended' and (m.suspended_until is null or m.suspended_until>statement_timestamp()))))
 and not exists(select 1 from public.wakppu_guest_accounts() g where g.id=u and g.eligible and g.hide_at<=statement_timestamp()));
$$;
create function public.wakppu_monthly_record(u uuid) returns void language plpgsql set search_path=public,pg_temp as $$
declare instant timestamptz:=public.wakppu_monthly_now();m date:=(instant at time zone 'Asia/Seoul')::date;done timestamptz;
begin
 if not public.wakppu_monthly_eligible(u) then return;end if;
 m:=date_trunc('month',m)::date;if m<'2026-10-01' then return;end if;
 insert into public.wakppu_monthly_seasons(month) values(m) on conflict do nothing;
 -- Concurrent players share this lock; settlement takes an exclusive season lock.
 select finalized_at into done from public.wakppu_monthly_seasons where month=m for share;
 if done is not null then return;end if;
 insert into public.wakppu_monthly_clicks values(m,u,1,instant)
 on conflict(month,user_id) do update set clicks=wakppu_monthly_clicks.clicks+1,reached_at=excluded.reached_at;
end $$;

create function public.wakppu_monthly_settle() returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare s record;m date:=date_trunc('month',public.wakppu_monthly_now() at time zone 'Asia/Seoul')::date;key text;label text;
begin
 for s in select month from public.wakppu_monthly_seasons where month<m and finalized_at is null order by month for update skip locked loop
  insert into public.wakppu_monthly_results(month,user_id,rank,clicks,nickname)
   select s.month,c.user_id,row_number() over(order by c.clicks desc,c.reached_at,c.user_id),c.clicks,p.nickname
   from public.wakppu_monthly_clicks c join public.players p using(user_id)
   where c.month=s.month and public.wakppu_monthly_eligible(c.user_id);
  -- October is a short, explicitly labelled trial. Formal rewards start November.
  if s.month>='2026-11-01' then
   key:=to_char(s.month,'YYYYMM');label:=to_char(s.month,'YYYY년 MM월');
   insert into public.wakppu_profile_card_defs(card_id,name,rarity,free,image) values
    ('monthly_'||key||'_gold',label||' 클릭왕','월간 1위',false,'images/profile-cards/monthly-gold.svg'),
    ('monthly_'||key||'_silver',label||' 은빛 도전자','월간 2위',false,'images/profile-cards/monthly-silver.svg'),
    ('monthly_'||key||'_bronze',label||' 동빛 도전자','월간 3위',false,'images/profile-cards/monthly-bronze.svg');
   insert into public.wakppu_profile_card_grants(user_id,card_id)
    select user_id,'monthly_'||key||case rank when 1 then '_gold' when 2 then '_silver' else '_bronze' end
    from public.wakppu_monthly_results where month=s.month and rank<=3 on conflict do nothing;
   insert into public.wakppu_monthly_rewards
    select user_id,s.month,'champion' from public.wakppu_monthly_results where month=s.month and rank=1 on conflict do nothing;
   insert into public.wakppu_monthly_rewards
    select user_id,s.month,'top10' from public.wakppu_monthly_results where month=s.month and rank<=10 on conflict do nothing;
   insert into public.wakppu_monthly_rewards
    select user_id,s.month,'participant' from public.wakppu_monthly_results where month=s.month and clicks>=1000 on conflict do nothing;
  end if;
  update public.wakppu_monthly_seasons set finalized_at=public.wakppu_monthly_now() where month=s.month;
 end loop;
end $$;

create function public.wakppu_monthly_badge_state(u uuid) returns jsonb language sql stable set search_path=public,pg_temp as $$
 select jsonb_build_object('badge_catalog',coalesce((select jsonb_agg(jsonb_build_object('id','monthly_'||to_char(month,'YYYYMM')||'_participant','name',to_char(month,'YYYY년 MM월')||' 참여 배지') order by month desc)
 from public.wakppu_monthly_rewards where user_id=u and kind='participant'),'[]'),
 'badge_equipped',c.monthly_badge,'monthly_badge',(select to_char(r.month,'YYYY년 MM월')||' 참여 배지' from public.wakppu_monthly_rewards r
 where r.user_id=u and r.kind='participant' and c.monthly_badge='monthly_'||to_char(r.month,'YYYYMM')||'_participant'))
 from (select (select monthly_badge from public.wakppu_profile_cards where user_id=u) monthly_badge)c;
$$;
alter function public.wakppu_profile_title_state(uuid) rename to wakppu_profile_title_before_monthly;
create function public.wakppu_profile_title_state(u uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare base jsonb:=public.wakppu_profile_title_before_monthly(u);catalog jsonb;choice text;label text;visible boolean;
begin
 select coalesce(jsonb_agg(jsonb_build_object('id','monthly_'||to_char(month,'YYYYMM')||'_'||kind,'name',to_char(month,'YYYY년 MM월')||case kind when 'champion' then ' 클릭왕' else ' 클릭 TOP 10' end) order by month desc,kind),'[]')
 into catalog from public.wakppu_monthly_rewards where user_id=u and kind in ('champion','top10');
 select title_id into choice from public.wakppu_profile_cards where user_id=u;
 select title_visible into visible from public.wakppu_purchase_cosmetics where user_id=u;
 if visible is distinct from false then select c->>'name' into label from jsonb_array_elements(catalog)c where c->>'id'=choice;end if;
 return base||jsonb_build_object('title_catalog',(base->'title_catalog')||catalog)||case when label is not null then jsonb_build_object('title_equipped',choice,'title',label) else '{}'::jsonb end;
end $$;
-- Monthly competition has no administrator ownership bypass.
create or replace function public.wakppu_profile_card_available(u uuid,c text) returns boolean language sql stable set search_path=public,pg_temp as $$
 select exists(select 1 from public.wakppu_profile_card_defs d where d.card_id=c and (
 d.free or
 (c not like 'monthly\_%' escape '\' and case when u=auth.uid() then public.wakppu_admin_content_access() else exists(select 1 from public.players p join auth.users a on a.id=p.user_id where p.user_id=u and p.role='admin' and not coalesce(a.is_anonymous,false)) end) or
 (c not in ('supporter_glow','premium_celestial') and exists(select 1 from public.wakppu_profile_card_grants g where g.user_id=u and g.card_id=c)) or
 (c='supporter_glow' and exists(select 1 from public.wakppu_purchase_entitlements e where e.user_id=u and e.product_id in ('supporter_pack','premium_supporter_pack'))) or
 (c='premium_celestial' and exists(select 1 from public.wakppu_purchase_entitlements e where e.user_id=u and e.product_id='premium_supporter_pack'))));
$$;

-- Patch the accepted-hit path AFTER its shared lock, replay check and original hit.
-- Internal ember provenance is set only by the existing validating outer wrapper.
do $patch$
declare f record;body text;changed text;n integer:=0;
begin
 for f in select p.oid from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.prosrc like '%g.hits||%' and p.prosrc like '%tokens=g.tokens-1%' loop
  body:=pg_get_functiondef(f.oid);
  changed:=replace(body,'update public.wakppu_input_guard set tokens=g.tokens-1',
   'if b->>''hit_source'' is distinct from ''ember_auto'' then perform public.wakppu_monthly_record(u);end if; update public.wakppu_input_guard set tokens=g.tokens-1');
  if changed=body then raise exception 'Unexpected accepted hit implementation';end if;
  execute changed;n:=n+1;
 end loop;
 if n<>1 then raise exception 'Expected one accepted hit hook, found %',n;end if;
 -- Monthly participants can open profiles even outside the overall top 100.
 n:=0;
 for f in select p.oid from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.prosrc like '%into catalog,owned from wakppu_profile_card_defs%' loop
  body:=pg_get_functiondef(f.oid);
  changed:=replace(body,'(entry is null and target<>actor)',
   '(entry is null and target<>actor and not (public.wakppu_monthly_eligible(target) and exists(select 1 from public.wakppu_monthly_clicks c where c.user_id=target)))');
  if changed=body then raise exception 'Unexpected public profile guard';end if;
  execute changed;n:=n+1;
 end loop;
 if n<>1 then raise exception 'Expected one profile guard';end if;
end $patch$;

create function public.wakppu_monthly_snapshot(u uuid,m date) returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare rows jsonb;me jsonb;done timestamptz;instant timestamptz:=public.wakppu_monthly_now();current_month date:=date_trunc('month',instant at time zone 'Asia/Seoul')::date;periods jsonb;
begin
 if m<'2026-10-01' or m>current_month then raise sqlstate 'PT400' using message='집계 가능한 월을 선택해주세요.';end if;
 select finalized_at into done from public.wakppu_monthly_seasons where month=m;
 with ranked as (
  select c.user_id,p.nickname,c.clicks,row_number() over(order by c.clicks desc,c.reached_at,c.user_id) rank
  from public.wakppu_monthly_clicks c join public.players p using(user_id) where c.month=m and done is null and public.wakppu_monthly_eligible(c.user_id)
  union all select r.user_id,r.nickname,r.clicks,r.rank from public.wakppu_monthly_results r where r.month=m and done is not null and public.wakppu_monthly_eligible(r.user_id)
 ), output as(select q.*,jsonb_build_object('nickname',q.nickname,'profile_nickname',(select nickname from public.players where user_id=q.user_id),'rank',q.rank,'clicks',q.clicks::text,'online',exists(select 1 from public.player_presence where user_id=q.user_id and last_seen_at>clock_timestamp()-interval '90 seconds'),'monthly_badge',public.wakppu_monthly_badge_state(q.user_id)->'monthly_badge') value from ranked q)
 select coalesce(jsonb_agg(value order by rank) filter(where rank<=100),'[]'),(jsonb_agg(value) filter(where user_id=u))->0 into rows,me from output;
 select coalesce(jsonb_agg(to_char(month,'YYYY-MM') order by month desc),'[]') into periods from
 (select month from public.wakppu_monthly_seasons union select current_month) s;
 return jsonb_build_object('month',to_char(m,'YYYY-MM'),'trial',m<'2026-11-01','finalized',done is not null,
 'ends_at',((m+interval '1 month') at time zone 'Asia/Seoul'),'server_now',instant,'seasons',periods,
 'rows',rows,'me',coalesce(me,jsonb_build_object('rank',null,'clicks','0')),'eligible',public.wakppu_monthly_eligible(u));
end $$;

alter function public.wakppu_api(jsonb) rename to wakppu_api_before_monthly;
revoke all on function public.wakppu_api_before_monthly(jsonb) from public,anon,authenticated;
create function public.wakppu_api(b jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a text:=b->>'action';u uuid:=auth.uid();r jsonb;m date;badge text;target uuid;
begin
 if a in ('monthly_rankings','monthly_badge_equip') and b ?| array['user_id','target_user_id'] then raise sqlstate 'PT403';end if;
 if a='monthly_rankings' then
  -- Reuse the read-only ranking gate: visible during maintenance and night lock.
  perform public.wakppu_api_before_monthly('{"action":"rankings"}');
  if b ? 'month' and (jsonb_typeof(b->'month') is distinct from 'string' or b->>'month' !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$') then raise sqlstate 'PT400';end if;
  m:=coalesce((b->>'month'||'-01')::date,date_trunc('month',public.wakppu_monthly_now() at time zone 'Asia/Seoul')::date);
  perform public.wakppu_monthly_settle();
  return public.wakppu_monthly_snapshot(u,m);
 elsif a='monthly_badge_equip' then
  perform public.wakppu_api_before_monthly('{"action":"bootstrap"}');
  if u is null then raise sqlstate 'PT401';end if;
  if not b ? 'badge_id' or jsonb_typeof(b->'badge_id') not in ('string','null') then raise sqlstate 'PT400';end if;
  badge:=b->>'badge_id';
  if badge is not null and not exists(select 1 from public.wakppu_monthly_rewards where user_id=u and kind='participant' and badge='monthly_'||to_char(month,'YYYYMM')||'_participant') then raise sqlstate 'PT403' using message='보유하지 않은 배지입니다.';end if;
  insert into public.wakppu_profile_cards(user_id,equipped,monthly_badge) values(u,'wax_beginning',badge) on conflict(user_id) do update set monthly_badge=excluded.monthly_badge;
  return public.wakppu_api_before_monthly('{"action":"profile_status"}')||public.wakppu_monthly_badge_state(u);
 end if;
 r:=public.wakppu_api_before_monthly(b);
 if a in ('profile_status','profile_equip','profile_title') then return r||public.wakppu_monthly_badge_state(u);
 elsif a='player_profile' then
  select user_id into target from public.players where nickname=b->>'nickname';
  return r||jsonb_build_object('monthly_badge',public.wakppu_monthly_badge_state(target)->'monthly_badge');
 elsif a='rankings' then
  return (select coalesce(jsonb_agg(e.value||jsonb_build_object('monthly_badge',public.wakppu_monthly_badge_state(p.user_id)->'monthly_badge') order by e.ordinality),'[]')
   from jsonb_array_elements(r) with ordinality e join public.players p on p.nickname=e.value->>'nickname');
 end if;
 return r;
end $$;

revoke all on function public.wakppu_monthly_now(),public.wakppu_monthly_eligible(uuid),public.wakppu_monthly_record(uuid),public.wakppu_monthly_settle(),public.wakppu_monthly_badge_state(uuid),public.wakppu_monthly_snapshot(uuid,date),public.wakppu_profile_title_before_monthly(uuid),public.wakppu_profile_title_state(uuid) from public,anon,authenticated;
revoke all on function public.wakppu_api(jsonb) from public;
grant execute on function public.wakppu_api(jsonb) to anon,authenticated;
insert into public.wakppu_monthly_seasons(month) values(date_trunc('month',public.wakppu_monthly_now() at time zone 'Asia/Seoul')::date);
-- Independent of traffic; also recovered on monthly-ranking reads. No client settlement API.
select cron.schedule('wakppu-monthly-settle','* * * * *','select public.wakppu_monthly_settle()');
commit;
