-- Separate candy catalog; never enters eternity draw odds or shard exchange.
begin;
create table if not exists public.wakppu_pumpkin_skin_defs(
 skin_id text primary key,ball_id text not null check(ball_id='halloween-pumpkin-2026'),
 candy_cost bigint not null check(candy_cost>0),position integer not null unique);
insert into public.wakppu_pumpkin_skin_defs values
 ('pumpkin_wisp','halloween-pumpkin-2026',50,0),
 ('pumpkin_ghost','halloween-pumpkin-2026',100,1),
 ('pumpkin_eclipse','halloween-pumpkin-2026',200,2)
on conflict(skin_id) do update set candy_cost=excluded.candy_cost,ball_id=excluded.ball_id,position=excluded.position;
alter table public.wakppu_pumpkin_skin_defs enable row level security;
revoke all on public.wakppu_pumpkin_skin_defs from public,anon,authenticated;
do $migration$ begin
 if to_regprocedure('public.wakppu_api_before_pumpkin_skins(jsonb)') is null then
  alter function public.wakppu_api(jsonb) rename to wakppu_api_before_pumpkin_skins;
 end if;
end $migration$;
revoke all on function public.wakppu_api_before_pumpkin_skins(jsonb) from public,anon,authenticated;
create or replace function public.wakppu_api(b jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $api$
declare a text:=b->>'action';u uuid:=auth.uid();g public.game_states%rowtype;
 l public.wakppu_limited_players%rowtype;s public.wakppu_skins%rowtype;d public.wakppu_pumpkin_skin_defs%rowtype;
 cached public.wakppu_skin_requests%rowtype;fp jsonb;rid uuid;access boolean;active boolean;
 result jsonb;catalog jsonb;owned jsonb;equipped text;can_equip boolean;
begin
 if a is null or a not in ('pumpkin_skins','pumpkin_skin_exchange','pumpkin_skin_equip') then return public.wakppu_api_before_pumpkin_skins(b);end if;
 if u is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.';end if;
 -- Shared auth, maintenance, moderation and sleep gates remain authoritative.
 perform public.wakppu_api_before_pumpkin_skins(jsonb_build_object('action','bootstrap'));
 access:=public.wakppu_admin_content_access();
 -- Same per-user lock order as limited API; do not trust client balances or role claims.
 select * into g from public.game_states where user_id=u for update;
 if not found then raise sqlstate 'PT401' using message='게임 계정을 다시 불러와주세요.';end if;
 insert into public.wakppu_limited_players(user_id) values(u) on conflict do nothing;
 select * into l from public.wakppu_limited_players where user_id=u for update;
 insert into public.wakppu_skins(user_id) values(u) on conflict do nothing;
 select * into s from public.wakppu_skins where user_id=u for update;
 select clock_timestamp()>=starts_at and clock_timestamp()<ends_at into active from public.wakppu_limited_settings where id=true;
 active:=coalesce(active,false);can_equip:=access or l.owned?'halloween-pumpkin-2026';
 if a<>'pumpkin_skins' then
  if coalesce(b->>'request_id','')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception '잘못된 요청 ID';end if;
  rid:=(b->>'request_id')::uuid;
  fp:=jsonb_build_object('action',a,'skin_id',b->'skin_id','ball_id',b->'ball_id','count',b->'count');
  select * into cached from public.wakppu_skin_requests where user_id=u and request_id=rid;
  if found then
   if cached.request<>fp then raise exception '요청 ID 충돌';end if;
   -- A retry never charges or changes equip again, and never revives revoked admin access.
  else
   if coalesce((b->>'item_revision')::bigint,-1)<>g.item_revision or coalesce((b->>'skin_revision')::bigint,-1)<>s.revision then raise sqlstate 'PT409' using message='스킨 상태가 변경되었습니다. 다시 불러와주세요.';end if;
   if a='pumpkin_skin_exchange' then
    if access then raise exception '관리자는 구매 없이 바로 장착할 수 있습니다.';end if;
    if not active then raise sqlstate 'PT409' using message='할로윈 이벤트 기간이 아닙니다.';end if;
    select * into d from public.wakppu_pumpkin_skin_defs where skin_id=b->>'skin_id';
    if not found or s.owned?d.skin_id then raise exception '교환할 미보유 스킨을 선택해주세요.';end if;
    if l.tokens<d.candy_cost then raise exception '할로윈 사탕이 부족합니다.';end if;
    l.tokens:=l.tokens-d.candy_cost;s.owned:=s.owned||jsonb_build_object(d.skin_id,true);
    update public.wakppu_limited_players set tokens=l.tokens where user_id=u;
   else
    if b->>'ball_id' is distinct from 'halloween-pumpkin-2026' then raise exception '대상 왁뿌볼 오류';end if;
    if b->>'skin_id' is null then s.equipped:=s.equipped-'halloween-pumpkin-2026';
    else
     select * into d from public.wakppu_pumpkin_skin_defs where skin_id=b->>'skin_id' and ball_id=b->>'ball_id';
     if not found or (not access and not(s.owned?d.skin_id)) then raise exception '보유한 전용 스킨만 장착할 수 있습니다.';end if;
     if not can_equip then raise exception '잭오랜턴 왁뿌볼을 먼저 해금해주세요.';end if;
     s.equipped:=s.equipped||jsonb_build_object(d.ball_id,d.skin_id);
    end if;
   end if;
   s.revision:=s.revision+1;g.item_revision:=g.item_revision+1;
   update public.wakppu_skins set owned=s.owned,equipped=s.equipped,revision=s.revision where user_id=u;
   update public.game_states set item_revision=g.item_revision where user_id=u;
  end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('skin_id',skin_id,'ball_id',ball_id,'cost',candy_cost::text) order by position),'[]') into catalog from public.wakppu_pumpkin_skin_defs;
 owned:=s.owned;
 if access then owned:=owned||(select coalesce(jsonb_object_agg(skin_id,true),'{}') from public.wakppu_pumpkin_skin_defs);end if;
 equipped:=s.equipped->>'halloween-pumpkin-2026';
 if not can_equip or not(owned?equipped) or not exists(select 1 from public.wakppu_pumpkin_skin_defs where skin_id=equipped) then equipped:=null;end if;
 result:=jsonb_build_object('catalog',catalog,'owned',owned,'equipped',equipped,'tokens',l.tokens::text,'active',active,'can_equip',can_equip,'admin_content_access',access,'skin_revision',s.revision,'revision',g.item_revision,'gold',g.gold::text);
 if a<>'pumpkin_skins' and cached.user_id is null then insert into public.wakppu_skin_requests values(u,rid,fp,result);end if;
 return result;
end $api$;
revoke all on function public.wakppu_api(jsonb) from public,anon,authenticated;
grant execute on function public.wakppu_api(jsonb) to anon,authenticated;
commit;
