begin;
alter table public.wakppu_purchase_orders add column if not exists source text not null default 'bank' check(source in ('bank','admin_grant'));
alter table public.wakppu_purchase_orders drop constraint if exists wakppu_purchase_orders_amount_check;
alter table public.wakppu_purchase_orders add constraint wakppu_purchase_orders_amount_check check((source='bank' and amount>0) or (source='admin_grant' and amount=0));
alter table public.wakppu_purchase_orders drop constraint if exists wakppu_purchase_orders_status_check;
alter table public.wakppu_purchase_orders add constraint wakppu_purchase_orders_status_check check(status in ('pending','claimed','approved','cancelled','refunded','revoked'));
create or replace function public.wakppu_admin_paid_snapshot(t uuid) returns jsonb language sql stable set search_path=public,pg_temp as $$
 select jsonb_build_object('user_id',t,'products',(select jsonb_agg(to_jsonb(p) order by amount,id) from public.wakppu_purchase_products p),
 'owned',(select coalesce(jsonb_object_agg(e.product_id,jsonb_build_object('order_id',e.order_id,'source',o.source,'revoke_blocked',exists(select 1 from public.wakppu_purchase_entitlements x join public.wakppu_purchase_orders q on q.id=x.order_id where q.supporter_upgrade_order_id=o.id),'reclaimable',case when e.product_id='first_steps_pack' then public.wakppu_first_steps_refundable(t) else true end)),'{}') from public.wakppu_purchase_entitlements e join public.wakppu_purchase_orders o on o.id=e.order_id where e.user_id=t),
 'starter_used',exists(select 1 from public.wakppu_first_steps_grants where user_id=t),
 'history',(select coalesce(jsonb_agg(to_jsonb(q) order by created_at desc),'[]') from (select id,product_name,status,created_at,approved_at from public.wakppu_purchase_orders where user_id=t and source='admin_grant' order by created_at desc limit 20) q));
$$;
revoke all on function public.wakppu_admin_paid_snapshot(uuid) from public,anon,authenticated;
-- Keep unplayed gift recipients and their audit/order history out of guest cleanup.
do $lifecycle$ declare name text;body text;updated text;
begin
 foreach name in array array['public.wakppu_guest_accounts()','public.wakppu_cleanup_unplayed_guests()'] loop
  if to_regprocedure(name) is null then continue;end if;
  body:=pg_get_functiondef(to_regprocedure(name));
  if position('admin_paid_lifecycle_guard' in body)>0 then continue;end if;
  updated:=replace(body,'and not exists(select 1 from admin_audit_logs a where a.admin_user_id=l.user_id)',
   'and not exists(select 1 from admin_audit_logs a where a.admin_user_id=l.user_id) and not exists(select 1 from public.wakppu_purchase_orders po where po.user_id=l.user_id and po.source=''admin_grant'') /* admin_paid_lifecycle_guard */');
  updated:=replace(updated,'and not exists(select 1 from admin_audit_logs a where a.admin_user_id=u.id)',
   'and not exists(select 1 from admin_audit_logs a where a.admin_user_id=u.id) and not exists(select 1 from public.wakppu_purchase_orders po where po.user_id=u.id and po.source=''admin_grant'') /* admin_paid_lifecycle_guard */');
  updated:=replace(updated,'case when p.role=''admin'' then ''관리자'' when',
   'case when p.role=''admin'' then ''관리자'' when exists(select 1 from public.wakppu_purchase_orders po where po.user_id=l.user_id and po.source=''admin_grant'') then ''관리자 지급 이력'' when');
  if updated=body or position('admin_paid_lifecycle_guard' in updated)=0 then raise exception 'Expected guest lifecycle guard';end if;execute updated;
 end loop;
end $lifecycle$;
-- Paid-bank refunds must never be used to record a gift revocation.
do $patch$ declare f record;body text;updated text;matched integer:=0;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosrc like '%insert into public.wakppu_purchase_entitlements values%' loop
  body:=pg_get_functiondef(f.oid);updated:=body;
  if position('admin_grant_refund_guard' in body)=0 then
   updated:=replace(body,'if a=''admin_purchase_refund'' then','if a=''admin_purchase_refund'' then
  -- admin_grant_refund_guard
  if o.source=''admin_grant'' then raise sqlstate ''PT409'' using message=''관리자 지급은 환불이 아닌 직접 지급 회수 메뉴를 이용하세요.'';end if;');
   if updated=body then raise exception 'Expected purchase refund handler';end if;execute updated;
  end if;matched:=matched+1;
 end loop;
 if matched<>1 then raise exception 'Expected one bank purchase handler';end if;
end $patch$;
do $wrap$ begin
 if to_regprocedure('public.wakppu_api_before_admin_paid_grants(jsonb)') is null then alter function public.wakppu_api(jsonb) rename to wakppu_api_before_admin_paid_grants;end if;
end $wrap$;
revoke all on function public.wakppu_api_before_admin_paid_grants(jsonb) from public,anon,authenticated;
create or replace function public.wakppu_api(b jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $api$
declare a text:=b->>'action';u uuid:=auth.uid();t uuid;reason text;rid uuid;o public.wakppu_purchase_orders;p public.wakppu_purchase_products;new_id uuid;
begin
 if a is null or a not in ('admin_paid_status','admin_paid_grant','admin_paid_revoke') then return public.wakppu_api_before_admin_paid_grants(b);end if;
 if u is null then raise sqlstate 'PT401';end if;
 perform public.wakppu_api_before_admin_paid_grants('{"action":"bootstrap"}');
 if not exists(select 1 from public.players pl join auth.users au on au.id=pl.user_id where pl.user_id=u and pl.role='admin' and not coalesce(au.is_anonymous,true)) then raise sqlstate 'PT403' using message='관리자 권한이 필요합니다.';end if;
 t:=(b->>'user_id')::uuid;if t is null or not exists(select 1 from public.players where user_id=t) then raise sqlstate 'PT404' using message='대상 계정을 확인하세요.';end if;
 perform pg_advisory_xact_lock(hashtextextended(t::text,19));
 if a='admin_paid_status' then return public.wakppu_admin_paid_snapshot(t);end if;
 reason:=trim(coalesce(b->>'reason',''));if length(reason)<3 or length(reason)>200 then raise sqlstate 'PT400' using message='지급·회수 사유를 3~200자로 입력하세요.';end if;
 if a='admin_paid_grant' then
  rid:=(b->>'request_id')::uuid;if rid is null then raise sqlstate 'PT400';end if;
  select * into o from public.wakppu_purchase_orders where user_id=t and request_id=rid;
  if found then
   if o.source<>'admin_grant' or o.product_id is distinct from b->>'product_id' then raise sqlstate 'PT409';end if;
   return public.wakppu_admin_paid_snapshot(t);
  end if;
  select * into p from public.wakppu_purchase_products where id=b->>'product_id';if not found then raise sqlstate 'PT400';end if;
  if exists(select 1 from public.wakppu_purchase_entitlements where user_id=t and product_id=p.id) then raise sqlstate 'PT409' using message='이미 보유한 상품입니다.';end if;
  if p.id='supporter_pack' and public.wakppu_supporter_percent(t)=30 then raise sqlstate 'PT409' using message='프리미엄에 포함된 혜택입니다.';end if;
  if p.id='first_steps_pack' and exists(select 1 from public.wakppu_first_steps_grants where user_id=t) then raise sqlstate 'PT409' using message='첫걸음 성장팩은 계정당 한 번만 지급할 수 있습니다.';end if;
  if exists(select 1 from public.wakppu_purchase_orders where user_id=t and product_id=p.id and status in ('pending','claimed')) then raise sqlstate 'PT409' using message='입금 대기 주문이 있습니다. 실제 입금 여부를 먼저 확인하세요.';end if;
  insert into public.wakppu_purchase_orders(user_id,request_id,product_id,product_name,amount,depositor,bank,status,approved_at,approved_by,source)
   values(t,rid,p.id,p.name,0,'관리자 직접 지급','{}','approved',clock_timestamp(),u,'admin_grant') returning id into new_id;
  insert into wakppu_purchase_entitlements(user_id,product_id,order_id) values(t,p.id,new_id);
  insert into public.admin_audit_logs(admin_user_id,target_user_id,action,reason,details) values(u,t,a,reason,jsonb_build_object('order_id',new_id,'product_id',p.id,'source','admin_grant','amount',0));
 else
  select * into o from public.wakppu_purchase_orders where id=(b->>'order_id')::uuid and user_id=t for update;
  if not found or o.source<>'admin_grant' then raise sqlstate 'PT404';end if;
  if o.status='revoked' then return public.wakppu_admin_paid_snapshot(t);end if;
  if o.status<>'approved' then raise sqlstate 'PT409';end if;
  if exists(select 1 from public.wakppu_purchase_entitlements e join public.wakppu_purchase_orders q on q.id=e.order_id where q.supporter_upgrade_order_id=o.id) then raise sqlstate 'PT409' using message='이 응원팩으로 업그레이드한 프리미엄을 먼저 회수·환불하세요.';end if;
  delete from public.wakppu_purchase_entitlements where order_id=o.id;
  update public.wakppu_purchase_orders set status='revoked' where id=o.id;
  if o.product_id='starlight_skin' then update public.wakppu_purchase_cosmetics set equipped=false where user_id=t;end if;
  insert into public.admin_audit_logs(admin_user_id,target_user_id,action,reason,details) values(u,t,a,reason,jsonb_build_object('order_id',o.id,'product_id',o.product_id,'source','admin_grant'));
 end if;
 return public.wakppu_admin_paid_snapshot(t);
end $api$;
revoke all on function public.wakppu_api(jsonb) from public,anon;
grant execute on function public.wakppu_api(jsonb) to anon,authenticated;
commit;
