-- Synthetic users only: grant, inventory, use, audit and explicit guest deletion all roll back.
begin;
do $test$
declare a uuid:=gen_random_uuid();u uuid:=gen_random_uuid();g uuid:=gen_random_uuid();sid uuid:=gen_random_uuid();req jsonb;s jsonb;r jsonb;
begin
 insert into auth.users(id,aud,role,is_anonymous,created_at,updated_at,raw_user_meta_data)
 values(a,'authenticated','authenticated',false,now(),now(),'{}'),(u,'authenticated','authenticated',false,now(),now(),'{}'),(g,'authenticated','authenticated',true,now(),now(),'{}');
 -- Only synthetic staff bypass maintenance; no global setting is changed.
 update public.players set role='admin' where user_id in(a,u);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api('{"action":"bootstrap"}');
 req:=jsonb_build_object('action','admin_keepsake_grant','user_id',u,'item_id','developer_piercing_fragment','reason','synthetic rollback verification','request_id',gen_random_uuid());
 r:=public.wakppu_api(req);if not(r->>'owned')::boolean or public.wakppu_api(req)<>r then raise exception 'Grant/retry failed';end if;
 perform public.wakppu_api(jsonb_set(req,'{request_id}',to_jsonb(gen_random_uuid())));
 if (select count(*) from public.admin_audit_logs where admin_user_id=a and target_user_id=u and action='admin_keepsake_grant')<>1 then raise exception 'Duplicate grant audit';end if;
 perform public.wakppu_api(jsonb_set(jsonb_set(req,'{user_id}',to_jsonb(g)),'{request_id}',to_jsonb(gen_random_uuid())));
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 s:=public.wakppu_api('{"action":"items"}');if s->'inventory'->>'developer_piercing_fragment' is distinct from '1' then raise exception 'Inventory missing';end if;
 for i in 1..3 loop
  r:=public.wakppu_api(jsonb_build_object('action','item_use','item_id','developer_piercing_fragment','request_id',gen_random_uuid(),'item_revision',s->'revision'));
  if r<>s then raise exception 'Cosmetic use changed inventory/rewards/effects';end if;
 end loop;
 insert into auth.sessions(id,user_id) values(sid,g);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',g,'role','authenticated','is_anonymous',true,'session_id',sid)::text,true);
 perform public.wakppu_api(jsonb_build_object('action','guest_discard','expected_user_id',g,'confirmation','DELETE_GUEST'));
 if exists(select 1 from public.wakppu_developer_keepsakes where user_id=g) or exists(select 1 from auth.users where id=g) then raise exception 'Explicit guest deletion blocked';end if;
 if has_table_privilege('authenticated','public.wakppu_developer_keepsakes','select,insert,update,delete') or has_function_privilege('authenticated','public.wakppu_api_before_developer_keepsake(jsonb)','execute') then raise exception 'Private receipts/wrapper exposed';end if;
end $test$;
select 'PASS: permanent grant, one audit, repeated pure use, explicit guest deletion compatibility; all synthetic writes rolled back' as result;
rollback;
