begin;
create table if not exists public.wakppu_halloween_cosmetics(
 user_id uuid primary key references public.players(user_id) on delete cascade,
 owned jsonb not null default '{}' check(jsonb_typeof(owned)='object'),
 equipped text check(equipped in ('little_ghost','pumpkin_ember')),
 shards bigint not null default 0 check(shards>=0),opened bigint not null default 0 check(opened>=0),revision bigint not null default 0);
create table if not exists public.wakppu_halloween_cosmetic_requests(
 user_id uuid references public.players(user_id) on delete cascade,request_id uuid,request jsonb not null,result jsonb not null,
 primary key(user_id,request_id));
alter table public.wakppu_halloween_cosmetics enable row level security;
alter table public.wakppu_halloween_cosmetic_requests enable row level security;
revoke all on public.wakppu_halloween_cosmetics,public.wakppu_halloween_cosmetic_requests from public,anon,authenticated;
create or replace function public.wakppu_halloween_cosmetic_snapshot(u uuid) returns jsonb language sql stable set search_path=public,pg_temp as $$
 select jsonb_build_object('owned',c.owned,'equipped',c.equipped,'shards',c.shards::text,'opened',c.opened::text,'decor_revision',c.revision,
 'tokens',coalesce(l.tokens,0)::text,'gold',g.gold::text,'revision',g.item_revision,'price','100','exchange_cost','3',
 'active',coalesce((select clock_timestamp()>=starts_at and clock_timestamp()<ends_at from public.wakppu_limited_settings ls where ls.id=true),false),
 'catalog',jsonb_build_array(
 jsonb_build_object('id','little_ghost','name','길 잃은 꼬마 유령','kind','equip','weight',1),
 jsonb_build_object('id','pumpkin_ember','name','잭오랜턴의 불씨','kind','equip','weight',1),
 jsonb_build_object('id','bat_swarm','name','박쥐 무리','kind','use','weight',1)))
 from public.wakppu_halloween_cosmetics c join public.game_states g on g.user_id=c.user_id
 left join public.wakppu_limited_players l on l.user_id=c.user_id where c.user_id=u;
$$;
revoke all on function public.wakppu_halloween_cosmetic_snapshot(uuid) from public,anon,authenticated;
do $wrap$ begin
 if to_regprocedure('public.wakppu_api_before_halloween_cosmetics(jsonb)') is null then alter function public.wakppu_api(jsonb) rename to wakppu_api_before_halloween_cosmetics;end if;
end $wrap$;
revoke all on function public.wakppu_api_before_halloween_cosmetics(jsonb) from public,anon,authenticated;
create or replace function public.wakppu_api(b jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $api$
declare a text:=b->>'action';u uuid:=auth.uid();g public.game_states;l public.wakppu_limited_players;c public.wakppu_halloween_cosmetics;
 cached public.wakppu_halloween_cosmetic_requests;rid uuid;fp jsonb;reward jsonb;id text;active boolean;duplicate boolean;
begin
 if a is null or a not in ('halloween_cosmetics','halloween_decor_open','halloween_decor_exchange','halloween_decor_equip','halloween_decor_use') then return public.wakppu_api_before_halloween_cosmetics(b);end if;
 if u is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.';end if;
 perform public.wakppu_api_before_halloween_cosmetics('{"action":"bootstrap"}');
 select * into g from public.game_states where user_id=u for update;
 if not found then raise sqlstate 'PT401';end if;
 insert into public.wakppu_limited_players(user_id) values(u) on conflict do nothing;
 select * into l from public.wakppu_limited_players where user_id=u for update;
 insert into public.wakppu_halloween_cosmetics(user_id) values(u) on conflict do nothing;
 select * into c from public.wakppu_halloween_cosmetics where user_id=u for update;
 if a='halloween_cosmetics' then return public.wakppu_halloween_cosmetic_snapshot(u);end if;
 if coalesce(b->>'request_id','')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise sqlstate 'PT400' using message='잘못된 요청 ID';end if;
 rid:=(b->>'request_id')::uuid;fp:=jsonb_build_object('action',a,'item_id',b->'item_id');
 select * into cached from public.wakppu_halloween_cosmetic_requests where user_id=u and request_id=rid;
 if found then
  if cached.request<>fp then raise sqlstate 'PT409' using message='다른 작업에 사용된 요청입니다.';end if;
  return public.wakppu_halloween_cosmetic_snapshot(u)||jsonb_build_object('result',cached.result);
 end if;
 if coalesce((b->>'item_revision')::bigint,-1)<>g.item_revision or coalesce((b->>'decor_revision')::bigint,-1)<>c.revision then raise sqlstate 'PT409' using message='상태가 변경되었습니다. 다시 불러와주세요.';end if;
 id:=b->>'item_id';reward:='{}';
 if a='halloween_decor_open' then
  select clock_timestamp()>=starts_at and clock_timestamp()<ends_at into active from public.wakppu_limited_settings ls where ls.id=true;
  if not coalesce(active,false) then raise sqlstate 'PT409' using message='할로윈 상자 판매 기간이 아닙니다.';end if;
  if l.tokens<100 then raise sqlstate 'PT409' using message='100캔디가 필요합니다.';end if;
  -- One server-side uniform draw; no client seed, price, odds or prize is trusted.
  id:=(array['little_ghost','pumpkin_ember','bat_swarm'])[1+floor(random()*3)::integer];duplicate:=c.owned?id;
  l.tokens:=l.tokens-100;c.opened:=c.opened+1;
  if duplicate then c.shards:=c.shards+1;else c.owned:=c.owned||jsonb_build_object(id,true);end if;
  reward:=jsonb_build_object('item_id',id,'duplicate',duplicate,'shards_gained',case when duplicate then 1 else 0 end);
 elsif a='halloween_decor_exchange' then
  if id is null or id not in ('little_ghost','pumpkin_ember','bat_swarm') then raise sqlstate 'PT400';end if;
  if c.owned?id then raise sqlstate 'PT409' using message='이미 보유한 꾸미기입니다.';end if;
  if c.shards<3 then raise sqlstate 'PT409' using message='할로윈 조각 3개가 필요합니다.';end if;
  c.shards:=c.shards-3;c.owned:=c.owned||jsonb_build_object(id,true);reward:=jsonb_build_object('item_id',id,'exchanged',true);
 elsif a='halloween_decor_equip' then
  if id is not null and (id not in ('little_ghost','pumpkin_ember') or not(c.owned?id)) then raise sqlstate 'PT403' using message='보유한 꾸미기만 장착할 수 있습니다.';end if;
  c.equipped:=id;
 else
  if id is distinct from 'bat_swarm' or not(c.owned?id) then raise sqlstate 'PT403' using message='보유한 박쥐 무리만 사용할 수 있습니다.';end if;
  reward:=jsonb_build_object('used','bat_swarm');
 end if;
 c.revision:=c.revision+1;g.item_revision:=g.item_revision+1;
 update public.wakppu_halloween_cosmetics set owned=c.owned,equipped=c.equipped,shards=c.shards,opened=c.opened,revision=c.revision where user_id=u;
 update public.wakppu_limited_players set tokens=l.tokens where user_id=u;
 update public.game_states set item_revision=g.item_revision where user_id=u;
 insert into public.wakppu_halloween_cosmetic_requests values(u,rid,fp,reward);
 return public.wakppu_halloween_cosmetic_snapshot(u)||jsonb_build_object('result',reward);
end $api$;
revoke all on function public.wakppu_api(jsonb) from public,anon,authenticated;
grant execute on function public.wakppu_api(jsonb) to anon,authenticated;
commit;
