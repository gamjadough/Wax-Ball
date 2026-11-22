-- Friends server only: stop sales without removing receipts or entitlements.
begin;
update public.wakppu_purchase_config set enabled=false,revision=revision+1 where id and enabled;
do $$begin
 if to_regprocedure('public.wakppu_api_before_friends_shop_closed(jsonb)') is null then
  alter function public.wakppu_api(jsonb) rename to wakppu_api_before_friends_shop_closed;
 end if;
end$$;
create or replace function public.wakppu_api(b jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare a text:=b->>'action';r jsonb;
begin
 if a in ('purchase_order','purchase_claim') or
    (a='admin_purchase_config' and b->>'mode'='set' and b->>'enabled'='true') then
  raise sqlstate 'PT403' using message='친구 서버에서는 유료 상점을 이용할 수 없습니다.',hint='FRIENDS_PAID_SHOP_CLOSED';
 end if;
 -- Existing entry gate, authentication, bans and per-action permissions still run.
 r:=public.wakppu_api_before_friends_shop_closed(b);
 if a='admin_purchase_config' then
  return r||jsonb_build_object('enabled',false,'shop_closed',true);
 elsif a like 'purchase_%' and r ? 'owned' then
  return r||jsonb_build_object('enabled',false,'shop_closed',true,'products','[]'::jsonb,'bank','{}'::jsonb);
 end if;
 return r;
end$$;
revoke all on function public.wakppu_api_before_friends_shop_closed(jsonb) from public,anon,authenticated;
revoke all on function public.wakppu_api(jsonb) from public,anon,authenticated;
grant execute on function public.wakppu_api(jsonb) to anon,authenticated,service_role;
commit;
