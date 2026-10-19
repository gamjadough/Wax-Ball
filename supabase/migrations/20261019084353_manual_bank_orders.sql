-- Manual bank deposits: only a real administrator may confirm receipt and grant.
-- No bank integration or transfer execution. Orders remain closed until configured.
begin;
create table if not exists public.wakppu_purchase_config(
 id boolean primary key default true check(id),enabled boolean not null default false,
 bank_name text not null default '',account_number text not null default '',account_holder text not null default '',
 support_contact text not null default '',revision integer not null default 0);
insert into public.wakppu_purchase_config(id) values(true) on conflict do nothing;
create table if not exists public.wakppu_purchase_products(
 id text primary key,name text not null,amount integer not null check(amount>0),description text not null);
insert into public.wakppu_purchase_products values
 ('supporter_pack','왁뿌볼 응원팩',1100,'후원자 칭호와 닉네임 테두리 · 능력치 변화 없음'),
 ('starlight_skin','별빛 오라 스킨',3300,'모든 볼에 별빛 고리와 반짝임 · 능력치 변화 없음') on conflict do nothing;
create table if not exists public.wakppu_purchase_orders(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references public.players(user_id),
 request_id uuid not null,product_id text not null references public.wakppu_purchase_products(id),
 product_name text not null,amount integer not null check(amount>0),depositor text not null,
 bank jsonb not null,status text not null default 'pending' check(status in ('pending','claimed','approved','cancelled','refunded')),
 created_at timestamptz not null default clock_timestamp(),claimed_at timestamptz,approved_at timestamptz,refunded_at timestamptz,
 deposit_reference text unique,approved_by uuid,refund_reference text,unique(user_id,request_id));
create index if not exists wakppu_purchase_owner_idx on public.wakppu_purchase_orders(user_id,created_at desc);
create index if not exists wakppu_purchase_pending_idx on public.wakppu_purchase_orders(status,created_at desc);
create table if not exists public.wakppu_purchase_entitlements(
 user_id uuid not null references public.players(user_id),product_id text not null references public.wakppu_purchase_products(id),
 order_id uuid not null unique references public.wakppu_purchase_orders(id),primary key(user_id,product_id));
create table if not exists public.wakppu_purchase_cosmetics(
 user_id uuid primary key references public.players(user_id),equipped boolean not null default false);
alter table public.wakppu_purchase_config enable row level security;
alter table public.wakppu_purchase_products enable row level security;
alter table public.wakppu_purchase_orders enable row level security;
alter table public.wakppu_purchase_entitlements enable row level security;
alter table public.wakppu_purchase_cosmetics enable row level security;
revoke all on public.wakppu_purchase_config,public.wakppu_purchase_products,public.wakppu_purchase_orders,
 public.wakppu_purchase_entitlements,public.wakppu_purchase_cosmetics from public,anon,authenticated;

create or replace function public.wakppu_purchase_snapshot(u uuid) returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare c public.wakppu_purchase_config;ready boolean;
begin
 if u is null or u is distinct from auth.uid() then raise sqlstate 'PT403';end if;
 select * into c from public.wakppu_purchase_config where id;
 select not coalesce(is_anonymous,true) and email_confirmed_at is not null and coalesce(email,'')<>'' into ready from auth.users where id=u;
 return jsonb_build_object('eligible',coalesce(ready,false),'enabled',c.enabled,'bank',case when c.enabled then to_jsonb(c)-'id'-'revision'-'enabled' else '{}'::jsonb end,
  'products',(select coalesce(jsonb_agg(to_jsonb(p) order by amount),'[]') from public.wakppu_purchase_products p),
  'owned',(select coalesce(jsonb_object_agg(product_id,order_id),'{}') from public.wakppu_purchase_entitlements where user_id=u),
  'equipped',coalesce((select equipped from public.wakppu_purchase_cosmetics where user_id=u),false),
  'orders',(select coalesce(jsonb_agg(to_jsonb(o)-'approved_by'-'deposit_reference'-'refund_reference'-'request_id' order by created_at desc),'[]') from (select * from public.wakppu_purchase_orders where user_id=u order by created_at desc limit 50) o));
end $$;
revoke all on function public.wakppu_purchase_snapshot(uuid) from public,anon,authenticated;
do $wrap$ begin
 if to_regprocedure('public.wakppu_api_before_purchases(jsonb)') is null then alter function public.wakppu_api(jsonb) rename to wakppu_api_before_purchases;end if;
end $wrap$;
revoke all on function public.wakppu_api_before_purchases(jsonb) from public,anon,authenticated;
create or replace function public.wakppu_api(b jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $api$
declare u uuid:=auth.uid();a text:=b->>'action';admin boolean;eligible boolean;c public.wakppu_purchase_config;
 o public.wakppu_purchase_orders;p public.wakppu_purchase_products;result jsonb;rid uuid;ref text;offset_n integer;who uuid;
begin
 if a='rankings' then
  result:=public.wakppu_api_before_purchases(b);
  return coalesce((select jsonb_agg(row||jsonb_build_object('supporter',exists(select 1 from public.players pl join public.wakppu_purchase_entitlements e on e.user_id=pl.user_id where pl.nickname=row->>'nickname' and e.product_id='supporter_pack')) order by ord) from jsonb_array_elements(result) with ordinality as entries(row,ord)),'[]');
 end if;
 if a is null or a not in ('purchase_catalog','purchase_order','purchase_claim','purchase_cancel','purchase_equip','admin_purchase_config','admin_purchase_orders','admin_purchase_approve','admin_purchase_refund') then return public.wakppu_api_before_purchases(b);end if;
 if u is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.';end if;
 perform public.wakppu_api_before_purchases('{"action":"bootstrap"}');
 select pl.role='admin' and not coalesce(au.is_anonymous,true),not coalesce(au.is_anonymous,true) and au.email_confirmed_at is not null and coalesce(au.email,'')<>'' into admin,eligible from public.players pl join auth.users au on au.id=pl.user_id where pl.user_id=u;
 if a like 'admin_purchase_%' and not coalesce(admin,false) then raise sqlstate 'PT403' using message='관리자 권한이 필요합니다.';end if;
 if a='admin_purchase_config' then
  select * into c from public.wakppu_purchase_config where id for update;
  if coalesce(b->>'mode','get')='set' then
   if (b->>'revision')::integer is distinct from c.revision then raise sqlstate 'PT409' using message='다른 관리자가 설정을 변경했습니다. 새로고침하세요.';end if;
   if jsonb_typeof(b->'enabled') is distinct from 'boolean' then raise sqlstate 'PT400' using message='판매 상태를 확인하세요.';end if;
   if length(coalesce(b->>'bank_name',''))>50 or length(coalesce(b->>'account_number',''))>50 or length(coalesce(b->>'account_holder',''))>50 or length(coalesce(b->>'support_contact',''))>200 then raise sqlstate 'PT400' using message='계좌 정보가 너무 깁니다.';end if;
   if (b->>'enabled')::boolean and (length(trim(coalesce(b->>'bank_name','')))<2 or coalesce(b->>'account_number','')!~ '^[0-9 -]{5,50}$' or length(trim(coalesce(b->>'account_holder','')))<2 or length(trim(coalesce(b->>'support_contact','')))<3) then raise sqlstate 'PT400' using message='은행·계좌번호·예금주·문의 방법을 입력하세요.';end if;
   update public.wakppu_purchase_config set enabled=(b->>'enabled')::boolean,bank_name=trim(b->>'bank_name'),account_number=trim(b->>'account_number'),account_holder=trim(b->>'account_holder'),support_contact=trim(b->>'support_contact'),revision=revision+1 where id returning * into c;
   insert into public.admin_audit_logs(admin_user_id,action,reason,details) values(u,a,'수동 계좌이체 설정 변경',jsonb_build_object('enabled',c.enabled,'bank_name',c.bank_name,'revision',c.revision));
  elsif coalesce(b->>'mode','get')<>'get' then raise sqlstate 'PT400';end if;
  return to_jsonb(c);
 end if;
 if a='admin_purchase_orders' then
  offset_n:=coalesce((b->>'offset')::integer,0);if offset_n<0 or offset_n>100000 then raise sqlstate 'PT400';end if;
  return jsonb_build_object('orders',(select coalesce(jsonb_agg(to_jsonb(t) order by created_at desc),'[]') from (select ord.*,pl.nickname from public.wakppu_purchase_orders ord join public.players pl on pl.user_id=ord.user_id where coalesce(b->>'status','all')='all' or ord.status=b->>'status' order by created_at desc,id limit 50 offset offset_n) t),'offset',offset_n);
 end if;
 if a='purchase_catalog' then return public.wakppu_purchase_snapshot(u);end if;
 if a='purchase_order' then
  if not coalesce(eligible,false) then raise sqlstate 'PT403' using message='이메일을 연결하고 인증한 계정만 주문할 수 있습니다.';end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,19));
  rid:=(b->>'request_id')::uuid;if rid is null then raise sqlstate 'PT400';end if;
  select * into o from public.wakppu_purchase_orders where user_id=u and request_id=rid;
  if found then
   if o.product_id is distinct from b->>'product_id' or o.depositor is distinct from trim(b->>'depositor') then raise sqlstate 'PT409' using message='같은 주문 요청을 변경할 수 없습니다.';end if;
   return public.wakppu_purchase_snapshot(u)||jsonb_build_object('order',to_jsonb(o));
  end if;
  select * into c from public.wakppu_purchase_config where id for share;
  if not c.enabled then raise sqlstate 'PT409' using message='현재 유료 주문을 받고 있지 않습니다.';end if;
  select * into p from public.wakppu_purchase_products where id=b->>'product_id';if not found then raise sqlstate 'PT400' using message='판매 상품을 확인하세요.';end if;
  if length(trim(coalesce(b->>'depositor','')))<2 or length(trim(b->>'depositor'))>30 then raise sqlstate 'PT400' using message='입금자명을 2~30자로 입력하세요.';end if;
  if b?'amount' and (b->>'amount')::integer is distinct from p.amount then raise sqlstate 'PT400' using message='상품 금액이 일치하지 않습니다.';end if;
  if exists(select 1 from public.wakppu_purchase_entitlements where user_id=u and product_id=p.id) then raise sqlstate 'PT409' using message='이미 보유한 상품입니다.';end if;
  select * into o from public.wakppu_purchase_orders where user_id=u and product_id=p.id and status in ('pending','claimed') order by created_at desc limit 1;
  if found then return public.wakppu_purchase_snapshot(u)||jsonb_build_object('order',to_jsonb(o));end if;
  insert into public.wakppu_purchase_orders(user_id,request_id,product_id,product_name,amount,depositor,bank) values(u,rid,p.id,p.name,p.amount,trim(b->>'depositor'),to_jsonb(c)-'id'-'revision'-'enabled') returning * into o;
  return public.wakppu_purchase_snapshot(u)||jsonb_build_object('order',to_jsonb(o));
 end if;
 if a='purchase_equip' then
  perform pg_advisory_xact_lock(hashtextextended(u::text,19));
  if jsonb_typeof(b->'equipped') is distinct from 'boolean' then raise sqlstate 'PT400';end if;
  if (b->>'equipped')::boolean and not exists(select 1 from public.wakppu_purchase_entitlements where user_id=u and product_id='starlight_skin') then raise sqlstate 'PT403' using message='보유한 스킨만 장착할 수 있습니다.';end if;
  insert into public.wakppu_purchase_cosmetics values(u,(b->>'equipped')::boolean) on conflict(user_id) do update set equipped=excluded.equipped;
  return public.wakppu_purchase_snapshot(u);
 end if;
 -- Lock the owner before the order for every mutation, including administrator work.
 select user_id into who from public.wakppu_purchase_orders where id=(b->>'order_id')::uuid;
 if who is null or (not coalesce(admin,false) and who<>u) then raise sqlstate 'PT404' using message='주문을 찾을 수 없습니다.';end if;
 perform pg_advisory_xact_lock(hashtextextended(who::text,19));
 select * into o from public.wakppu_purchase_orders where id=(b->>'order_id')::uuid for update;
 if a in ('purchase_claim','purchase_cancel') then
  if o.user_id<>u then raise sqlstate 'PT404';end if;
  if a='purchase_claim' and o.status='pending' then update public.wakppu_purchase_orders set status='claimed',claimed_at=clock_timestamp() where id=o.id;
  elsif a='purchase_cancel' and o.status='pending' then update public.wakppu_purchase_orders set status='cancelled' where id=o.id;
  elsif (a='purchase_claim' and o.status not in ('claimed','approved')) or (a='purchase_cancel' and o.status<>'cancelled') then raise sqlstate 'PT409' using message='처리 상태가 바뀌었습니다. 새로고침하세요.';end if;
  return public.wakppu_purchase_snapshot(u);
 end if;
 if a='admin_purchase_approve' then
  ref:=trim(coalesce(b->>'deposit_reference',''));
  if length(ref)<4 or length(ref)>100 or (b->>'confirmed_amount')::integer is distinct from o.amount then raise sqlstate 'PT400' using message='실제 입금액과 거래 식별 기록을 확인하세요.';end if;
  if o.status='approved' then
   if o.deposit_reference<>ref then raise sqlstate 'PT409' using message='이미 확인한 입금 기록과 다릅니다.';end if;
   return jsonb_build_object('ok',true,'order_id',o.id);
  end if;
  if o.status not in ('pending','claimed') then raise sqlstate 'PT409' using message='확인할 수 없는 주문 상태입니다.';end if;
  if exists(select 1 from public.wakppu_purchase_entitlements where user_id=o.user_id and product_id=o.product_id) then raise sqlstate 'PT409' using message='이미 보유한 상품입니다.';end if;
  update public.wakppu_purchase_orders set status='approved',approved_at=clock_timestamp(),approved_by=u,deposit_reference=ref where id=o.id;
  insert into public.wakppu_purchase_entitlements values(o.user_id,o.product_id,o.id);
  insert into public.admin_audit_logs(admin_user_id,target_user_id,action,reason,details) values(u,o.user_id,a,'실제 입금 확인 후 지급',jsonb_build_object('order_id',o.id,'amount',o.amount));
 elsif a='admin_purchase_refund' then
  ref:=trim(coalesce(b->>'refund_reference',''));
  if length(ref)<4 or length(ref)>100 then raise sqlstate 'PT400' using message='실제 환불 완료 기록을 입력하세요.';end if;
  if o.status='refunded' then return jsonb_build_object('ok',true,'order_id',o.id);end if;
  if o.status<>'approved' then raise sqlstate 'PT409' using message='지급 완료된 주문만 환불 처리할 수 있습니다.';end if;
  update public.wakppu_purchase_orders set status='refunded',refunded_at=clock_timestamp(),refund_reference=ref where id=o.id;
  delete from public.wakppu_purchase_entitlements where order_id=o.id;
  if o.product_id='starlight_skin' then update public.wakppu_purchase_cosmetics set equipped=false where user_id=o.user_id;end if;
  insert into public.admin_audit_logs(admin_user_id,target_user_id,action,reason,details) values(u,o.user_id,a,'실제 환불 완료 후 상품 회수',jsonb_build_object('order_id',o.id));
 end if;
 return jsonb_build_object('ok',true,'order_id',o.id);
end $api$;
revoke all on function public.wakppu_api(jsonb) from public,anon;
grant execute on function public.wakppu_api(jsonb) to anon,authenticated;
commit;
