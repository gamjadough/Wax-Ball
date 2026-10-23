-- Only a new synthetic player is changed; roll back all fixture data and audit entries.
begin;
do $check$
declare u uuid:=gen_random_uuid();admin_id uuid;s public.game_states%rowtype;r jsonb;stock jsonb;
begin
 select p.user_id into admin_id from public.players p join auth.users a on a.id=p.user_id where p.role='admin' and not a.is_anonymous limit 1;
 if admin_id is null then raise exception 'Admin fixture unavailable';end if;
 insert into auth.users(id,aud,role,is_anonymous,email,email_confirmed_at,created_at,updated_at,raw_user_meta_data)
 values(u,'authenticated','authenticated',false,'auto-test-'||u::text||'@example.invalid',now(),now(),now(),'{}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api('{"action":"bootstrap"}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api(jsonb_build_object('action','admin_paid_grant','user_id',u,'product_id','auto_rebirth','request_id',gen_random_uuid(),'reason','빠른 자동 환생 롤백 검증'));
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api('{"action":"auto_rebirth_toggle","enabled":true}');
 update public.game_states set gold=2000000,rebirths=0,honey_expires_at=now()+interval '1 hour',coating_expires_at=now()+interval '1 hour',current_clicks=2,item_current_clicks=2 where user_id=u;
 perform public.wakppu_api('{"action":"items"}');
 select inventory into stock from public.wakppu_items where user_id=u;
 select * into s from public.game_states where user_id=u;
 r:=public.wakppu_api(jsonb_build_object('action','auto_rebirth_run','rebirths',0,'item_revision',s.item_revision));
 if r->>'performed'<>'true' or r#>>'{progress,gold}'<>'0' or (r#>>'{progress,rebirths}')::int<>1 or (r#>>'{items,revision}')::bigint<>s.item_revision+1 then raise exception 'Fast response mismatch';end if;
 if r#>'{items,inventory}' is distinct from stock or r#>'{items,effects}'<>'{}'::jsonb then raise exception 'Stock or effects reset incorrectly';end if;
 if exists(select 1 from public.game_states where user_id=u and (gold<>0 or rebirths<>1 or honey_expires_at is not null or coating_expires_at is not null or current_clicks<>0 or item_current_clicks<>0 or item_revision<>s.item_revision+1 or hammer_level<>s.hammer_level or hammer_owned<>s.hammer_owned)) then raise exception 'Real reset contract failed';end if;
 r:=public.wakppu_api(jsonb_build_object('action','auto_rebirth_run','rebirths',0,'item_revision',s.item_revision));if r->>'performed'<>'false' or (r#>>'{progress,rebirths}')::int<>1 then raise exception 'Replay duplicated';end if;
 if has_table_privilege('authenticated','public.wakppu_auto_rebirth','SELECT') or has_function_privilege('anon','public.wakppu_api_before_auto_rebirth(jsonb)','EXECUTE') then raise exception 'Private state exposed';end if;
end $check$;
rollback;
select true as fast_auto_rebirth_verified,true as test_changes_rolled_back;
