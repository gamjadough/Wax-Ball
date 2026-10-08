-- Public read-only rankings during maintenance; authenticated server-timed presence.
begin;
create table if not exists public.player_presence (
 user_id uuid primary key references public.players(user_id) on delete cascade,
 last_seen_at timestamptz not null
);
alter table public.player_presence enable row level security;
revoke all on public.player_presence from public,anon,authenticated;
do $$begin
 if to_regprocedure('public.wakppu_api_before_presence(jsonb)') is null then
  alter function public.wakppu_api(jsonb) rename to wakppu_api_before_presence;
 end if;
end$$;
revoke all on function public.wakppu_api_before_presence(jsonb) from public,anon,authenticated;
create or replace function public.wakppu_api(b jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); instant timestamptz:=clock_timestamp();
begin
 if b->>'action' in ('rankings','presence_ping') then
  if exists(select 1 from moderation_cases m where m.user_id=actor and
    (m.status='banned' or (m.status='suspended' and (m.suspended_until is null or m.suspended_until>instant)))) then
   raise sqlstate 'PT403' using message='이 계정은 이용이 제한되었습니다.';
  end if;
  if b->>'action'='presence_ping' then
   if actor is null or not exists(select 1 from players where user_id=actor) then
    raise sqlstate 'PT401' using message='로그인이 필요합니다.';
   end if;
   insert into player_presence(user_id,last_seen_at) values(actor,instant)
    on conflict(user_id) do update set last_seen_at=excluded.last_seen_at
    where player_presence.last_seen_at<instant-interval '25 seconds';
   return jsonb_build_object('ok',true);
  end if;
  return (select coalesce(jsonb_agg(to_jsonb(x)-'sort_gold'-'sort_id' order by x.rebirths desc,x.sort_gold desc,x.sort_id),'[]'::jsonb) from (
   select p.nickname,g.gold::text as gold,g.rebirths,
    coalesce(pr.last_seen_at>instant-interval '90 seconds',false) as online,
    g.gold as sort_gold,g.user_id as sort_id
   from game_states g join players p using(user_id) left join player_presence pr using(user_id)
   where not p.ranking_hidden and not exists(select 1 from moderation_cases m where m.user_id=p.user_id and
    (m.status='banned' or (m.status='suspended' and (m.suspended_until is null or m.suspended_until>instant))))
    and not exists(select 1 from wakppu_guest_accounts() c where c.id=p.user_id and c.eligible and c.hide_at<=instant)
   order by g.rebirths desc,g.gold desc,g.user_id limit 100
  ) x);
 end if;
 return public.wakppu_api_before_presence(b);
end $$;
revoke all on function public.wakppu_api(jsonb) from public;
grant execute on function public.wakppu_api(jsonb) to anon,authenticated;
commit;
