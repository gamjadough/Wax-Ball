-- Synthetic accounts and deletion run only inside a transaction that is rolled back.
begin;
do $test$
declare expired_id uuid:=gen_random_uuid(); played_id uuid:=gen_random_uuid(); linked_id uuid:=gen_random_uuid(); admin_id uuid; result jsonb;
begin
 if exists(select 1 from wakppu_guest_accounts() where eligible and delete_at<=now()) then raise exception 'Real cleanup candidates exist; transaction-only test must not run'; end if;
 select user_id into admin_id from players where role='admin' limit 1;
 if admin_id is null then raise exception 'Administrator required'; end if;
 insert into auth.users(id,aud,role,is_anonymous,created_at,updated_at,raw_user_meta_data)
 values(expired_id,'authenticated','authenticated',true,now()-interval '4 days',now(),'{}'),
       (played_id,'authenticated','authenticated',true,now()-interval '4 days',now(),'{}'),
       (linked_id,'authenticated','authenticated',true,now()-interval '4 days',now(),'{"wakppu_email_link_pending":true}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',expired_id,'is_anonymous',true)::text,true);
 perform wakppu_api('{"action":"bootstrap"}');
 perform wakppu_api('{"action":"status"}');
 perform wakppu_api('{"action":"save_progress","gold":"0","rebirths":0,"admin_revision":0,"unlocked_ball_ids":["yellow"],"selected_ball_id":"yellow","current_clicks":0}');
 if (select first_play_at from guest_lifecycle where user_id=expired_id) is not null then raise exception 'Auto-save falsely counted as play'; end if;
 begin
  perform wakppu_api('{"action":"admin_guest_accounts"}');
  raise exception 'Player could read cleanup accounts';
 exception when sqlstate 'PT403' then null; end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',played_id,'is_anonymous',true)::text,true);
 perform wakppu_api('{"action":"mark_first_play"}');
 if (select first_play_at from guest_lifecycle where user_id=played_id) is null then raise exception 'First play not recorded'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'is_anonymous',false)::text,true);
 result:=wakppu_api(jsonb_build_object('action','admin_guest_accounts','filter','due','query',expired_id::text));
 if (result->>'total')::integer<>1 then raise exception 'Deletion list mismatch'; end if;
 result:=wakppu_api(jsonb_build_object('action','admin_guest_accounts','filter','protected','query',played_id::text));
 if (result->>'total')::integer<>1 then raise exception 'Played account not protected'; end if;
 result:=wakppu_api(jsonb_build_object('action','admin_guest_accounts','filter','protected','query',linked_id::text));
 if (result->>'total')::integer<>1 then raise exception 'Email-link account not protected'; end if;
 perform wakppu_api(jsonb_build_object('action','admin_ranking_visibility','user_id',expired_id,'hidden',true));
 if wakppu_cleanup_unplayed_guests()<>1 then raise exception 'Cleanup count mismatch'; end if;
 if exists(select 1 from auth.users where id=expired_id) or exists(select 1 from players where user_id=expired_id) or exists(select 1 from game_states where user_id=expired_id) or exists(select 1 from moderation_cases where user_id=expired_id) or exists(select 1 from guest_lifecycle where user_id=expired_id) then raise exception 'Deletion cascade incomplete'; end if;
 if (select count(*) from auth.users where id in (played_id,linked_id))<>2 then raise exception 'Protected accounts were removed'; end if;
 if not exists(select 1 from admin_audit_logs where target_user_id is null and details->>'deleted_target_user_id'=expired_id::text) then raise exception 'Audit record not preserved'; end if;
 if wakppu_cleanup_unplayed_guests()<>0 then raise exception 'Repeat cleanup removed protected account'; end if;
 execute 'set local role authenticated';
 begin
  perform wakppu_cleanup_unplayed_guests();
  raise exception 'Browser role could execute cleanup';
 exception when insufficient_privilege then null; end;
 execute 'reset role';
end $test$;
rollback;
select 'PASS: creation tracking, auto-save exclusion, first-play and email protection, admin query authorization, deletion cascade and preserved audit; synthetic accounts and all changes rolled back' as verification;
