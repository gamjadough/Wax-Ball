begin;
create table public.wakppu_blue_gem_products(
 level integer primary key check(level>0),price numeric not null check(price>0 and price=trunc(price)),
 multiplier numeric not null check(multiplier>1 and multiplier=trunc(multiplier)));
insert into public.wakppu_blue_gem_products values
 (1,1000,2),(2,10000,5),(3,100000,10),(4,1000000,100),(5,10000000,1000),(6,1000000000000000,1000000),(7,1e39,1000000000);
create table public.wakppu_blue_gems(
 user_id uuid primary key references public.players(user_id) on delete cascade,
 balance numeric not null default 0 check(balance>=0 and balance=trunc(balance)),
 level integer not null default 0 check(level>=0),admin_level integer not null default 0 check(admin_level>=0),
 revision bigint not null default 0 check(revision>=0));
-- Future gem-purchased balls must register here to disable their ordinary +1 drop.
create table public.wakppu_blue_gem_exclusions(ball_id text primary key);
create table public.wakppu_blue_gem_requests(
 user_id uuid references public.players(user_id) on delete cascade,request_id uuid,level integer not null,
 response jsonb not null,primary key(user_id,request_id));
alter table public.wakppu_blue_gem_products enable row level security;
alter table public.wakppu_blue_gems enable row level security;
alter table public.wakppu_blue_gem_exclusions enable row level security;
alter table public.wakppu_blue_gem_requests enable row level security;
revoke all on public.wakppu_blue_gem_products,public.wakppu_blue_gems,public.wakppu_blue_gem_exclusions,public.wakppu_blue_gem_requests from public,anon,authenticated;
create function public.wakppu_blue_gem_snapshot(u uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $s$
declare g public.wakppu_blue_gems%rowtype;access boolean;chosen integer;
begin
 if u is null or u is distinct from auth.uid() then raise sqlstate 'PT403';end if;
 select * into g from public.wakppu_blue_gems where user_id=u;
 access:=public.wakppu_admin_content_access();chosen:=greatest(coalesce(g.level,0),case when access then coalesce(g.admin_level,0) else 0 end);
 return jsonb_build_object('balance',coalesce(g.balance,0)::text,'level',chosen,'revision',coalesce(g.revision,0),
  'multiplier',coalesce((select multiplier from public.wakppu_blue_gem_products where level=chosen),1)::text,'admin_access',access,
  'catalog',(select jsonb_agg(jsonb_build_object('level',level,'price',price::text,'multiplier',multiplier::text) order by level) from public.wakppu_blue_gem_products));
end $s$;
revoke all on function public.wakppu_blue_gem_snapshot(uuid) from public,anon,authenticated;
-- Runs inside each existing break transaction, BEFORE reward/request responses are cached.
alter function public.wakppu_supporter_reward(uuid,numeric) rename to wakppu_supporter_reward_before_blue_gems;
revoke all on function public.wakppu_supporter_reward_before_blue_gems(uuid,numeric) from public,anon,authenticated;
create function public.wakppu_supporter_reward(u uuid,base numeric) returns numeric
language plpgsql set search_path=public,pg_temp as $r$
declare paid numeric;chosen integer;factor numeric;
begin
 paid:=public.wakppu_supporter_reward_before_blue_gems(u,base);
 if paid<=0 then return paid;end if;
 perform 1 from public.game_states where user_id=u for update;
 insert into public.wakppu_blue_gems(user_id) values(u) on conflict do nothing;
 if not exists(select 1 from public.wakppu_blue_gem_exclusions where ball_id=current_setting('wakppu.blue_gem_ball',true)) then
  update public.wakppu_blue_gems set balance=balance+1,revision=revision+1 where user_id=u;
 end if;
 select greatest(level,case when public.wakppu_admin_content_access() then admin_level else 0 end) into chosen from public.wakppu_blue_gems where user_id=u;
 select multiplier into factor from public.wakppu_blue_gem_products where level=chosen;
 return paid*coalesce(factor,1);
end $r$;
revoke all on function public.wakppu_supporter_reward(uuid,numeric) from public,anon,authenticated;
alter function public.wakppu_api(jsonb) rename to wakppu_api_before_blue_gems;
revoke all on function public.wakppu_api_before_blue_gems(jsonb) from public,anon,authenticated;
create function public.wakppu_api(b jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $api$
declare u uuid:=auth.uid();a text:=b->>'action';r jsonb;g public.wakppu_blue_gems%rowtype;
 p public.wakppu_blue_gem_products%rowtype;cached public.wakppu_blue_gem_requests%rowtype;rid uuid;chosen integer;access boolean;
begin
 if a in ('blue_gems','blue_gem_buy') then
  if u is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.';end if;
  perform public.wakppu_api_before_blue_gems('{"action":"bootstrap"}');
  if b ?| array['user_id','target_user_id','balance','price','multiplier'] then raise sqlstate 'PT403' using message='서버가 가격과 재화를 결정합니다.';end if;
  if a='blue_gems' then return public.wakppu_blue_gem_snapshot(u);end if;
  if coalesce(b->>'request_id','') !~ '^[a-fA-F0-9]{8}(-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}$' or coalesce(b->>'level','') !~ '^[1-9][0-9]{0,3}$'
   or coalesce(b->>'gem_revision','') !~ '^[0-9]{1,18}$' then raise sqlstate 'PT400' using message='잘못된 구매 요청입니다.';end if;
  rid:=(b->>'request_id')::uuid;
  perform 1 from public.game_states where user_id=u for update;
  insert into public.wakppu_blue_gems(user_id) values(u) on conflict do nothing;
  select * into cached from public.wakppu_blue_gem_requests where user_id=u and request_id=rid;
  if found then
   if cached.level<>(b->>'level')::integer then raise sqlstate 'PT409' using message='다른 상품에서 사용한 요청입니다.';end if;
   return cached.response;
  end if;
  select * into g from public.wakppu_blue_gems where user_id=u for update;
  if g.revision<>(b->>'gem_revision')::bigint then raise sqlstate 'PT409' using message='푸른젬 상태가 바뀌었습니다. 다시 확인해주세요.';end if;
  select * into p from public.wakppu_blue_gem_products where level=(b->>'level')::integer;
  if not found then raise sqlstate 'PT400' using message='없는 상품입니다.';end if;
  access:=public.wakppu_admin_content_access();chosen:=greatest(g.level,case when access then g.admin_level else 0 end);
  if p.level<=chosen then raise sqlstate 'PT409' using message='이미 같거나 높은 배율을 보유하고 있습니다.';end if;
  if not access and g.balance<p.price then raise sqlstate 'PT400' using message='푸른젬이 부족합니다.';end if;
  update public.wakppu_blue_gems set balance=balance-case when access then 0 else p.price end,
   level=case when access then level else p.level end,admin_level=case when access then p.level else admin_level end,revision=revision+1 where user_id=u;
  r:=public.wakppu_blue_gem_snapshot(u);
  insert into public.wakppu_blue_gem_requests values(u,rid,p.level,r);
  return r;
 end if;
 if a in ('item_hit','event_ball_hit','limited_hit') then
  perform set_config('wakppu.blue_gem_ball',case when a='limited_hit' then 'halloween-pumpkin-2026'
   when a='event_ball_hit' or b ? 'event_id' then 'admin-event'
   else coalesce((select selected_ball_id from public.game_states where user_id=u),'') end,true);
 end if;
 r:=public.wakppu_api_before_blue_gems(b);
 if u is not null and (a in ('item_hit','event_ball_hit','limited_hit','bootstrap','items','save_progress') or a like 'auto_rebirth_%') then
  r:=r||jsonb_build_object('blue_gems',public.wakppu_blue_gem_snapshot(u));
 end if;
 return r;
end $api$;
revoke all on function public.wakppu_api(jsonb) from public;
grant execute on function public.wakppu_api(jsonb) to anon,authenticated;
commit;
