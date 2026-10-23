begin;
alter table public.wakppu_profile_cards add column title_id text not null default 'auto'
 check(title_id in ('auto','none','supporter','premium'));
create function public.wakppu_profile_title_state(u uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $state$
declare bonus integer:=public.wakppu_supporter_percent(u);access boolean;choice text;visible boolean;catalog jsonb;label text;
begin
 access:=case when u=auth.uid() then public.wakppu_admin_content_access() else
  exists(select 1 from public.players p join auth.users a on a.id=p.user_id where p.user_id=u and p.role='admin' and not coalesce(a.is_anonymous,false)) end;
 catalog:='[{"id":"auto","name":"자동 선택 (보유한 최고 칭호)"},{"id":"none","name":"칭호 없음"}]'::jsonb;
 if bonus>=5 or access then catalog:=catalog||'[{"id":"supporter","name":"왁뿌볼 후원자"}]'::jsonb;end if;
 if bonus>=30 or access then catalog:=catalog||'[{"id":"premium","name":"프리미엄 후원자"}]'::jsonb;end if;
 select title_id into choice from public.wakppu_profile_cards where user_id=u;
 choice:=coalesce(choice,'auto');
 select title_visible into visible from public.wakppu_purchase_cosmetics where user_id=u;
 if visible=false or not exists(select 1 from jsonb_array_elements(catalog) c where c->>'id'=choice) then choice:='none';end if;
 label:=case choice when 'supporter' then '왁뿌볼 후원자' when 'premium' then '프리미엄 후원자'
  when 'auto' then case when bonus>=30 then '프리미엄 후원자' when bonus>=5 then '왁뿌볼 후원자' end end;
 return jsonb_build_object('title_catalog',catalog,'title_equipped',choice,'title',label);
end $state$;
revoke all on function public.wakppu_profile_title_state(uuid) from public,anon,authenticated;
alter function public.wakppu_api(jsonb) rename to wakppu_api_before_profile_titles;
revoke all on function public.wakppu_api_before_profile_titles(jsonb) from public,anon,authenticated;
create function public.wakppu_api(b jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $api$
declare actor uuid:=auth.uid();r jsonb;t jsonb;choice text;target uuid;
begin
 if b->>'action'='profile_title' then
  if actor is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.';end if;
  perform public.wakppu_api_before_profile_titles('{"action":"bootstrap"}');
  if b ? 'user_id' or b ? 'target_user_id' then raise sqlstate 'PT403' using message='다른 계정의 칭호는 변경할 수 없습니다.';end if;
  if jsonb_typeof(b->'title_id') is distinct from 'string' then raise sqlstate 'PT400' using message='잘못된 칭호입니다.';end if;
  choice:=b->>'title_id';t:=public.wakppu_profile_title_state(actor);
  if not exists(select 1 from jsonb_array_elements(t->'title_catalog') c where c->>'id'=choice) then
   raise sqlstate 'PT403' using message='보유하지 않은 칭호입니다.';
  end if;
  insert into public.wakppu_profile_cards(user_id,equipped,title_id) values(actor,'wax_beginning',choice)
   on conflict(user_id) do update set title_id=excluded.title_id;
  insert into public.wakppu_purchase_cosmetics(user_id,title_visible) values(actor,choice<>'none')
   on conflict(user_id) do update set title_visible=excluded.title_visible;
  return public.wakppu_api_before_profile_titles('{"action":"profile_status"}')||public.wakppu_profile_title_state(actor);
 end if;
 r:=public.wakppu_api_before_profile_titles(b);
 if b->>'action' in ('profile_status','profile_equip') then
  return r||public.wakppu_profile_title_state(actor);
 elsif b->>'action'='player_profile' then
  select user_id into target from public.players where nickname=b->>'nickname';
  return r||jsonb_build_object('title',public.wakppu_profile_title_state(target)->'title');
 elsif b->>'action'='rankings' then
  return (select coalesce(jsonb_agg(e.value||jsonb_build_object('profile_title',public.wakppu_profile_title_state(p.user_id)->'title') order by e.ordinality),'[]')
   from jsonb_array_elements(r) with ordinality e join public.players p on p.nickname=e.value->>'nickname');
 end if;
 return r;
end $api$;
revoke all on function public.wakppu_api(jsonb) from public;
grant execute on function public.wakppu_api(jsonb) to anon,authenticated;
commit;
