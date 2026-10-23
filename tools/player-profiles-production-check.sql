-- Only synthetic accounts, all changes rolled back; no real player is edited.
begin;
do $check$
declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();n text;r jsonb;s public.game_states%rowtype;stock jsonb;
begin
 insert into auth.users(id,aud,role,is_anonymous,email,email_confirmed_at,created_at,updated_at,raw_user_meta_data)
 values(u,'authenticated','authenticated',false,'profile-test-'||u::text||'@example.invalid',now(),now(),now(),'{}'),
       (v,'authenticated','authenticated',false,'profile-test-'||v::text||'@example.invalid',now(),now(),now(),'{}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api('{"action":"bootstrap"}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api('{"action":"bootstrap"}');
 update public.game_states set gold=1e3000,rebirths=1000 where user_id=u;
 select nickname into n from public.players where user_id=u;
 perform public.wakppu_api('{"action":"items"}');
 select inventory into stock from public.wakppu_items where user_id=u;
 select * into s from public.game_states where user_id=u;
 r:=public.wakppu_api('{"action":"profile_status"}');
 if r->>'equipped'<>'wax_beginning' or r->'owned'<>'["wax_beginning"]' then raise exception 'Default free card failed';end if;
 perform public.wakppu_api('{"action":"profile_equip","card_id":null}');
 r:=public.wakppu_api('{"action":"profile_status"}');
 if r->'equipped'<>'null' then raise exception 'Unequip persistence failed';end if;
 perform public.wakppu_api('{"action":"bootstrap"}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v,'role','authenticated','is_anonymous',false)::text,true);
 r:=public.wakppu_api(jsonb_build_object('action','player_profile','nickname',n));
 if r->'card'<>'null' or r->>'online'<>'false' or length(r->>'gold')<>3001 or (r->>'rebirths')::int<>1000 or r->>'rank' is null then raise exception 'Public stats or unequip failed';end if;
 if (select count(*) from jsonb_object_keys(r))<>9 or r ?| array['email','user_id','last_seen_at','moderation','role'] then raise exception 'Private data exposed';end if;
 begin perform public.wakppu_api(jsonb_build_object('action','profile_equip','card_id',null,'user_id',u));raise exception 'Cross-account write permitted';
 exception when sqlstate 'PT403' then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api('{"action":"presence_ping"}');
 perform public.wakppu_api('{"action":"profile_equip","card_id":"wax_beginning"}');
 r:=public.wakppu_api(jsonb_build_object('action','player_profile','nickname',n));
 if r->>'online'<>'true' or r#>>'{card,id}'<>'wax_beginning' then raise exception 'Presence or equip failed';end if;
 if exists(select 1 from public.game_states where user_id=u and (gold<>s.gold or rebirths<>s.rebirths or unlocked_ball_ids<>s.unlocked_ball_ids or discovered_ball_ids<>s.discovered_ball_ids or hammer_level<>s.hammer_level)) or
  (select inventory from public.wakppu_items where user_id=u) is distinct from stock then raise exception 'Progress modified by cards';end if;
 update public.players set ranking_hidden=true where user_id=u;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v,'role','authenticated','is_anonymous',false)::text,true);
 begin perform public.wakppu_api(jsonb_build_object('action','player_profile','nickname',n));raise exception 'Hidden profile exposed';
 exception when sqlstate 'PT404' then null;end;
 if has_table_privilege('authenticated','public.wakppu_profile_cards','SELECT') or has_table_privilege('anon','public.wakppu_profile_card_defs','SELECT') or has_function_privilege('authenticated','public.wakppu_api_before_profiles(jsonb)','EXECUTE') then raise exception 'Private storage exposed';end if;
end $check$;
rollback;
select true as player_profiles_verified,true as test_changes_rolled_back;
