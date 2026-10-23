-- Production contract check with two new synthetic accounts only; roll back everything.
begin;
do $check$
declare u uuid:=gen_random_uuid();a uuid:=gen_random_uuid();n text;r jsonb;s public.game_states%rowtype;
begin
 insert into auth.users(id,aud,role,is_anonymous,email,email_confirmed_at,created_at,updated_at,raw_user_meta_data)
 values(u,'authenticated','authenticated',false,'title-test-'||u::text||'@example.invalid',now(),now(),now(),'{}'),
       (a,'authenticated','authenticated',false,'title-test-'||a::text||'@example.invalid',now(),now(),now(),'{}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api('{"action":"bootstrap"}');
 select nickname into n from public.players where user_id=u;
 perform public.wakppu_api('{"action":"profile_equip","card_id":null}');
 begin perform public.wakppu_api('{"action":"profile_title","title_id":"premium"}');raise exception 'Unowned title permitted';
 exception when sqlstate 'PT403' then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api('{"action":"bootstrap"}');update public.players set role='admin' where user_id=a;
 perform public.wakppu_api(jsonb_build_object('action','admin_paid_grant','user_id',u,'product_id','premium_supporter_pack','request_id',gen_random_uuid(),'reason','프로필 칭호 롤백 검증'));
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api('{"action":"bootstrap"}');
 update public.game_states set gold=1e3000,rebirths=1000 where user_id=u;
 select * into s from public.game_states where user_id=u;
 r:=public.wakppu_api('{"action":"profile_title","title_id":"supporter"}');
 if r->>'title'<>'왁뿌볼 후원자' or r->'equipped'<>'null' then raise exception 'Title changed card or wrong title';end if;
 r:=public.wakppu_api(jsonb_build_object('action','player_profile','nickname',n));
 if r->>'title'<>'왁뿌볼 후원자' then raise exception 'Public title mismatch';end if;
 r:=public.wakppu_api('{"action":"rankings"}');
 if (select value->>'profile_title' from jsonb_array_elements(r) where value->>'nickname'=n) is distinct from '왁뿌볼 후원자' then raise exception 'Ranking title mismatch';end if;
 perform public.wakppu_api('{"action":"profile_title","title_id":"none"}');
 r:=public.wakppu_api('{"action":"profile_status"}');
 if r->'title'<>'null' or r->>'title_equipped'<>'none' then raise exception 'Title unequip not saved';end if;
 perform public.wakppu_api('{"action":"profile_title","title_id":"premium"}');
 perform public.wakppu_api('{"action":"purchase_title","visible":false}');
 if public.wakppu_api('{"action":"profile_status"}')->'title'<>'null' then raise exception 'Existing title hide ignored';end if;
 r:=public.wakppu_api('{"action":"profile_title","title_id":"auto"}');
 if r->>'title'<>'프리미엄 후원자' or public.wakppu_supporter_percent(u)<>30 then raise exception 'Auto or bonus changed';end if;
 begin perform public.wakppu_api(jsonb_build_object('action','profile_title','title_id','none','user_id',a));raise exception 'Cross-account write permitted';
 exception when sqlstate 'PT403' then null;end;
 if exists(select 1 from public.game_states where user_id=u and (gold<>s.gold or rebirths<>s.rebirths or unlocked_ball_ids<>s.unlocked_ball_ids or discovered_ball_ids<>s.discovered_ball_ids or hammer_level<>s.hammer_level or supporter_gold_remainder<>s.supporter_gold_remainder)) then raise exception 'Progress or reward state changed';end if;
 delete from public.wakppu_purchase_entitlements where user_id=u and product_id='premium_supporter_pack';
 begin perform public.wakppu_api('{"action":"profile_title","title_id":"premium"}');raise exception 'Revoked title permitted';
 exception when sqlstate 'PT403' then null;end;
 if has_function_privilege('authenticated','public.wakppu_profile_title_state(uuid)','EXECUTE') or has_function_privilege('anon','public.wakppu_api_before_profile_titles(jsonb)','EXECUTE') then raise exception 'Private helper exposed';end if;
end $check$;
rollback;
select true as profile_titles_verified,true as test_changes_rolled_back;
