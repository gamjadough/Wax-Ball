-- Synthetic buyers only; all accounts, orders and audit entries are rolled back.
begin;
do $check$
declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();admin_id uuid;r jsonb;o jsonb;req jsonb;
begin
 select p.user_id into admin_id from public.players p join auth.users a on a.id=p.user_id where p.role='admin' and not a.is_anonymous limit 1;
 if admin_id is null then raise exception 'Admin fixture unavailable';end if;
 insert into auth.users(id,aud,role,is_anonymous,email,email_confirmed_at,created_at,updated_at,raw_user_meta_data)
 select id,'authenticated','authenticated',false,'price-check-'||id::text||'@example.invalid',now(),now(),now(),'{}'::jsonb from unnest(array[u,v])id;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api('{"action":"bootstrap"}');
 r:=public.wakppu_api('{"action":"purchase_catalog"}');
 if not exists(select 1 from jsonb_array_elements(r->'products')x where x->>'id'='custom_ball_single' and (x->>'amount')::int=9900) or not exists(select 1 from jsonb_array_elements(r->'products')x where x->>'id'='custom_ball_all' and (x->>'amount')::int=29000) then raise exception 'Live price catalog mismatch';end if;
 req:=jsonb_build_object('action','purchase_order','product_id','custom_ball_single','target','yellow','request_id',gen_random_uuid(),'depositor','가격 검증','amount',9900);
 r:=public.wakppu_api(req);o:=r->'order';if(o->>'amount')::int<>9900 then raise exception 'Single price mismatch';end if;
 if public.wakppu_api(req)->'order'<>o then raise exception 'Receipt replay mismatch';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api(jsonb_build_object('action','admin_purchase_approve','order_id',o->>'id','confirmed_amount',9900,'deposit_reference','price-test-'||u::text));
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 r:=public.wakppu_api('{"action":"purchase_catalog"}');
 if not exists(select 1 from jsonb_array_elements(r->'products')x where x->>'id'='custom_ball_all' and (x->>'amount')::int=19100) then raise exception 'Upgrade catalog mismatch';end if;
 r:=public.wakppu_api(jsonb_build_object('action','purchase_order','product_id','custom_ball_all','request_id',gen_random_uuid(),'depositor','가격 검증','amount',19100));
 if(r#>>'{order,amount}')::int<>19100 or r#>>'{order,custom_upgrade_order_id}' is distinct from o->>'id' then raise exception 'Upgrade receipt mismatch';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api('{"action":"bootstrap"}');
 r:=public.wakppu_api(jsonb_build_object('action','purchase_order','product_id','custom_ball_all','request_id',gen_random_uuid(),'depositor','가격 검증','amount',29000));
 if(r#>>'{order,amount}')::int<>29000 then raise exception 'Full receipt mismatch';end if;
end $check$;
rollback;
select true as custom_prices_verified,true as test_changes_rolled_back;
