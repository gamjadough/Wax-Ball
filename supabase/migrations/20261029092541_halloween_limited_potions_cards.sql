begin;
create table public.wakppu_halloween_goods_defs(
 id text primary key, name text not null, kind text not null check(kind in ('potion','card','title')),
 price integer not null check(price>0), image text);
insert into public.wakppu_halloween_goods_defs values
 ('witch_potion','마녀 포션','potion',50,null),('ghost_potion','유령 포션','potion',50,null),('pumpkin_potion','호박 포션','potion',50,null),
 ('halloween_witch','마녀의 심야','card',200,'images/profile-cards/halloween-witch.webp'),
 ('halloween_ghost','유령의 저택','card',200,'images/profile-cards/halloween-ghost.webp'),
 ('halloween_pumpkin','잭오랜턴의 밤','card',200,'images/profile-cards/halloween-pumpkin.webp'),
 ('halloween_witch_title','마녀의 계약자','title',100,null),
 ('halloween_ghost_title','유령의 친구','title',100,null),
 ('halloween_pumpkin_title','호박불의 수호자','title',100,null);
create table public.wakppu_halloween_goods(
 user_id uuid primary key references public.players(user_id) on delete cascade,
 stock jsonb not null default '{}', expires jsonb not null default '{}', admin_expires jsonb not null default '{}',
 revision bigint not null default 0, gold_remainder smallint not null default 0 check(gold_remainder in (0,1)));
create table public.wakppu_halloween_goods_requests(
 user_id uuid references public.players(user_id) on delete cascade, request_id uuid,
 fingerprint jsonb not null, primary key(user_id,request_id));
alter table public.wakppu_halloween_goods_defs enable row level security;
alter table public.wakppu_halloween_goods enable row level security;
alter table public.wakppu_halloween_goods_requests enable row level security;
revoke all on public.wakppu_halloween_goods_defs,public.wakppu_halloween_goods,public.wakppu_halloween_goods_requests from public,anon,authenticated;
insert into public.wakppu_profile_card_defs(card_id,name,rarity,free,image)
 select id,name,'할로윈 한정',false,image from public.wakppu_halloween_goods_defs where kind='card';
alter table public.wakppu_profile_cards drop constraint wakppu_profile_cards_title_id_check;
alter table public.wakppu_profile_cards add constraint wakppu_profile_cards_title_id_check
 check(title_id in ('auto','none','supporter','premium','champion','halloween_witch_title','halloween_ghost_title','halloween_pumpkin_title') or title_id ~ '^monthly_[0-9]{6}_(champion|top10)$');

-- Internal helpers only; every public entry uses the existing account gates.
create function public.wakppu_halloween_goods_expiry(u uuid) returns jsonb language sql stable set search_path=public,pg_temp as $$
 select coalesce(jsonb_object_agg(d.id,greatest(coalesce((g.expires->>d.id)::bigint,0),
 case when public.wakppu_admin_content_access() and u=auth.uid() then coalesce((g.admin_expires->>d.id)::bigint,0) else 0 end)),'{}')
 from public.wakppu_halloween_goods_defs d left join public.wakppu_halloween_goods g on g.user_id=u where d.kind='potion';
$$;
create function public.wakppu_halloween_goods_snapshot(u uuid) returns jsonb language plpgsql stable set search_path=public,pg_temp as $$
declare e jsonb:=public.wakppu_halloween_goods_expiry(u);ms bigint:=floor(extract(epoch from statement_timestamp())*1000);access boolean:=public.wakppu_admin_content_access();
begin
 return jsonb_build_object('server_time',ms,'expires',e,'admin_access',access,
 'stock',coalesce((select stock from public.wakppu_halloween_goods where user_id=u),'{}'),
 'revision',coalesce((select revision from public.wakppu_halloween_goods where user_id=u),0),
 'tokens',coalesce((select tokens::text from public.wakppu_limited_players where user_id=u),'0'),
 'active',coalesce((select statement_timestamp()>=starts_at and statement_timestamp()<ends_at from public.wakppu_limited_settings where id),false),
 'catalog',(select jsonb_agg(jsonb_build_object('id',id,'name',name,'kind',kind,'price',price,'image',image) order by kind,id) from public.wakppu_halloween_goods_defs),
 'timing',jsonb_build_object('animation',case when (e->>'ghost_potion')::bigint>ms then 2 else 1 end,'respawn',case when (e->>'pumpkin_potion')::bigint>ms then 2 else 1 end));
end $$;
alter function public.wakppu_supporter_reward(uuid,numeric) rename to wakppu_supporter_reward_before_halloween_goods;
create function public.wakppu_supporter_reward(u uuid,base numeric) returns numeric language plpgsql set search_path=public,pg_temp as $$
declare paid numeric;parts numeric;carry integer;
begin
 paid:=public.wakppu_supporter_reward_before_halloween_goods(u,base);
 if paid<=0 or coalesce((public.wakppu_halloween_goods_expiry(u)->>'witch_potion')::bigint,0)<=extract(epoch from statement_timestamp())*1000 then return paid;end if;
 select gold_remainder into carry from public.wakppu_halloween_goods where user_id=u for update;
 parts:=paid*3+coalesce(carry,0);
 update public.wakppu_halloween_goods set gold_remainder=mod(parts,2)::integer where user_id=u;
 return floor(parts/2);
end $$;
alter function public.wakppu_profile_title_state(uuid) rename to wakppu_profile_title_before_halloween_goods;
create function public.wakppu_profile_title_state(u uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare r jsonb:=public.wakppu_profile_title_before_halloween_goods(u);catalog jsonb;choice text;label text;visible boolean;access boolean;
begin
 access:=case when u=auth.uid() then public.wakppu_admin_content_access() else exists(select 1 from public.players p join auth.users a on a.id=p.user_id where p.user_id=u and p.role='admin' and not coalesce(a.is_anonymous,false)) end;
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',d.name) order by d.id),'[]') into catalog from public.wakppu_halloween_goods_defs d
 where d.kind='title' and (access or exists(select 1 from public.wakppu_halloween_goods g where g.user_id=u and coalesce((g.stock->>d.id)::integer,0)>0));
 select title_id into choice from public.wakppu_profile_cards where user_id=u;
 select title_visible into visible from public.wakppu_purchase_cosmetics where user_id=u;
 if visible is distinct from false then select c->>'name' into label from jsonb_array_elements(catalog)c where c->>'id'=choice;end if;
 return r||jsonb_build_object('title_catalog',(r->'title_catalog')||catalog)||case when label is not null then jsonb_build_object('title_equipped',choice,'title',label) else '{}'::jsonb end;
end $$;

alter function public.wakppu_api(jsonb) rename to wakppu_api_before_halloween_goods;
create function public.wakppu_api(b jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid();a text:=b->>'action';r jsonb;g public.wakppu_halloween_goods;d public.wakppu_halloween_goods_defs;
 l public.wakppu_limited_players;rid uuid;fp jsonb;prior jsonb;access boolean;ms bigint;until_ms bigint;
begin
 if a in ('halloween_goods','halloween_goods_buy','halloween_goods_use') then
  if u is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.';end if;
  perform public.wakppu_api_before_halloween_goods('{"action":"bootstrap"}');
  if b ?| array['user_id','target_user_id','price','stock','expires','gold','reward','admin_access'] then raise sqlstate 'PT403';end if;
  perform 1 from public.game_states where user_id=u for update;
  insert into public.wakppu_limited_players(user_id) values(u) on conflict do nothing;
  select * into l from public.wakppu_limited_players where user_id=u for update;
  insert into public.wakppu_halloween_goods(user_id) values(u) on conflict do nothing;
  select * into g from public.wakppu_halloween_goods where user_id=u for update;
  if a='halloween_goods' then return public.wakppu_halloween_goods_snapshot(u);end if;
  if coalesce(b->>'request_id','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' or coalesce(b->>'goods_revision','')!~'^[0-9]{1,18}$' then raise sqlstate 'PT400';end if;
  rid:=(b->>'request_id')::uuid;fp:=jsonb_build_object('action',a,'id',b->>'id');
  select fingerprint into prior from public.wakppu_halloween_goods_requests where user_id=u and request_id=rid;
  if found then
   if prior<>fp then raise sqlstate 'PT409' using message='다른 작업에 사용한 요청입니다.';end if;
   return public.wakppu_halloween_goods_snapshot(u);
  end if;
  if g.revision<>(b->>'goods_revision')::bigint then raise sqlstate 'PT409' using message='한정 아이템 상태를 다시 불러와주세요.';end if;
  select * into d from public.wakppu_halloween_goods_defs where id=b->>'id';
  if not found then raise sqlstate 'PT400' using message='없는 한정 아이템입니다.';end if;
  access:=public.wakppu_admin_content_access();
  if a='halloween_goods_buy' then
   if not coalesce((public.wakppu_halloween_goods_snapshot(u)->>'active')::boolean,false) then raise sqlstate 'PT409' using message='할로윈 판매 기간이 아닙니다.';end if;
   if access then raise sqlstate 'PT409' using message='관리자는 구매 없이 바로 사용할 수 있습니다.';end if;
   if d.kind<>'potion' and coalesce((g.stock->>d.id)::integer,0)>0 then raise sqlstate 'PT409' using message='이미 보유한 아이템입니다.';end if;
   if l.tokens<d.price then raise sqlstate 'PT400' using message='캔디가 부족합니다.';end if;
   if coalesce((g.stock->>d.id)::integer,0)>=1000000 then raise sqlstate 'PT400' using message='보관 한도입니다.';end if;
   update public.wakppu_limited_players set tokens=tokens-d.price where user_id=u;
   g.stock:=g.stock||jsonb_build_object(d.id,coalesce((g.stock->>d.id)::integer,0)+1);
   if d.kind='card' then insert into public.wakppu_profile_card_grants(user_id,card_id) values(u,d.id) on conflict do nothing;end if;
  else
   if d.kind<>'potion' then raise sqlstate 'PT400';end if;
   if not access and coalesce((g.stock->>d.id)::integer,0)<=0 then raise sqlstate 'PT403' using message='보유한 포션이 없습니다.';end if;
   ms:=floor(extract(epoch from statement_timestamp())*1000);
   until_ms:=greatest(ms,coalesce(((case when access then g.admin_expires else g.expires end)->>d.id)::bigint,0))+1800000;
   if until_ms>ms+604800000 then raise sqlstate 'PT400' using message='최대 연장 시간은 7일입니다.';end if;
   if access then g.admin_expires:=g.admin_expires||jsonb_build_object(d.id,until_ms);
   else g.expires:=g.expires||jsonb_build_object(d.id,until_ms);g.stock:=g.stock||jsonb_build_object(d.id,(g.stock->>d.id)::integer-1);end if;
  end if;
  update public.wakppu_halloween_goods set stock=g.stock,expires=g.expires,admin_expires=g.admin_expires,revision=revision+1 where user_id=u;
  insert into public.wakppu_halloween_goods_requests values(u,rid,fp);
  return public.wakppu_halloween_goods_snapshot(u);
 end if;
 r:=public.wakppu_api_before_halloween_goods(b);
 if u is not null and a in ('bootstrap','items','item_hit','limited_hit','event_ball_hit','ember_auto_hit','save_progress','auto_rebirth_run') then
  r:=r||jsonb_build_object('halloween_goods',public.wakppu_halloween_goods_snapshot(u)-'server_time'-'catalog'-'stock');
 end if;
 return r;
end $$;
revoke all on function public.wakppu_halloween_goods_expiry(uuid),public.wakppu_halloween_goods_snapshot(uuid),public.wakppu_supporter_reward_before_halloween_goods(uuid,numeric),public.wakppu_supporter_reward(uuid,numeric),public.wakppu_profile_title_before_halloween_goods(uuid),public.wakppu_profile_title_state(uuid),public.wakppu_api_before_halloween_goods(jsonb),public.wakppu_api(jsonb) from public,anon,authenticated;
grant execute on function public.wakppu_api(jsonb) to anon,authenticated;
commit;
