-- Current champion title, NOT a permanent souvenir like the champion profile card.
begin;
alter table public.wakppu_profile_cards drop constraint wakppu_profile_cards_title_id_check;
alter table public.wakppu_profile_cards add constraint wakppu_profile_cards_title_id_check
 check(title_id in ('auto','none','supporter','premium','champion'));
create function public.wakppu_current_champion() returns uuid
language sql stable set search_path=public,pg_temp as $winner$
 select g.user_id from public.game_states g join public.players p using(user_id)
 where not p.ranking_hidden and not exists(select 1 from public.moderation_cases m where m.user_id=p.user_id and
  (m.status='banned' or (m.status='suspended' and (m.suspended_until is null or m.suspended_until>statement_timestamp()))))
 and not exists(select 1 from public.wakppu_guest_accounts() c where c.id=p.user_id and c.eligible and c.hide_at<=statement_timestamp())
 order by g.rebirths desc,g.gold desc,g.user_id limit 1;
$winner$;
revoke all on function public.wakppu_current_champion() from public,anon,authenticated;
create or replace function public.wakppu_profile_title_state(u uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $state$
declare bonus integer:=public.wakppu_supporter_percent(u);access boolean;choice text;visible boolean;catalog jsonb;label text;
begin
 access:=case when u=auth.uid() then public.wakppu_admin_content_access() else
  exists(select 1 from public.players p join auth.users a on a.id=p.user_id where p.user_id=u and p.role='admin' and not coalesce(a.is_anonymous,false)) end;
 catalog:='[{"id":"auto","name":"자동 선택 (보유한 최고 칭호)"},{"id":"none","name":"칭호 없음"}]'::jsonb;
 if bonus>=5 or access then catalog:=catalog||'[{"id":"supporter","name":"왁뿌볼 후원자"}]'::jsonb;end if;
 if bonus>=30 or access then catalog:=catalog||'[{"id":"premium","name":"프리미엄 후원자"}]'::jsonb;end if;
 -- No nickname, client rank, historic card grant or admin bypass can confer this title.
 if u is not null and u=public.wakppu_current_champion() then
  catalog:=catalog||'[{"id":"champion","name":"👑 왁뿌볼의 정점"}]'::jsonb;
 end if;
 select title_id into choice from public.wakppu_profile_cards where user_id=u;
 choice:=coalesce(choice,'auto');
 select title_visible into visible from public.wakppu_purchase_cosmetics where user_id=u;
 if visible=false or not exists(select 1 from jsonb_array_elements(catalog) c where c->>'id'=choice) then choice:='none';end if;
 label:=case choice when 'champion' then '👑 왁뿌볼의 정점'
  when 'supporter' then '왁뿌볼 후원자' when 'premium' then '프리미엄 후원자'
  when 'auto' then case when bonus>=30 then '프리미엄 후원자' when bonus>=5 then '왁뿌볼 후원자' end end;
 return jsonb_build_object('title_catalog',catalog,'title_equipped',choice,'title',label);
end $state$;
revoke all on function public.wakppu_profile_title_state(uuid) from public,anon,authenticated;
commit;
