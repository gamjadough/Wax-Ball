-- Server-owned custom cosmetics. Existing gameplay, receipt confirmation and reward APIs stay intact.
begin;
insert into public.wakppu_purchase_products(id,name,amount,description) values
 ('custom_ball_single','커스텀 왁뿌볼 · 단일',30000,'선택한 보유 볼 1종 · 이미지 자유 교체 · 보유 연출·사운드 조합 · 능력치 변화 없음'),
 ('custom_ball_all','커스텀 왁뿌볼 · 전체',50000,'보유한 모든 볼·추후 해금 볼에 적용 · 볼별 저장·전체 공통 적용 · 단일 상품 보유 시 차액 20,000원')
on conflict(id) do update set name=excluded.name,amount=excluded.amount,description=excluded.description;
alter table public.wakppu_purchase_orders add column if not exists custom_target text;
alter table public.wakppu_purchase_orders add column if not exists custom_upgrade_order_id uuid references public.wakppu_purchase_orders(id);
create index if not exists wakppu_custom_upgrade_idx on public.wakppu_purchase_orders(custom_upgrade_order_id) where custom_upgrade_order_id is not null;
create table if not exists public.wakppu_custom_accounts(user_id uuid primary key references public.players(user_id) on delete cascade,revision bigint not null default 0,last_save timestamptz,upload_window timestamptz,upload_count integer not null default 0);
create table if not exists public.wakppu_custom_assets(id uuid primary key,user_id uuid not null references public.players(user_id) on delete cascade,path text not null unique,sha256 text not null check(sha256~'^[0-9a-f]{64}$'),bytes integer not null check(bytes between 1 and 1200000),created_at timestamptz not null default clock_timestamp());
create index if not exists wakppu_custom_assets_owner_idx on public.wakppu_custom_assets(user_id);
create table if not exists public.wakppu_custom_profiles(user_id uuid references public.players(user_id) on delete cascade,target text not null,asset_id uuid references public.wakppu_custom_assets(id),effect text,sound text,disabled boolean not null default false,primary key(user_id,target),check(disabled or(asset_id is not null and effect is not null and sound is not null)));
create index if not exists wakppu_custom_profiles_asset_idx on public.wakppu_custom_profiles(asset_id) where asset_id is not null;
create table if not exists public.wakppu_custom_requests(user_id uuid references public.players(user_id) on delete cascade,request_id uuid,request jsonb not null,created_at timestamptz not null default clock_timestamp(),primary key(user_id,request_id));
create table if not exists public.wakppu_custom_gc(path text primary key,created_at timestamptz not null default clock_timestamp());
alter table public.wakppu_custom_accounts enable row level security;alter table public.wakppu_custom_assets enable row level security;alter table public.wakppu_custom_profiles enable row level security;alter table public.wakppu_custom_requests enable row level security;alter table public.wakppu_custom_gc enable row level security;
revoke all on public.wakppu_custom_accounts,public.wakppu_custom_assets,public.wakppu_custom_profiles,public.wakppu_custom_requests,public.wakppu_custom_gc from public,anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('wakppu-custom','wakppu-custom',false,1200000,array['image/png']) on conflict(id) do update set public=false,file_size_limit=1200000,allowed_mime_types=array['image/png'];
drop policy if exists wakppu_custom_service_only on storage.objects;
create policy wakppu_custom_service_only on storage.objects as restrictive for all to anon,authenticated using(bucket_id<>'wakppu-custom') with check(bucket_id<>'wakppu-custom');

create or replace function public.wakppu_custom_known(t text) returns boolean language sql stable set search_path=public,pg_temp as $$
 select coalesce(exists(select 1 from public.wakppu_item_balls where ball_id=t) or t in('admin-event','halloween-pumpkin-2026'),false);$$;
create or replace function public.wakppu_custom_owned(u uuid,t text) returns boolean language plpgsql set search_path=public,pg_temp as $$
declare e jsonb;begin
 if not public.wakppu_custom_known(t) then return false;end if;
 if public.wakppu_admin_content_access() then return true;end if;
 if t='halloween-pumpkin-2026' then return exists(select 1 from public.wakppu_limited_players where user_id=u and owned?t);end if;
 if t='admin-event' then
  e:=public.wakppu_api_before_custom_studio('{"action":"status"}')->'admin_ball_event';
  return coalesce(e is not null and clock_timestamp()>=(e->>'starts_at')::timestamptz and clock_timestamp()<(e->>'ends_at')::timestamptz,false);
 end if;
 return exists(select 1 from public.game_states where user_id=u and unlocked_ball_ids?t);
end$$;
create or replace function public.wakppu_custom_preset(u uuid,t text) returns boolean language sql stable set search_path=public,pg_temp as $$
 select public.wakppu_custom_known(t) or (t like 'skin:%' and exists(select 1 from public.wakppu_skin_defs d where d.skin_id='eternity_'||substr(t,6)) and(public.wakppu_admin_content_access() or exists(select 1 from public.wakppu_skins where user_id=u and owned?('eternity_'||substr(t,6)))))
 or(t like 'pumpkin:%' and exists(select 1 from public.wakppu_pumpkin_skin_defs d where d.skin_id='pumpkin_'||substr(t,9)) and(public.wakppu_admin_content_access() or exists(select 1 from public.wakppu_skins where user_id=u and owned?('pumpkin_'||substr(t,9)))));$$;
create or replace function public.wakppu_custom_snapshot(u uuid) returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare plan text:='none';bound_ball text;settings jsonb;balls jsonb;presets jsonb;begin
 if u is null or u is distinct from auth.uid() then raise sqlstate 'PT401';end if;
 if public.wakppu_admin_content_access() or exists(select 1 from public.wakppu_purchase_entitlements where user_id=u and product_id='custom_ball_all') then plan:='all';
 else select o.custom_target into bound_ball from public.wakppu_purchase_entitlements e join public.wakppu_purchase_orders o on o.id=e.order_id where e.user_id=u and e.product_id='custom_ball_single';if found then plan:='single';end if;end if;
 select coalesce(jsonb_agg(t),'[]') into balls from(select ball_id t from public.wakppu_item_balls union select 'admin-event' union select 'halloween-pumpkin-2026') c where public.wakppu_custom_owned(u,t);
 select coalesce(jsonb_agg(t),'[]') into presets from(select ball_id t from public.wakppu_item_balls union select 'admin-event' union select 'halloween-pumpkin-2026' union select 'skin:'||substr(skin_id,10) from public.wakppu_skin_defs union select 'pumpkin:'||substr(skin_id,9) from public.wakppu_pumpkin_skin_defs)c where public.wakppu_custom_preset(u,t);
 select coalesce(jsonb_object_agg(p.target,jsonb_build_object('asset_id',p.asset_id,'effect',p.effect,'sound',p.sound,'disabled',p.disabled)),'{}') into settings from public.wakppu_custom_profiles p where p.user_id=u and(plan='all' or(plan='single' and p.target in(bound_ball,'@all')));
 return jsonb_build_object('plan',plan,'target',bound_ball,'revision',coalesce((select revision from public.wakppu_custom_accounts where user_id=u),0),'global',settings->'@all','profiles',settings-'@all','balls',balls,'presets',presets,'admin_access',public.wakppu_admin_content_access());
end$$;
-- Entitlement insert/delete hooks enforce cross-product exclusivity and refund dependencies.
create or replace function public.wakppu_custom_entitlement() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare o public.wakppu_purchase_orders;src uuid;who uuid;product text;begin
 if tg_op='INSERT' then who:=new.user_id;product:=new.product_id;else who:=old.user_id;product:=old.product_id;end if;
 if product not in('custom_ball_single','custom_ball_all') then if tg_op='INSERT' then return new;else return old;end if;end if;
 perform pg_advisory_xact_lock(hashtextextended(who::text,19));
 if tg_op='INSERT' then
  select * into o from public.wakppu_purchase_orders where id=new.order_id and user_id=who and product_id=product and status='approved';if not found then raise sqlstate 'PT409';end if;
  if product='custom_ball_single' then
   if exists(select 1 from public.wakppu_purchase_entitlements where user_id=who and product_id in('custom_ball_single','custom_ball_all')) then raise sqlstate 'PT409' using message='이미 커스텀 이용권을 보유하고 있습니다.';end if;
   if o.custom_target is null and o.source='admin_grant' then select selected_ball_id into o.custom_target from public.game_states where user_id=who;update public.wakppu_purchase_orders set custom_target=o.custom_target where id=o.id;end if;
   if not public.wakppu_custom_known(o.custom_target) then raise sqlstate 'PT400' using message='적용 대상 볼을 확인하세요.';end if;
  else
   select order_id into src from public.wakppu_purchase_entitlements where user_id=who and product_id='custom_ball_single';
   if exists(select 1 from public.wakppu_purchase_entitlements where user_id=who and product_id='custom_ball_all') then raise sqlstate 'PT409';end if;
   if o.custom_upgrade_order_id is not null and o.custom_upgrade_order_id is distinct from src then raise sqlstate 'PT409' using message='업그레이드에 필요한 단일 이용권이 없습니다. 입금 내역을 확인하세요.';end if;
   if o.source='bank' and src is not null and o.custom_upgrade_order_id is null then raise sqlstate 'PT409' using message='단일 이용권을 이미 보유하고 있습니다. 주문 금액을 확인하세요.';end if;
  end if;
  return new;
 end if;
 if product='custom_ball_single' and current_setting('wakppu.custom_discard',true) is distinct from who::text and exists(select 1 from public.wakppu_purchase_entitlements e join public.wakppu_purchase_orders q on q.id=e.order_id where e.user_id=who and q.custom_upgrade_order_id=old.order_id) then raise sqlstate 'PT409' using message='이 이용권으로 업그레이드한 전체 상품을 먼저 회수·환불하세요.';end if;
 return old;
end$$;
drop trigger if exists wakppu_custom_entitlement on public.wakppu_purchase_entitlements;
create trigger wakppu_custom_entitlement before insert or delete on public.wakppu_purchase_entitlements for each row execute function public.wakppu_custom_entitlement();
create or replace function public.wakppu_custom_asset_retire() returns trigger language plpgsql set search_path=public,pg_temp as $$begin insert into public.wakppu_custom_gc(path) values(old.path) on conflict do nothing;return old;end$$;
drop trigger if exists wakppu_custom_asset_retire on public.wakppu_custom_assets;
create trigger wakppu_custom_asset_retire before delete on public.wakppu_custom_assets for each row execute function public.wakppu_custom_asset_retire();

do $admin_snapshot$ declare body text;begin
 body:=pg_get_functiondef('public.wakppu_admin_paid_snapshot(uuid)'::regprocedure);
 if position('custom_upgrade_order_id' in body)=0 then execute replace(body,'where q.supporter_upgrade_order_id=o.id','where (q.supporter_upgrade_order_id=o.id or q.custom_upgrade_order_id=o.id)');end if;
end $admin_snapshot$;

-- Only the authenticated image Edge Function's service connection may commit validated PNGs.
create or replace function public.wakppu_custom_commit(u uuid,b jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare s jsonb;expected bigint;rid uuid;fp jsonb;cached jsonb;t text;asset uuid;path text;img boolean;anonymous boolean;begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise sqlstate 'PT403';end if;
 select is_anonymous into anonymous from auth.users where id=u;if not found then raise sqlstate 'PT401';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,19));
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',anonymous)::text,true);
 perform public.wakppu_api_before_custom_studio('{"action":"bootstrap"}');
 if b?'user_id' then raise sqlstate 'PT400';end if;
 rid:=(b->>'request_id')::uuid;if rid is null then raise sqlstate 'PT400';end if;
 fp:=b-'path';select request into cached from public.wakppu_custom_requests where user_id=u and request_id=rid;
 if found then if cached is distinct from fp then raise sqlstate 'PT409' using message='같은 저장 요청을 변경할 수 없습니다.';end if;return public.wakppu_custom_snapshot(u);end if;
 s:=public.wakppu_custom_snapshot(u);t:=b->>'target';
 if s->>'plan'='none' or not(t='@all' and s->>'plan'='all' or public.wakppu_custom_owned(u,t) and(s->>'plan'='all' or s->>'target'=t)) then raise sqlstate 'PT403' using message='이 볼에 적용할 이용권과 해금 상태를 확인하세요.';end if;
 insert into public.wakppu_custom_accounts(user_id) values(u) on conflict do nothing;
 select revision into expected from public.wakppu_custom_accounts where user_id=u for update;
 if (b->>'revision')::bigint is distinct from expected then raise sqlstate 'PT409' using message='다른 창에서 설정이 변경되었습니다. 다시 불러오세요.';end if;
 if(select count(*) from public.wakppu_custom_requests where user_id=u and created_at>clock_timestamp()-interval '1 minute')>=30 then raise sqlstate 'PT429' using message='저장이 너무 잦습니다. 잠시 후 다시 시도해주세요.';end if;
 if b->>'mode'='restore' then
  if t='@all' then delete from public.wakppu_custom_profiles where user_id=u;
  else insert into public.wakppu_custom_profiles(user_id,target,disabled) values(u,t,true) on conflict(user_id,target) do update set asset_id=null,effect=null,sound=null,disabled=true;end if;
 elsif b->>'mode'='save' then
  if public.wakppu_custom_preset(u,b->>'effect') is not true or public.wakppu_custom_preset(u,b->>'sound') is not true then raise sqlstate 'PT403' using message='보유한 연출과 사운드만 선택할 수 있습니다.';end if;
  img:=coalesce((b->>'new_image')::boolean,false);
  if img then
   asset:=rid;path:=u::text||'/'||rid::text||'.png';if b->>'path' is distinct from path then raise sqlstate 'PT400';end if;
   insert into public.wakppu_custom_assets(id,user_id,path,sha256,bytes) values(asset,u,path,b->>'sha256',(b->>'bytes')::integer);
  else asset:=(b->>'asset_id')::uuid;if not exists(select 1 from public.wakppu_custom_assets where id=asset and user_id=u) then raise sqlstate 'PT403';end if;end if;
  if t='@all' then delete from public.wakppu_custom_profiles where user_id=u;end if;
  insert into public.wakppu_custom_profiles(user_id,target,asset_id,effect,sound) values(u,t,asset,b->>'effect',b->>'sound') on conflict(user_id,target) do update set asset_id=excluded.asset_id,effect=excluded.effect,sound=excluded.sound,disabled=false;
 else raise sqlstate 'PT400';end if;
 update public.wakppu_custom_accounts set revision=revision+1,last_save=clock_timestamp() where user_id=u;
 delete from public.wakppu_custom_assets a where a.user_id=u and not exists(select 1 from public.wakppu_custom_profiles p where p.asset_id=a.id);
 if(select coalesce(sum(bytes),0) from public.wakppu_custom_assets where user_id=u)>33554432 then raise sqlstate 'PT413' using message='이미지 저장 용량을 초과했습니다. 사용하지 않는 커스텀을 복원해주세요.';end if;
 insert into public.wakppu_custom_requests(user_id,request_id,request) values(u,rid,fp);
 delete from public.wakppu_custom_requests where user_id=u and request_id in(select request_id from public.wakppu_custom_requests where user_id=u order by created_at desc offset 64);
 return public.wakppu_custom_snapshot(u);
end$$;
create or replace function public.wakppu_custom_gc_batch(paths text[] default null) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise sqlstate 'PT403';end if;
 if paths is not null then delete from public.wakppu_custom_gc where path=any(paths);end if;
 return(select coalesce(jsonb_agg(path),'[]') from(select path from public.wakppu_custom_gc order by created_at limit 32)s);
end$$;

do $wrap$ begin if to_regprocedure('public.wakppu_api_before_custom_studio(jsonb)') is null then alter function public.wakppu_api(jsonb) rename to wakppu_api_before_custom_studio;end if;end $wrap$;
revoke all on function public.wakppu_api_before_custom_studio(jsonb) from public,anon,authenticated;
create or replace function public.wakppu_api(b jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a text:=b->>'action';u uuid:=auth.uid();c public.wakppu_purchase_config;p public.wakppu_purchase_products;o public.wakppu_purchase_orders;src uuid;rid uuid;price integer;s jsonb;r jsonb;target text;paths jsonb;begin
 if a='guest_discard' then perform set_config('wakppu.custom_discard',u::text,true);r:=public.wakppu_api_before_custom_studio(b);perform set_config('wakppu.custom_discard','',true);return r;end if;
 if a in('custom_status','custom_image_paths','custom_prepare') or(a='purchase_order' and b->>'product_id' in('custom_ball_single','custom_ball_all')) then
  if u is null then raise sqlstate 'PT401';end if;perform pg_advisory_xact_lock(hashtextextended(u::text,19));perform public.wakppu_api_before_custom_studio('{"action":"bootstrap"}');
  if b?'user_id' then raise sqlstate 'PT400';end if;
  s:=public.wakppu_custom_snapshot(u);
  if a='custom_status' then return s;end if;
  if a='custom_prepare' then
   if s->>'plan'='none' then raise sqlstate 'PT403';end if;
   if not exists(select 1 from public.wakppu_custom_requests where user_id=u and request_id=(b->>'request_id')::uuid) and (b->>'revision')::bigint is distinct from(s->>'revision')::bigint then raise sqlstate 'PT409' using message='다른 창에서 설정이 변경되었습니다. 다시 불러오세요.';end if;
   insert into public.wakppu_custom_accounts(user_id) values(u) on conflict do nothing;
   update public.wakppu_custom_accounts set upload_count=case when upload_window>clock_timestamp()-interval '1 minute' then upload_count+1 else 1 end,upload_window=case when upload_window>clock_timestamp()-interval '1 minute' then upload_window else clock_timestamp() end where user_id=u;
   if(select upload_count from public.wakppu_custom_accounts where user_id=u)>60 then raise sqlstate 'PT429' using message='이미지 요청이 너무 잦습니다. 잠시 후 시도해주세요.';end if;
   return jsonb_build_object('ok',true);
  end if;

  if a='custom_image_paths' then
   select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'path',x.path)),'[]') into paths from public.wakppu_custom_assets x where x.user_id=u and exists(select 1 from public.wakppu_custom_profiles f where f.user_id=u and f.asset_id=x.id and not f.disabled and public.wakppu_custom_preset(u,f.effect) and public.wakppu_custom_preset(u,f.sound) and(s->>'plan'='all' or s->>'plan'='single' and f.target in(s->>'target','@all')));
   return paths;
  end if;
  if not exists(select 1 from auth.users where id=u and not is_anonymous and email_confirmed_at is not null and coalesce(email,'')<>'') then raise sqlstate 'PT403' using message='이메일 인증 후 주문할 수 있습니다.';end if;
  rid:=(b->>'request_id')::uuid;if rid is null then raise sqlstate 'PT400';end if;
  select * into o from public.wakppu_purchase_orders where user_id=u and request_id=rid;
  if found then if o.product_id is distinct from b->>'product_id' or o.depositor is distinct from trim(b->>'depositor') or o.product_id='custom_ball_single' and o.custom_target is distinct from b->>'target' then raise sqlstate 'PT409';end if;return public.wakppu_purchase_snapshot(u)||jsonb_build_object('order',to_jsonb(o));end if;
  select * into c from public.wakppu_purchase_config where id for share;if not c.enabled then raise sqlstate 'PT409' using message='현재 새 주문을 받고 있지 않습니다.';end if;
  select * into p from public.wakppu_purchase_products where id=b->>'product_id';price:=p.amount;
  if s->>'plan'='all' or(p.id='custom_ball_single' and s->>'plan'='single') then raise sqlstate 'PT409' using message='이미 이용권을 보유하고 있습니다.';end if;
  if p.id='custom_ball_all' then select order_id into src from public.wakppu_purchase_entitlements where user_id=u and product_id='custom_ball_single';if src is not null then price:=20000;end if;
  else target:=b->>'target';if not public.wakppu_custom_owned(u,target) then raise sqlstate 'PT403' using message='보유한 적용 대상 볼을 선택하세요.';end if;end if;
  if b?'amount' and(b->>'amount')::integer is distinct from price then raise sqlstate 'PT400' using message='상품 금액이 일치하지 않습니다.';end if;
  if length(trim(coalesce(b->>'depositor','')))<2 or length(trim(b->>'depositor'))>30 then raise sqlstate 'PT400';end if;
  select * into o from public.wakppu_purchase_orders where user_id=u and product_id in('custom_ball_single','custom_ball_all') and status in('pending','claimed') order by created_at desc limit 1;
  if found then if o.product_id<>p.id or o.custom_target is distinct from target then raise sqlstate 'PT409' using message='기존 커스텀 주문을 먼저 확인·취소해주세요.';end if;return public.wakppu_purchase_snapshot(u)||jsonb_build_object('order',to_jsonb(o));end if;
  insert into public.wakppu_purchase_orders(user_id,request_id,product_id,product_name,amount,depositor,bank,custom_target,custom_upgrade_order_id) values(u,rid,p.id,p.name,price,trim(b->>'depositor'),to_jsonb(c)-'id'-'revision'-'enabled',target,src) returning * into o;
  return public.wakppu_purchase_snapshot(u)||jsonb_build_object('order',to_jsonb(o));
 end if;
 r:=public.wakppu_api_before_custom_studio(b);
 if a='purchase_catalog' then
  s:=public.wakppu_custom_snapshot(u);
  r:=r||jsonb_build_object('custom',s,'products',(select jsonb_agg(case when x->>'id'='custom_ball_all' and s->>'plan'='single' then x||'{"amount":20000}'::jsonb else x end order by (x->>'amount')::integer) from jsonb_array_elements(r->'products')x));
 end if;
 if a='admin_purchase_orders' then r:=jsonb_set(r,'{orders}',(select coalesce(jsonb_agg(x||jsonb_build_object('custom_refund_blocked',exists(select 1 from public.wakppu_purchase_entitlements e join public.wakppu_purchase_orders q on q.id=e.order_id where q.custom_upgrade_order_id=(x->>'id')::uuid))),'[]') from jsonb_array_elements(r->'orders')x));end if;
 return r;
end$$;
revoke all on function public.wakppu_custom_known(text),public.wakppu_custom_owned(uuid,text),public.wakppu_custom_preset(uuid,text),public.wakppu_custom_snapshot(uuid),public.wakppu_custom_entitlement(),public.wakppu_custom_asset_retire(),public.wakppu_custom_commit(uuid,jsonb),public.wakppu_custom_gc_batch(text[]) from public,anon,authenticated;
grant execute on function public.wakppu_custom_commit(uuid,jsonb),public.wakppu_custom_gc_batch(text[]) to service_role;
revoke all on function public.wakppu_api(jsonb) from public;grant execute on function public.wakppu_api(jsonb) to anon,authenticated;
commit;
