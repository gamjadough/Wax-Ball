-- Apply after the existing item/economy/event wrappers. Additive: no progress reset.
begin;
create table if not exists public.wakppu_skin_defs(
 skin_id text primary key,ball_id text not null,rank text not null,position integer not null unique,
 weight integer not null check(weight>=0),duplicate_shards integer not null check(duplicate_shards>0),exchange_shards integer not null check(exchange_shards>0));
insert into public.wakppu_skin_defs values
 ('eternity_common','eternity','common',0,7000,1,10),('eternity_rare','eternity','rare',1,2200,3,30),
 ('eternity_hero','eternity','hero',2,600,10,100),('eternity_legendary','eternity','legendary',3,190,30,300),
 ('eternity_transcendent','eternity','transcendent',4,10,100,1000)
on conflict(skin_id) do update set ball_id=excluded.ball_id,rank=excluded.rank,position=excluded.position,weight=excluded.weight,duplicate_shards=excluded.duplicate_shards,exchange_shards=excluded.exchange_shards;
create table if not exists public.wakppu_skins(
 user_id uuid primary key references public.players(user_id) on delete cascade,owned jsonb not null default '{}',equipped jsonb not null default '{}',
 shards bigint not null default 0 check(shards>=0),pity integer not null default 0 check(pity between 0 and 99),total bigint not null default 0,revision bigint not null default 0);
create table if not exists public.wakppu_skin_requests(user_id uuid references public.players(user_id) on delete cascade,request_id uuid not null,request jsonb not null,response jsonb not null,primary key(user_id,request_id));
alter table public.wakppu_skin_defs enable row level security;
alter table public.wakppu_skins enable row level security;
alter table public.wakppu_skin_requests enable row level security;
revoke all on public.wakppu_skin_defs,public.wakppu_skins,public.wakppu_skin_requests from public,anon,authenticated;
do $migration$ begin
 if to_regprocedure('public.wakppu_api_before_skins(jsonb)') is null then alter function public.wakppu_api(jsonb) rename to wakppu_api_before_skins;end if;
end $migration$;
revoke all on function public.wakppu_api_before_skins(jsonb) from public,anon,authenticated;
create or replace function public.wakppu_api(b jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $api$
declare u uuid:=auth.uid();a text:=b->>'action';g public.game_states%rowtype;s public.wakppu_skins%rowtype;d public.wakppu_skin_defs%rowtype;
 prior jsonb;result jsonb;cached public.wakppu_skin_requests%rowtype;fingerprint jsonb;rid uuid;roll bigint;duplicate boolean:=false;awarded integer:=0;cost numeric:=220000000000000000000;
begin
 if a is null or a not in ('skins','skin_draw','skin_equip','skin_exchange') then return public.wakppu_api_before_skins(b);end if;
 if u is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.';end if;
 -- Reuse existing account/maintenance/moderation/sleep checks. Never accept a user_id from the caller.
 prior:=public.wakppu_api_before_skins(jsonb_build_object('action','bootstrap'));
 select * into g from public.game_states where user_id=u for update;
 if not found then raise sqlstate 'PT401' using message='게임 계정을 다시 불러와주세요.';end if;
 insert into public.wakppu_skins(user_id) values(u) on conflict do nothing;
 select * into s from public.wakppu_skins where user_id=u for update;
 if a<>'skins' then
  if coalesce(b->>'request_id','')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception '잘못된 요청 ID';end if;
  rid:=(b->>'request_id')::uuid;
  fingerprint:=jsonb_build_object('action',a,'skin_id',b->'skin_id','ball_id',b->'ball_id','count',b->'count');
  select * into cached from public.wakppu_skin_requests where user_id=u and request_id=rid;
  if found then
   if cached.request<>fingerprint then raise exception '요청 ID 충돌';end if;return cached.response;
  end if;
  if (b->>'item_revision') is null or (b->>'item_revision')::bigint<>g.item_revision or (b->>'skin_revision') is null or (b->>'skin_revision')::bigint<>s.revision then raise sqlstate 'PT409' using message='스킨 상태가 변경되었습니다. 다시 불러와주세요.';end if;
  if a='skin_draw' then
   if coalesce((b->>'count')::integer,1)<>1 then raise exception '스킨 뽑기는 1회씩만 가능합니다.';end if;
   if g.gold<cost then raise exception 'Gold가 부족합니다.';end if;
   if s.pity=99 then select * into d from public.wakppu_skin_defs where skin_id='eternity_transcendent';
   else
    if (select sum(weight) from public.wakppu_skin_defs)<>10000 then raise exception '스킨 확률 설정 오류';end if;
    roll:=floor(('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint::numeric/4294967296*10000);
    select def.* into d from public.wakppu_skin_defs def join (select skin_id,sum(weight) over(order by position) as edge from public.wakppu_skin_defs) weights using(skin_id) where roll<weights.edge order by weights.edge limit 1;
   end if;
   if d.skin_id is null then raise exception '스킨 설정 오류';end if;
   duplicate:=s.owned?d.skin_id;
   if duplicate then awarded:=d.duplicate_shards;s.shards:=s.shards+awarded;else s.owned:=s.owned||jsonb_build_object(d.skin_id,true);end if;
   s.pity:=case when d.rank='transcendent' then 0 else s.pity+1 end;s.total:=s.total+1;g.gold:=g.gold-cost;
  elsif a='skin_exchange' then
   select * into d from public.wakppu_skin_defs where skin_id=b->>'skin_id';
   if not found or s.owned?d.skin_id then raise exception '교환할 미보유 스킨을 선택해주세요.';end if;
   if s.shards<d.exchange_shards then raise exception '스킨 조각이 부족합니다.';end if;
   s.shards:=s.shards-d.exchange_shards;s.owned:=s.owned||jsonb_build_object(d.skin_id,true);
  elsif a='skin_equip' then
   if b->>'ball_id'<>'eternity' or b->>'ball_id' is null then raise exception '대상 왁뿌볼 오류';end if;
   if b->>'skin_id' is null then s.equipped:=s.equipped-'eternity';
   else
    select * into d from public.wakppu_skin_defs where skin_id=b->>'skin_id' and ball_id=b->>'ball_id';
    if not found or not(s.owned?d.skin_id) then raise exception '보유한 전용 스킨만 장착할 수 있습니다.';end if;
    if not(g.unlocked_ball_ids?'eternity') then raise exception '영겁의 왁뿌볼을 먼저 해금해주세요.';end if;
    s.equipped:=s.equipped||jsonb_build_object(d.ball_id,d.skin_id);
   end if;
  end if;
  s.revision:=s.revision+1;g.item_revision:=g.item_revision+1;
  update public.game_states set gold=g.gold,item_revision=g.item_revision where user_id=u;
  update public.wakppu_skins set owned=s.owned,equipped=s.equipped,shards=s.shards,pity=s.pity,total=s.total,revision=s.revision where user_id=u;
 end if;
 result:=jsonb_build_object('owned',s.owned,'equipped',s.equipped,'shards',s.shards::text,'pity',s.pity,'total',s.total::text,'skin_revision',s.revision,'revision',g.item_revision,'gold',g.gold::text,'can_equip',g.unlocked_ball_ids?'eternity','price',cost::text);
 if a in ('skin_draw','skin_exchange') then result:=result||jsonb_build_object('result',jsonb_build_object('skin_id',d.skin_id,'duplicate',duplicate,'shards_awarded',awarded));end if;
 if a<>'skins' then insert into public.wakppu_skin_requests values(u,rid,fingerprint,result);end if;
 return result;
end $api$;
revoke all on function public.wakppu_api(jsonb) from public,anon;
-- Preserve anonymous status/rankings access in the existing wrapper; skin actions still require auth.uid().
grant execute on function public.wakppu_api(jsonb) to anon,authenticated;
commit;
