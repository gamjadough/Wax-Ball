-- Real RPCs and private entitlement changes for synthetic users only; rollback everything.
begin;
do $check$
declare u uuid:=gen_random_uuid();a uuid:=gen_random_uuid();n text;r jsonb;s public.game_states%rowtype;o uuid;regular_o uuid;stock jsonb;bonus integer;
begin
 insert into auth.users(id,aud,role,is_anonymous,email,email_confirmed_at,created_at,updated_at,raw_user_meta_data)
 values(u,'authenticated','authenticated',false,'supporter-card-test-'||u::text||'@example.invalid',now(),now(),now(),'{}'),
       (a,'authenticated','authenticated',false,'supporter-card-admin-'||a::text||'@example.invalid',now(),now(),now(),'{}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api('{"action":"bootstrap"}');select nickname into n from public.players where user_id=u;
 r:=public.wakppu_api('{"action":"profile_status"}');
 if r->'owned' ?| array['supporter_glow','premium_celestial'] then raise exception 'Unowned paid cards visible';end if;
 begin perform public.wakppu_api('{"action":"profile_equip","card_id":"supporter_glow"}');raise exception 'Non-owner equip allowed';exception when sqlstate 'PT400' then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api('{"action":"bootstrap"}');update public.players set role='admin' where user_id=a;
 perform public.wakppu_api(jsonb_build_object('action','admin_paid_grant','user_id',u,'product_id','supporter_pack','request_id',gen_random_uuid(),'reason','후원 카드 롤백 검증'));
 select order_id into regular_o from public.wakppu_purchase_entitlements where user_id=u and product_id='supporter_pack';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 r:=public.wakppu_api('{"action":"profile_status"}');
 if not r->'owned' ? 'supporter_glow' or r->'owned' ? 'premium_celestial' or r->>'equipped'<>'wax_beginning' then raise exception 'Regular card eligibility mismatch';end if;
 perform public.wakppu_api('{"action":"profile_equip","card_id":"supporter_glow"}');
 begin perform public.wakppu_api('{"action":"profile_equip","card_id":"premium_celestial"}');raise exception 'Regular equipped premium';exception when sqlstate 'PT400' then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api(jsonb_build_object('action','admin_paid_grant','user_id',u,'product_id','premium_supporter_pack','request_id',gen_random_uuid(),'reason','프리미엄 카드 롤백 검증'));
 select order_id into o from public.wakppu_purchase_entitlements where user_id=u and product_id='premium_supporter_pack';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 r:=public.wakppu_api('{"action":"profile_status"}');if not r->'owned' ?& array['supporter_glow','premium_celestial'] then raise exception 'Premium did not include both cards';end if;
 perform public.wakppu_api('{"action":"items"}');select inventory into stock from public.wakppu_items where user_id=u;
 select * into s from public.game_states where user_id=u;bonus:=public.wakppu_supporter_percent(u);
 perform public.wakppu_api('{"action":"profile_title","title_id":"none"}');
 perform public.wakppu_api('{"action":"profile_equip","card_id":"premium_celestial"}');
 perform public.wakppu_api('{"action":"profile_equip","card_id":null}');
 r:=public.wakppu_api('{"action":"profile_equip","card_id":"premium_celestial"}');if r->>'equipped'<>'premium_celestial' or r->'title'<>'null' then raise exception 'Equip/title changed';end if;
 r:=public.wakppu_api(jsonb_build_object('action','player_profile','nickname',n));if r#>>'{card,id}'<>'premium_celestial' then raise exception 'Public premium artwork mismatch';end if;
 if r ?| array['email','user_id','moderation','last_seen_at'] then raise exception 'Private data exposed';end if;
 if exists(select 1 from public.game_states where user_id=u and (gold<>s.gold or rebirths<>s.rebirths or unlocked_ball_ids<>s.unlocked_ball_ids or discovered_ball_ids<>s.discovered_ball_ids or hammer_level<>s.hammer_level or supporter_gold_remainder<>s.supporter_gold_remainder)) or (select inventory from public.wakppu_items where user_id=u) is distinct from stock or public.wakppu_supporter_percent(u)<>bonus then raise exception 'Progress, inventory or bonus changed';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','is_anonymous',false)::text,true);
 begin perform public.wakppu_api(jsonb_build_object('action','profile_equip','card_id','premium_celestial','user_id',u));raise exception 'Cross-account equip allowed';exception when sqlstate 'PT403' then null;end;
 perform public.wakppu_api(jsonb_build_object('action','admin_paid_revoke','user_id',u,'order_id',o,'reason','프리미엄 카드 회수 검증'));
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 r:=public.wakppu_api('{"action":"profile_status"}');if r->>'equipped'<>'wax_beginning' or r->'owned' ? 'premium_celestial' or not r->'owned' ? 'supporter_glow' then raise exception 'Premium revocation mismatch';end if;
 perform public.wakppu_api('{"action":"profile_equip","card_id":"supporter_glow"}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api(jsonb_build_object('action','admin_paid_revoke','user_id',u,'order_id',regular_o,'reason','후원 카드 회수 검증'));
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 r:=public.wakppu_api(jsonb_build_object('action','player_profile','nickname',n));if r#>>'{card,id}'<>'wax_beginning' then raise exception 'Revoked card still public';end if;
 if has_function_privilege('anon','public.wakppu_profile_card_available(uuid,text)','EXECUTE') or has_function_privilege('authenticated','public.wakppu_supporter_card_cleanup()','EXECUTE') then raise exception 'Private helpers exposed';end if;
end $check$;
rollback;
select true as supporter_profiles_verified,true as all_test_changes_rolled_back;
