-- Synthetic users only. All user/session/progress/grant/audit writes roll back.
begin;
do $test$
declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();sid uuid:=gen_random_uuid();r jsonb;req jsonb;ord uuid:=gen_random_uuid();admin_id uuid;before_target jsonb;begin
 insert into auth.users(id,aud,role,is_anonymous,created_at,updated_at,raw_user_meta_data)
 values(u,'authenticated','authenticated',true,now(),now(),'{}'),(v,'authenticated','authenticated',false,now(),now(),'{}');
 insert into auth.sessions(id,user_id) values(sid,u);
 -- Bypass time restrictions only for fixture initialization by directly adding owned rows.
 insert into public.game_states(user_id) values(u),(v) on conflict do nothing;
 insert into public.wakppu_limited_players(user_id,tokens,owned) values(u,77,'{"halloween-pumpkin-2026":{"reward":"1500000000"}}');
 insert into public.wakppu_skins(user_id,owned) values(u,'{"pumpkin_eclipse":true}');
 insert into public.wakppu_purchase_orders(id,user_id,request_id,product_id,product_name,amount,depositor,bank,status,source)
 values(ord,u,gen_random_uuid(),'starlight_skin','synthetic guest deletion check',0,'synthetic','{}','approved','admin_grant');
 insert into public.wakppu_purchase_entitlements(user_id,product_id,order_id) values(u,'starlight_skin',ord);
 insert into public.wakppu_purchase_cosmetics(user_id,equipped) values(u,true);
 select user_id into admin_id from public.players where role='admin' limit 1;
 -- Audit row is synthetic; it does not change the selected real administrator.
 if admin_id is not null then insert into public.admin_audit_logs(admin_user_id,target_user_id,action,reason,details) values(admin_id,u,'GUEST_EXIT_SMOKE','synthetic rollback check','{}');end if;
 select to_jsonb(g) into before_target from public.game_states g where user_id=v;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v,'role','authenticated','is_anonymous',true,'session_id',sid)::text,true);
 begin perform public.wakppu_api(jsonb_build_object('action','guest_discard','expected_user_id',v,'confirmation','DELETE_GUEST'));raise exception 'Non-guest deletion unexpectedly allowed';exception when sqlstate 'PT403' then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',true,'session_id',sid)::text,true);
 begin perform public.wakppu_api(jsonb_build_object('action','guest_discard','expected_user_id',v,'confirmation','DELETE_GUEST'));raise exception 'Another target unexpectedly allowed';exception when sqlstate 'PT409' then null;end;
 req:=jsonb_build_object('action','guest_discard','expected_user_id',u,'confirmation','DELETE_GUEST');r:=public.wakppu_api(req);
 if not(r->>'deleted')::boolean or exists(select 1 from auth.users where id=u) or exists(select 1 from auth.sessions where user_id=u) or exists(select 1 from public.players where user_id=u) or exists(select 1 from public.wakppu_skins where user_id=u) or exists(select 1 from public.wakppu_limited_players where user_id=u) then raise exception 'Live cascade failed';end if;
 if not exists(select 1 from public.wakppu_purchase_orders where id=ord and user_id is null and deleted_user_id=u) then raise exception 'Financial history not preserved';end if;
 if admin_id is not null and not exists(select 1 from public.admin_audit_logs where action='GUEST_EXIT_SMOKE' and target_user_id is null and details->>'deleted_target_user_id'=u::text) then raise exception 'Audit not preserved';end if;
 if (select to_jsonb(g) from public.game_states g where user_id=v)<>before_target then raise exception 'Other account changed';end if;
 if public.wakppu_api(req)<>r then raise exception 'Deletion retry failed';end if;
 begin perform public.wakppu_api('{"action":"bootstrap"}');raise exception 'Deleted JWT unexpectedly allowed';exception when sqlstate 'PT401' then null;end;
 if has_function_privilege('authenticated','public.wakppu_api_before_guest_exit(jsonb)','execute') then raise exception 'Internal wrapper exposed';end if;
end $test$;
select 'PASS: production self-delete, real-role checks, cascade/session removal, archived audit/financial history, no other-user changes, retry and stale JWT denial; rolled back' as result;
rollback;
