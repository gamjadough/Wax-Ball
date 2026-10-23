-- Private catalog/selection: expose only whitelisted public profile fields via RPC.
begin;
create table public.wakppu_profile_card_defs(
 card_id text primary key,name text not null,rarity text not null,
 free boolean not null default false,image text not null
 check(image ~ '^images/profile-cards/[a-z0-9-]+\.(png|webp)$')
);
insert into public.wakppu_profile_card_defs values
 ('wax_beginning','왁스의 시작','기본',true,'images/profile-cards/wax-beginning.png');
create table public.wakppu_profile_cards(
 user_id uuid primary key references public.players(user_id) on delete cascade,
 equipped text references public.wakppu_profile_card_defs(card_id)
);
alter table public.wakppu_profile_card_defs enable row level security;
alter table public.wakppu_profile_cards enable row level security;
revoke all on public.wakppu_profile_card_defs,public.wakppu_profile_cards from public,anon,authenticated;
alter function public.wakppu_api(jsonb) rename to wakppu_api_before_profiles;
revoke all on function public.wakppu_api_before_profiles(jsonb) from public,anon,authenticated;
create function public.wakppu_api(b jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $api$
declare
 actor uuid:=auth.uid();target uuid;selected text;catalog jsonb;owned jsonb;
 rows jsonb;entry jsonb;position bigint;card jsonb;state public.game_states%rowtype;
 admin_access boolean;
begin
 if b->>'action' not in ('profile_status','profile_equip','player_profile') or b->>'action' is null then
  return public.wakppu_api_before_profiles(b);
 end if;
 if actor is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.';end if;
 -- Preserve all existing maintenance, suspension, sleep and session gates.
 perform public.wakppu_api_before_profiles('{"action":"bootstrap"}'::jsonb);
 if b ? 'user_id' or b ? 'target_user_id' then
  raise sqlstate 'PT403' using message='다른 계정의 카드를 변경할 수 없습니다.';
 end if;
 admin_access:=public.wakppu_admin_content_access();
 if b->>'action' in ('profile_status','profile_equip') then
  if b->>'action'='profile_equip' then
   if not b ? 'card_id' or jsonb_typeof(b->'card_id') not in ('string','null') then
    raise sqlstate 'PT400' using message='잘못된 카드입니다.';
   end if;
   selected:=b->>'card_id';
   if selected is not null and not exists(select 1 from wakppu_profile_card_defs where card_id=selected and (free or admin_access)) then
    raise sqlstate 'PT400' using message='보유하지 않은 프로필 카드입니다.';
   end if;
   insert into wakppu_profile_cards values(actor,selected)
    on conflict(user_id) do update set equipped=excluded.equipped;
  end if;
  select equipped into selected from wakppu_profile_cards where user_id=actor;
  if not found then selected:='wax_beginning';end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',card_id,'name',name,'rarity',rarity,'free',free,'image',image) order by card_id),'[]'),
   coalesce(jsonb_agg(card_id order by card_id),'[]')
   into catalog,owned from wakppu_profile_card_defs where free or admin_access;
  return jsonb_build_object('catalog',catalog,'owned',owned,'equipped',selected,
   'nickname',(select nickname from players where user_id=actor));
 end if;
 if jsonb_typeof(b->'nickname') is distinct from 'string' or length(b->>'nickname') not between 1 and 100 then
  raise sqlstate 'PT400' using message='잘못된 플레이어입니다.';
 end if;
 rows:=public.wakppu_api_before_profiles('{"action":"rankings"}'::jsonb);
 select r.value,r.ordinality into entry,position from jsonb_array_elements(rows) with ordinality r
  where r.value->>'nickname'=b->>'nickname';
 select user_id into target from players where nickname=b->>'nickname';
 if target is null or (entry is null and target<>actor) then
  raise sqlstate 'PT404' using message='프로필을 찾을 수 없습니다.';
 end if;
 select * into state from game_states where user_id=target;
 select equipped into selected from wakppu_profile_cards where user_id=target;
 if not found then selected:='wax_beginning';end if;
 select jsonb_build_object('id',card_id,'name',name,'rarity',rarity,'free',free,'image',image)
  into card from wakppu_profile_card_defs where card_id=selected;
 return jsonb_build_object('nickname',b->>'nickname','rank',position,
  'gold',state.gold::text,'rebirths',state.rebirths,'online',coalesce((entry->>'online')::boolean,false),
  'title',case when coalesce((entry->>'supporter_title_visible')::boolean,true) then
    case when (entry->>'premium_supporter')::boolean then '프리미엄 후원자'
         when (entry->>'supporter')::boolean then '왁뿌볼 후원자' end end,
  'card',card,
  'discovered_count',(select count(*) from wakppu_item_balls where state.discovered_ball_ids ? ball_id),
  'discovery_total',(select count(*) from wakppu_item_balls));
end $api$;
revoke all on function public.wakppu_api(jsonb) from public;
grant execute on function public.wakppu_api(jsonb) to anon,authenticated;
commit;
