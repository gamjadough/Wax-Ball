begin;
create table public.wakppu_blue_gem_boosts(
 user_id uuid primary key references public.players(user_id) on delete cascade,
 stock integer not null default 0 check(stock>=0),expires_at timestamptz,admin_expires_at timestamptz);
create table public.wakppu_blue_gem_boost_requests(
 user_id uuid references public.players(user_id) on delete cascade,request_id uuid,
 fingerprint jsonb not null,response jsonb not null,primary key(user_id,request_id));
alter table public.wakppu_blue_gem_boosts enable row level security;
alter table public.wakppu_blue_gem_boost_requests enable row level security;
revoke all on public.wakppu_blue_gem_boosts,public.wakppu_blue_gem_boost_requests from public,anon,authenticated;
create function public.wakppu_blue_gem_boost_snapshot(u uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.wakppu_blue_gem_boosts%rowtype;access boolean;expiry timestamptz;
begin
 if u is null or u is distinct from auth.uid() then raise sqlstate 'PT403';end if;
 access:=public.wakppu_admin_content_access();select * into p from public.wakppu_blue_gem_boosts where user_id=u;
 expiry:=greatest(p.expires_at,case when access then p.admin_expires_at end);
 return jsonb_build_object('item_id','blue_gem_boost','price','100','seconds',600,'multiplier',2,
 'stock',case when access then greatest(coalesce(p.stock,0),1) else coalesce(p.stock,0) end,
 'expires_at',coalesce(floor(extract(epoch from expiry)*1000),0),
 'active_multiplier',case when expiry>clock_timestamp() then 2 else 1 end,'admin_access',access);
end $$;
create function public.wakppu_blue_gem_boost_multiplier(u uuid) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
begin return (public.wakppu_blue_gem_boost_snapshot(u)->>'active_multiplier')::integer;end $$;
revoke all on function public.wakppu_blue_gem_boost_snapshot(uuid),public.wakppu_blue_gem_boost_multiplier(uuid) from public,anon,authenticated;
alter function public.wakppu_blue_gem_snapshot(uuid) rename to wakppu_blue_gem_snapshot_before_boost;
revoke all on function public.wakppu_blue_gem_snapshot_before_boost(uuid) from public,anon,authenticated;
create function public.wakppu_blue_gem_snapshot(u uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin return public.wakppu_blue_gem_snapshot_before_boost(u)||jsonb_build_object('boost',public.wakppu_blue_gem_boost_snapshot(u));end $$;
revoke all on function public.wakppu_blue_gem_snapshot(uuid) from public,anon,authenticated;
-- Preserve all later Gold/event wrappers; change only the original ordinary-gem award.
do $patch$
declare f record;body text;n integer:=0;
begin
 for f in select p.oid from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname='public'
 and p.prosrc like '%wakppu_blue_gem_exclusions%' and p.prosrc like '%balance=balance+1%' loop
  body:=pg_get_functiondef(f.oid);body:=replace(body,'balance=balance+1','balance=balance+public.wakppu_blue_gem_boost_multiplier(u)');execute body;n:=n+1;
 end loop;
 if n<>1 then raise exception 'Expected one ordinary gem reward hook, found %',n;end if;
 body:=pg_get_functiondef('public.wakppu_gem_ball_hit(jsonb)'::regprocedure);
 if position('rid uuid;hits bigint;' in body)=0 or position('balance=balance+d.gem_reward' in body)=0 then raise exception 'Gem hit anchors missing';end if;
 body:=replace(body,'rid uuid;hits bigint;','rid uuid;hits bigint;boost_reward numeric:=0;');
 body:=replace(body,'if hits=d.clicks then','if hits=d.clicks then boost_reward:=d.gem_reward*public.wakppu_blue_gem_boost_multiplier(u);');
 body:=replace(body,'balance=balance+d.gem_reward','balance=balance+boost_reward');
 body:=replace(body,'then d.gem_reward::text','then boost_reward::text');execute body;
end $patch$;
create function public.wakppu_blue_gem_boost_items(u uuid,r jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare boost jsonb:=public.wakppu_blue_gem_boost_snapshot(u);
begin
 if r ? 'inventory' then
  r:=jsonb_set(r,'{inventory}',coalesce(r->'inventory','{}')||jsonb_build_object('blue_gem_boost',boost->'stock'));
  if (boost->>'active_multiplier')::integer=2 then r:=jsonb_set(r,'{effects}',coalesce(r->'effects','{}')||jsonb_build_object('blue_gem_boost',jsonb_build_object('expires_at',boost->'expires_at')));end if;
 end if;
 if r ? 'blue_gems' then r:=jsonb_set(r,'{blue_gems}',public.wakppu_blue_gem_snapshot(u));end if;
 return r;
end $$;
revoke all on function public.wakppu_blue_gem_boost_items(uuid,jsonb) from public,anon,authenticated;
alter function public.wakppu_api(jsonb) rename to wakppu_api_before_gem_boost;
revoke all on function public.wakppu_api_before_gem_boost(jsonb) from public,anon,authenticated;
create function public.wakppu_api(b jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid();action text:=b->>'action';r jsonb;s public.game_states%rowtype;g public.wakppu_blue_gems%rowtype;
 p public.wakppu_blue_gem_boosts%rowtype;cached public.wakppu_blue_gem_boost_requests%rowtype;rid uuid;fp jsonb:=b-'request_id';expiry timestamptz;access boolean;
begin
 if action='blue_gem_boost_buy' or (action='item_use' and b->>'item_id'='blue_gem_boost') then
  if u is null then raise sqlstate 'PT401';end if;
  -- Existing friend gate, bans, maintenance and authentication stay authoritative.
  perform public.wakppu_api_before_gem_boost('{"action":"bootstrap"}');
  if (action='blue_gem_boost_buy' and b-array['action','request_id','item_revision','gem_revision']<>'{}'::jsonb)
   or (action='item_use' and b-array['action','item_id','request_id','item_revision']<>'{}'::jsonb) then raise sqlstate 'PT403';end if;
  if coalesce(b->>'request_id','') !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then raise sqlstate 'PT400';end if;
  rid:=(b->>'request_id')::uuid;
  select * into s from public.game_states where user_id=u for update;
  select * into cached from public.wakppu_blue_gem_boost_requests where user_id=u and request_id=rid;
  if found then if cached.fingerprint<>fp then raise sqlstate 'PT409';end if;return cached.response;end if;
  if (b->>'item_revision')::bigint is distinct from s.item_revision then raise sqlstate 'PT409';end if;
  insert into public.wakppu_blue_gems(user_id) values(u) on conflict do nothing;
  select * into g from public.wakppu_blue_gems where user_id=u for update;
  insert into public.wakppu_blue_gem_boosts(user_id) values(u) on conflict do nothing;
  select * into p from public.wakppu_blue_gem_boosts where user_id=u for update;
  access:=public.wakppu_admin_content_access();
  if action='blue_gem_boost_buy' then
   if access then raise sqlstate 'PT409' using message='관리자는 인벤토리에서 바로 사용할 수 있습니다.';end if;
   if (b->>'gem_revision')::bigint is distinct from g.revision then raise sqlstate 'PT409';end if;
   if g.balance<100 then raise sqlstate 'PT400' using message='푸른젬이 부족합니다.';end if;
   update public.wakppu_blue_gems set balance=balance-100 where user_id=u;
   update public.wakppu_blue_gem_boosts set stock=stock+1 where user_id=u;
  else
   if not access and p.stock<1 then raise sqlstate 'PT403' using message='보유한 아이템이 없습니다.';end if;
   expiry:=greatest(clock_timestamp(),p.expires_at,case when access then p.admin_expires_at end)+interval '10 minutes';
   if expiry>clock_timestamp()+interval '7 days' then raise sqlstate 'PT400' using message='최대 연장 시간은 7일입니다.';end if;
   if access then update public.wakppu_blue_gem_boosts set admin_expires_at=expiry where user_id=u;
   else update public.wakppu_blue_gem_boosts set expires_at=expiry,stock=stock-1 where user_id=u;end if;
  end if;
  update public.wakppu_blue_gems set revision=revision+1 where user_id=u;
  update public.game_states set item_revision=item_revision+1 where user_id=u;
  r:=public.wakppu_blue_gem_boost_items(u,public.wakppu_api_before_gem_boost('{"action":"items"}'));
  insert into public.wakppu_blue_gem_boost_requests values(u,rid,fp,r);return r;
 end if;
 r:=public.wakppu_api_before_gem_boost(b);
 if u is not null and jsonb_typeof(r)='object' and (r ? 'inventory' or r ? 'blue_gems') then r:=public.wakppu_blue_gem_boost_items(u,r);end if;
 return r;
end $$;
revoke all on function public.wakppu_api(jsonb) from public;
grant execute on function public.wakppu_api(jsonb) to anon,authenticated;
commit;
