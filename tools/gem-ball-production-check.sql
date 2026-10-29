-- Synthetic authenticated accounts only. All test progress and gifts roll back.
begin;
do $check$
declare u uuid:=gen_random_uuid();a uuid:=gen_random_uuid();r jsonb;req jsonb;g numeric;rev bigint;
begin
 insert into auth.users(id,aud,role,is_anonymous,email,email_confirmed_at,created_at,updated_at,raw_user_meta_data)
 values(u,'authenticated','authenticated',false,'crystal-test-'||u::text||'@example.invalid',now(),now(),now(),'{}'),
 (a,'authenticated','authenticated',false,'crystal-test-'||a::text||'@example.invalid',now(),now(),now(),'{}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api('{"action":"bootstrap"}');
 r:=public.wakppu_api('{"action":"gem_balls"}');if r->'owned'<>'[]'::jsonb or r->>'selected' is not null then raise exception 'Unexpected initial gem ball';end if;
 insert into public.wakppu_blue_gems(user_id,balance) values(u,5000);
 select gold into g from public.game_states where user_id=u;
 r:=public.wakppu_api('{"action":"items"}');req:=jsonb_build_object('action','gem_ball_buy','ball_id','blue-crystal-wax','request_id',gen_random_uuid(),'item_revision',r->'revision');
 r:=public.wakppu_api(req);perform public.wakppu_api(req);
 if r#>>'{blue_gems,balance}'<>'0' or not(r#>'{gem_balls,owned}' ? 'blue-crystal-wax') then raise exception 'Bad purchase';end if;
 r:=public.wakppu_api(jsonb_build_object('action','gem_ball_select','ball_id','blue-crystal-wax','request_id',gen_random_uuid(),'item_revision',r->'revision'));
 r:=public.wakppu_api(jsonb_build_object('action','item_hit','request_id',gen_random_uuid(),'item_revision',r->'revision'));
 if r->>'clicks'<>'1' or r->>'broken'<>'false' or r#>>'{blue_gems,balance}'<>'0' then raise exception 'Partial hit reward';end if;
 update public.game_states set hammer_owned=true,hammer_level=10 where user_id=u;
 update public.wakppu_blue_gems set level=7 where user_id=u;
 req:=jsonb_build_object('action','item_hit','request_id',gen_random_uuid(),'item_revision',r->'revision');r:=public.wakppu_api(req);
 if r->>'broken'<>'true' or r->>'clicks'<>'100' or r->>'reward'<>'0' or r#>>'{blue_gems,balance}'<>'5' or (r->>'gold')::numeric<>g then raise exception 'Crystal reward changed';end if;
 perform public.wakppu_api(req);if (select balance from public.wakppu_blue_gems where user_id=u)<>5 then raise exception 'Repeated reward';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api('{"action":"bootstrap"}');update public.players set role='admin' where user_id=a;
 r:=public.wakppu_api('{"action":"items"}');r:=public.wakppu_api(jsonb_build_object('action','gem_ball_select','ball_id','blue-crystal-wax','request_id',gen_random_uuid(),'item_revision',r->'revision'));
 if r#>'{gem_balls,owned}'<>'[]'::jsonb or r#>>'{blue_gems,balance}'<>'0' then raise exception 'Admin real stock changed';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','is_anonymous',true)::text,true);
 if public.wakppu_api('{"action":"gem_balls"}')->>'selected' is not null then raise exception 'Anonymous admin bypass';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api(jsonb_build_object('action','admin_paid_grant','user_id',u,'product_id','auto_rebirth','request_id',gen_random_uuid(),'reason','수정 볼 환생 롤백 검증'));
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api('{"action":"auto_rebirth_toggle","enabled":true}');
 update public.game_states set gold=2000000,rebirths=0 where user_id=u;
 r:=public.wakppu_api('{"action":"items"}');r:=public.wakppu_api(jsonb_build_object('action','auto_rebirth_run','rebirths',0,'item_revision',r->'revision'));
 if r->>'performed'<>'true' or not(r#>'{gem_balls,owned}' ? 'blue-crystal-wax') or r#>>'{blue_gems,balance}'<>'5' then raise exception 'Rebirth lost gem ball';end if;
 if has_table_privilege('authenticated','public.wakppu_gem_ball_players','SELECT') or has_function_privilege('anon','public.wakppu_gem_ball_hit(jsonb)','EXECUTE') then raise exception 'Private gem data exposed';end if;
end $check$;
rollback;
select true as gem_ball_verified,true as test_changes_rolled_back;
