-- Synthetic players only. Roll back identities, rewards and selections after testing.
begin;
do $check$
declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();n text;r jsonb;s public.game_states%rowtype;stock jsonb;stamp timestamptz;
begin
 insert into auth.users(id,aud,role,is_anonymous,email,email_confirmed_at,created_at,updated_at,raw_user_meta_data)
 values(u,'authenticated','authenticated',false,'champion-test-'||u::text||'@example.invalid',now(),now(),now(),'{}'),
       (v,'authenticated','authenticated',false,'champion-test-'||v::text||'@example.invalid',now(),now(),now(),'{}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api('{"action":"bootstrap"}');
 update public.game_states set gold=power(10::numeric,4096)-1,rebirths=1000 where user_id=u;
 select nickname into n from public.players where user_id=u;
 r:=public.wakppu_api('{"action":"rankings"}');
 if r#>>'{0,nickname}'<>n then raise exception 'Synthetic player was not first; rollback';end if;
 if not exists(select 1 from public.wakppu_profile_card_grants where user_id=u and card_id='golden_champion') then raise exception 'First place was not granted';end if;
 select awarded_at into stamp from public.wakppu_profile_card_grants where user_id=u and card_id='golden_champion';
 perform public.wakppu_api('{"action":"items"}');
 select inventory into stock from public.wakppu_items where user_id=u;
 select * into s from public.game_states where user_id=u;
 r:=public.wakppu_api('{"action":"profile_status"}');
 if not r->'owned' ? 'golden_champion' or r->>'equipped'<>'wax_beginning' then raise exception 'Ownership or default equip mismatch';end if;
 perform public.wakppu_api('{"action":"profile_title","title_id":"none"}');
 perform public.wakppu_api('{"action":"profile_equip","card_id":"golden_champion"}');
 perform public.wakppu_api('{"action":"profile_equip","card_id":"golden_champion"}');
 if (select awarded_at from public.wakppu_profile_card_grants where user_id=u and card_id='golden_champion')<>stamp then raise exception 'Duplicate changed award';end if;
 if exists(select 1 from public.game_states where user_id=u and (gold<>s.gold or rebirths<>s.rebirths or unlocked_ball_ids<>s.unlocked_ball_ids or discovered_ball_ids<>s.discovered_ball_ids or hammer_level<>s.hammer_level)) or
  (select inventory from public.wakppu_items where user_id=u) is distinct from stock then raise exception 'Progress or stock changed';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api('{"action":"bootstrap"}');
 begin perform public.wakppu_api('{"action":"profile_equip","card_id":"golden_champion"}');raise exception 'Non-owner equip allowed';exception when sqlstate 'PT400' then null;end;
 begin perform public.wakppu_api(jsonb_build_object('action','profile_equip','card_id','golden_champion','user_id',u));raise exception 'Cross-account equip allowed';exception when sqlstate 'PT403' then null;end;
 update public.game_states set gold=0 where user_id=u;
 update public.game_states set gold=power(10::numeric,4096)-1,rebirths=1000 where user_id=v;
 r:=public.wakppu_api('{"action":"profile_status"}');
 if not r->'owned' ? 'golden_champion' then raise exception 'New champion was not granted';end if;
 r:=public.wakppu_api(jsonb_build_object('action','player_profile','nickname',n));
 if r#>>'{card,id}'<>'golden_champion' or r->'title'<>'null' then raise exception 'Former champion card/title did not persist';end if;
 if r ?| array['email','user_id','last_seen_at','moderation','role','awarded_at'] then raise exception 'Private profile data exposed';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api('{"action":"profile_equip","card_id":null}');
 r:=public.wakppu_api('{"action":"profile_equip","card_id":"golden_champion"}');
 if r->>'equipped'<>'golden_champion' then raise exception 'Former champion cannot re-equip';end if;
 if has_table_privilege('authenticated','public.wakppu_profile_card_grants','SELECT') or has_function_privilege('anon','public.wakppu_award_champion()','EXECUTE') or has_function_privilege('authenticated','public.wakppu_api_before_champion_cards(jsonb)','EXECUTE') then raise exception 'Private grants exposed';end if;
end $check$;
rollback;
select true as champion_profile_verified,true as all_test_changes_rolled_back;
