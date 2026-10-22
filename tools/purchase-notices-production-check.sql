begin;
do $check$
declare u uuid;r jsonb;n bigint;begin
 select p.user_id into u from public.players p join auth.users a on a.id=p.user_id where p.role='admin' and not a.is_anonymous limit 1;
 if u is null then raise exception 'Administrator fixture unavailable';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 r:=public.wakppu_api('{"action":"admin_purchase_inbox"}');
 select count(*) into n from public.wakppu_purchase_orders where source='bank' and status in('pending','claimed');
 if(r->>'total')::bigint<>n or jsonb_array_length(r->'orders')>20 then raise exception 'Inbox snapshot mismatch';end if;
 if exists(select 1 from jsonb_array_elements(r->'orders')x where x->>'status' not in('pending','claimed') or x->'bank'<>'null') then raise exception 'Inbox status or summary data mismatch';end if;
 r:=public.wakppu_api(jsonb_build_object('action','admin_purchase_inbox','order_id',gen_random_uuid()));if r->'orders'<>'[]' then raise exception 'Unexpected target lookup';end if;
 if has_function_privilege('authenticated','public.wakppu_api_before_admin_inbox(jsonb)','EXECUTE') then raise exception 'Private wrapper exposed';end if;
 if to_regclass('public.wakppu_purchase_inbox_idx') is null then raise exception 'Inbox index missing';end if;
 perform set_config('request.jwt.claims','{}',true);
 begin perform public.wakppu_api('{"action":"admin_purchase_inbox"}');raise exception 'Unauthenticated inbox accepted';exception when sqlstate 'PT401' then null;end;
end $check$;
rollback;
select true as admin_purchase_inbox_checks_passed,true as test_changes_rolled_back;
