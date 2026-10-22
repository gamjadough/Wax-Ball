begin;
create index wakppu_purchase_inbox_idx on public.wakppu_purchase_orders((greatest(created_at,coalesce(claimed_at,created_at))) desc,id)
 where source='bank' and status in('pending','claimed');
alter function public.wakppu_api(jsonb) rename to wakppu_api_before_admin_inbox;
revoke all on function public.wakppu_api_before_admin_inbox(jsonb) from public,anon,authenticated;
create function public.wakppu_api(b jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid();result jsonb;begin
 if b->>'action' is distinct from 'admin_purchase_inbox' then return public.wakppu_api_before_admin_inbox(b);end if;
 if u is null then raise sqlstate 'PT401';end if;
 perform public.wakppu_api_before_admin_inbox('{"action":"bootstrap"}');
 if not exists(select 1 from public.players p join auth.users a on a.id=p.user_id where p.user_id=u and p.role='admin' and not a.is_anonymous) then raise sqlstate 'PT403' using message='관리자 권한이 필요합니다.';end if;
 select jsonb_build_object('total',count(*),'pending',count(*) filter(where status='pending'),'claimed',count(*) filter(where status='claimed')) into result
 from public.wakppu_purchase_orders where source='bank' and status in('pending','claimed');
 return result||jsonb_build_object('orders',(select coalesce(jsonb_agg(to_jsonb(x) order by x.changed_at desc,x.id),'[]') from
  (select o.id,p.nickname,o.product_name,o.amount,o.status,o.created_at,o.claimed_at,greatest(o.created_at,coalesce(o.claimed_at,o.created_at)) as changed_at,
    case when b?'order_id' then o.bank end as bank,case when b?'order_id' then o.depositor end as depositor
   from public.wakppu_purchase_orders o join public.players p on p.user_id=o.user_id
   where o.source='bank' and o.status in('pending','claimed') and (not b?'order_id' or o.id=(b->>'order_id')::uuid)
   order by greatest(o.created_at,coalesce(o.claimed_at,o.created_at)) desc,o.id limit 20)x));
end$$;
revoke all on function public.wakppu_api(jsonb) from public;
grant execute on function public.wakppu_api(jsonb) to anon,authenticated;
commit;
