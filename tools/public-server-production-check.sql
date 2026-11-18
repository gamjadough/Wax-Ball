-- Synthetic public-server checks. Every account and game change rolls back.
begin;
do $check$
declare u uuid:=gen_random_uuid();a uuid:=gen_random_uuid();g uuid:=gen_random_uuid();
r jsonb;x jsonb;req jsonb;before_gold numeric;rid uuid:=gen_random_uuid();
begin
 insert into auth.users(id,aud,role,is_anonymous,email,email_confirmed_at,created_at,updated_at,raw_user_meta_data)
 values(u,'authenticated','authenticated',false,'public-test-'||u||'@example.invalid',now(),now(),now(),'{}'),
 (a,'authenticated','authenticated',false,'public-admin-'||a||'@example.invalid',now(),now(),now(),'{}'),
 (g,'authenticated','authenticated',true,null,null,now(),now(),'{}');
 update public.players set role='admin' where user_id=a;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 r:=public.wakppu_api('{"action":"bootstrap"}');
 if r#>>'{state,gold}'<>'0' then raise exception 'Public account not fresh';end if;
 update public.game_states set gold=0,hammer_owned=true,hammer_level=30,hammer_selected_level=30 where user_id=u;
 r:=public.wakppu_api('{"action":"items"}');
 req:=jsonb_build_object('action','item_hit','request_id',gen_random_uuid(),'item_revision',r->'revision');
 x:=public.wakppu_api(req);
 if x->>'reward'<>'1' or x#>>'{blue_gems,balance}'<>'1' then raise exception 'Hit rewards mismatch %',x;end if;
 perform public.wakppu_api(req);
 if (select gold from public.game_states where user_id=u)<>1 then raise exception 'Duplicate reward';end if;
 if (select first_play_at from public.guest_lifecycle where user_id=g) is not null then raise exception 'Unplayed guest flagged';end if;
 r:=public.wakppu_api('{"action":"monthly_rankings"}');
 if r#>>'{me,clicks}'<>'1' then raise exception 'Monthly count mismatch';end if;
 r:=public.wakppu_api('{"action":"purchase_catalog"}');
 if (r->>'enabled')::boolean then raise exception 'Payments enabled';end if;
 begin
  perform public.wakppu_api(jsonb_build_object('action','purchase_order','product_id','starlight_skin','depositor','테스트','request_id',gen_random_uuid()));
  raise exception 'Payment accepted';
 exception when sqlstate 'PT409' then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','is_anonymous',false)::text,true);
 r:=public.wakppu_api('{"action":"custom_status"}');
 if r->>'plan'<>'all' or r->'presets'?'pumpkin:eclipse' or r->'balls'?'halloween-pumpkin-2026' then raise exception 'Public custom catalog invalid';end if;
 begin perform public.wakppu_api('{"action":"limited_select","ball_id":"halloween-pumpkin-2026"}');raise exception 'Season accessible';
 exception when sqlstate 'PT403' then null;end;
 begin perform public.wakppu_api('{"action":"halloween_decor_equip","item_id":"pumpkin_ember"}');raise exception 'Pet accessible';
 exception when sqlstate 'PT403' then null;end;
 perform public.wakppu_api(jsonb_build_object('action','admin_paid_grant','user_id',u,'product_id','auto_rebirth','request_id',gen_random_uuid(),'reason','공개 서버 롤백 검증'));
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api('{"action":"auto_rebirth_toggle","enabled":true}');
 update public.game_states set gold=2000000,rebirths=0 where user_id=u;
 r:=public.wakppu_api('{"action":"items"}');
 x:=public.wakppu_api(jsonb_build_object('action','auto_rebirth_run','rebirths',0,'item_revision',r->'revision'));
 if x->>'performed'<>'true' then raise exception 'Auto rebirth failed';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',g,'role','authenticated','is_anonymous',true)::text,true);
 perform public.wakppu_api('{"action":"mark_first_play"}');
 if (select first_play_at from public.guest_lifecycle where user_id=g) is null then raise exception 'First play not tracked';end if;
 if exists(select 1 from public.wakppu_profile_card_defs where card_id like 'halloween_%') then raise exception 'Seasonal cards present';end if;
 if not exists(select 1 from cron.job where jobname='wakppu-unplayed-guest-cleanup' and active) then raise exception 'Cleanup not scheduled';end if;
 if has_function_privilege('authenticated','public.wakppu_public_base_api(jsonb)','execute') or has_table_privilege('anon','public.wakppu_purchase_config','select') then raise exception 'Private data exposed';end if;
end $check$;
rollback;
select true as public_gameplay_verified,true as test_changes_rolled_back;
