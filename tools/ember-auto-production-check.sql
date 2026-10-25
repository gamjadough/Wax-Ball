-- All synthetic accounts, grants, rewards and request history are rolled back.
begin;
do $check$
declare u uuid:=gen_random_uuid();a uuid:=gen_random_uuid();r jsonb;first_r jsonb;request jsonb;s public.game_states%rowtype;g numeric;
begin
 insert into auth.users(id,aud,role,is_anonymous,email,email_confirmed_at,created_at,updated_at,raw_user_meta_data)
 values(u,'authenticated','authenticated',false,'ember-test-'||u::text||'@example.invalid',now(),now(),now(),'{}'),
       (a,'authenticated','authenticated',false,'ember-admin-test-'||a::text||'@example.invalid',now(),now(),now(),'{}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api('{"action":"bootstrap"}');
 r:=public.wakppu_api('{"action":"halloween_cosmetics"}');
 if r->>'pet_version'<>'2' or r->>'ember_interval_ms'<>'1000' then raise exception 'Rework metadata missing';end if;
 begin perform public.wakppu_api(jsonb_build_object('action','ember_auto_hit','hit_action','item_hit','request_id',gen_random_uuid(),'item_revision',r->'revision'));raise exception 'Non-owner attacked';exception when sqlstate 'PT403' then null;end;
 update public.wakppu_halloween_cosmetics set owned=owned||'{"pumpkin_ember":true}'::jsonb where user_id=u;
 r:=public.wakppu_api('{"action":"halloween_cosmetics"}');
 perform public.wakppu_api(jsonb_build_object('action','halloween_decor_equip','item_id','pumpkin_ember','request_id',gen_random_uuid(),'item_revision',r->'revision','decor_revision',r->'decor_revision'));
 update public.game_states set gold=1999999,rebirths=0,hammer_owned=true,hammer_level=30,hammer_selected_level=30,honey_expires_at=null,coating_expires_at=null,current_ball_id='yellow',selected_ball_id='yellow',current_clicks=0,item_current_clicks=0 where user_id=u;
 r:=public.wakppu_api('{"action":"items"}');
 if r#>>'{pet_timing,animation}'<>'1' then raise exception 'Old animation bonus retained';end if;
 request:=jsonb_build_object('action','ember_auto_hit','hit_action','item_hit','request_id',gen_random_uuid(),'item_revision',r->'revision');
 first_r:=public.wakppu_api(request);
 if first_r->>'reward'<>'1' or first_r->>'gold'<>'2000000' or first_r#>>'{blue_gems,balance}'<>'1' then raise exception 'Real auto attack/reward/gem mismatch';end if;
 if public.wakppu_api(request)<>first_r then raise exception 'Replay mismatch';end if;
 if (select gold from public.game_states where user_id=u)<>2000000 then raise exception 'Replay duplicated reward';end if;
 if (select cardinality(hits) from public.wakppu_input_guard where user_id=u)<>0 then raise exception 'Pet counted as macro evidence';end if;
 begin perform public.wakppu_api(request||jsonb_build_object('request_id',gen_random_uuid(),'item_revision',first_r->'revision'));raise exception 'Cooldown bypassed';exception when sqlstate 'PT429' then null;end;
 -- Verify compatibility with actual paid auto rebirth, using a rollback-only test grant.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api('{"action":"bootstrap"}');update public.players set role='admin' where user_id=a;
 perform public.wakppu_api(jsonb_build_object('action','admin_paid_grant','user_id',u,'product_id','auto_rebirth','request_id',gen_random_uuid(),'reason','불씨 자동환생 롤백 검증'));
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api('{"action":"auto_rebirth_toggle","enabled":true}');
 select * into s from public.game_states where user_id=u;
 r:=public.wakppu_api(jsonb_build_object('action','auto_rebirth_run','rebirths',s.rebirths,'item_revision',s.item_revision));
 if r->>'performed'<>'true' or r#>>'{progress,gold}'<>'0' or public.wakppu_equipped_pet(u) is distinct from 'pumpkin_ember' then raise exception 'Auto rebirth lost pet or failed';end if;
 r:=public.wakppu_api('{"action":"items"}');
 perform public.wakppu_api(jsonb_build_object('action','item_hit','hit_source','ember_auto','request_id',gen_random_uuid(),'item_revision',r->'revision'));
 if (select cardinality(hits) from public.wakppu_input_guard where user_id=u)<>1 then raise exception 'Manual source spoof bypassed telemetry';end if;
 -- Unequip and role/session changes must not leave a free automatic hit path.
 r:=public.wakppu_api('{"action":"halloween_cosmetics"}');
 perform public.wakppu_api(jsonb_build_object('action','halloween_decor_equip','item_id',null,'request_id',gen_random_uuid(),'item_revision',r->'revision','decor_revision',r->'decor_revision'));
 begin perform public.wakppu_api(request||jsonb_build_object('request_id',gen_random_uuid()));raise exception 'Unequipped pet attacked';exception when sqlstate 'PT403' then null;end;
 if has_table_privilege('anon','public.wakppu_ember_hit_requests','SELECT') or has_function_privilege('authenticated','public.wakppu_api_before_ember_auto(jsonb)','EXECUTE') then raise exception 'Private auto state exposed';end if;
end $check$;
rollback;
select true as ember_auto_verified,true as all_test_changes_rolled_back;
