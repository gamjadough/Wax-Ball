-- Permanent first-place souvenir. Ownership is separate from equipment and progression.
begin;
insert into public.wakppu_profile_card_defs(card_id,name,rarity,free,image) values
 ('golden_champion','황금의 정점','1위 기념',false,'images/profile-cards/golden-champion.webp');
create table public.wakppu_profile_card_grants(
 user_id uuid not null references public.players(user_id) on delete cascade,
 card_id text not null references public.wakppu_profile_card_defs(card_id),
 awarded_at timestamptz not null default now(),
 primary key(user_id,card_id)
);
alter table public.wakppu_profile_card_grants enable row level security;
revoke all on public.wakppu_profile_card_grants from public,anon,authenticated;

-- Same exclusions, exact numeric sorting and UUID tie-break as the public ranking.
-- Invoker only: called by the existing privileged RPC, never exposed to clients.
create function public.wakppu_award_champion() returns void
language sql volatile set search_path=public,pg_temp as $award$
 insert into public.wakppu_profile_card_grants(user_id,card_id)
 select g.user_id,'golden_champion' from public.game_states g join public.players p using(user_id)
 where not p.ranking_hidden and not exists(select 1 from public.moderation_cases m where m.user_id=p.user_id and
  (m.status='banned' or (m.status='suspended' and (m.suspended_until is null or m.suspended_until>clock_timestamp()))))
 and not exists(select 1 from public.wakppu_guest_accounts() c where c.id=p.user_id and c.eligible and c.hide_at<=clock_timestamp())
 order by g.rebirths desc,g.gold desc,g.user_id limit 1
 on conflict(user_id,card_id) do nothing;
$award$;
revoke all on function public.wakppu_award_champion() from public,anon,authenticated;

-- Extend the original profile implementation without bypassing newer title wrappers.
do $patch$
declare f record;body text;patched text;matched integer:=0;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosrc like '%into catalog,owned from wakppu_profile_card_defs%' loop
  body:=pg_get_functiondef(f.oid);
  patched:=replace(body,'(free or admin_access)',
   '(free or admin_access or exists(select 1 from public.wakppu_profile_card_grants cg where cg.user_id=actor and cg.card_id=wakppu_profile_card_defs.card_id))');
  patched:=replace(patched,'where free or admin_access;',
   'where free or admin_access or exists(select 1 from public.wakppu_profile_card_grants cg where cg.user_id=actor and cg.card_id=wakppu_profile_card_defs.card_id);');
  if patched=body then raise exception 'Unexpected profile ownership check';end if;
  execute patched;matched:=matched+1;
 end loop;
 if matched<>1 then raise exception 'Expected one profile implementation, found %',matched;end if;
end $patch$;

alter function public.wakppu_api(jsonb) rename to wakppu_api_before_champion_cards;
revoke all on function public.wakppu_api_before_champion_cards(jsonb) from public,anon,authenticated;
create function public.wakppu_api(b jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $api$
declare r jsonb;a text:=b->>'action';depth integer:=coalesce(nullif(current_setting('wakppu.champion_depth',true),''),'0')::integer;
begin
 -- Nested calls (e.g. save inside auto rebirth) must not award an intermediate state.
 perform set_config('wakppu.champion_depth',(depth+1)::text,true);
 if depth=0 and a in ('profile_status','profile_equip','profile_title','player_profile') then
  perform public.wakppu_api_before_champion_cards('{"action":"bootstrap"}');
  perform public.wakppu_award_champion();
 end if;
 r:=public.wakppu_api_before_champion_cards(b);
 perform set_config('wakppu.champion_depth',depth::text,true);
 if depth=0 and a in ('rankings','save_progress','auto_rebirth_run','item_hit','limited_hit','event_ball_hit','limited_buy','item_draw','item_use','admin_gold','admin_rebirths','admin_ranking_visibility','admin_ban','admin_unban') then
  perform public.wakppu_award_champion();
 end if;
 return r;
exception when others then
 perform set_config('wakppu.champion_depth',depth::text,true);raise;
end $api$;
revoke all on function public.wakppu_api(jsonb) from public;
grant execute on function public.wakppu_api(jsonb) to anon,authenticated;
-- Backfill only the current eligible first place, never historical guesses or auto-equip.
select public.wakppu_award_champion();
commit;
