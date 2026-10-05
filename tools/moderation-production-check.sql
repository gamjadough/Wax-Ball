-- Run in the production SQL editor after the moderation migration.
-- All profile, progress, moderation, settings and audit mutations are rolled back.
begin;
do $test$
declare
 admin_id uuid; player_id uuid; nickname text; saved game_states;
 result jsonb; logs_before bigint; updated_rows bigint;
 api_body text; blocked_action text;
begin
 select prosrc into api_body from pg_proc where oid=coalesce(to_regprocedure('public.wakppu_api_before_events(jsonb)'),to_regprocedure('public.wakppu_api(jsonb)'));
 if strpos(api_body,'admin_ranking_visibility')=0 or strpos(api_body,'admin_ban')=0 then raise exception 'Moderation migration is not installed'; end if;
 select p.user_id into admin_id from players p where p.role='admin' and not exists(select 1 from moderation_cases m where m.user_id=p.user_id and (m.status='banned' or (m.status='suspended' and (m.suspended_until is null or m.suspended_until>now())))) limit 1;
 select p.user_id,p.nickname into player_id,nickname from players p join game_states g using(user_id) where p.role<>'admin' limit 1;
 if admin_id is null or player_id is null then raise exception 'An existing administrator and non-admin player are required for transaction-only testing'; end if;
 select * into saved from game_states where user_id=player_id for update;
 perform 1 from players where user_id=player_id for update;
 select count(*) into logs_before from admin_audit_logs;
 -- Normalize test conditions inside this uncommitted transaction only.
 update server_settings set maintenance=false where id=true;
 update moderation_cases set status='active',suspended_until=null where user_id=player_id;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',player_id,'role','authenticated','is_anonymous',false)::text,true);
 begin
  perform wakppu_api(jsonb_build_object('action','admin_ranking_visibility','user_id',player_id,'hidden',true));
  raise exception 'Player visibility mutation was allowed';
 exception when sqlstate 'PT403' then null; end;
 begin
  perform wakppu_api(jsonb_build_object('action','admin_ban','user_id',player_id,'mode','permanent','reason','transaction-only-test'));
  raise exception 'Player ban mutation was allowed';
 exception when sqlstate 'PT403' then null; end;
 perform set_config('request.jwt.claims','{}',true);
 begin
  perform wakppu_api(jsonb_build_object('action','admin_ban','user_id',player_id,'mode','permanent','reason','transaction-only-test'));
  raise exception 'Unauthenticated ban was allowed';
 exception when sqlstate 'PT401' then null; end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated','is_anonymous',true)::text,true);
 begin
  perform wakppu_api(jsonb_build_object('action','admin_ban','user_id',player_id,'mode','permanent','reason','transaction-only-test'));
  raise exception 'Anonymous administrator ban was allowed';
 exception when sqlstate 'PT403' then null; end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated','is_anonymous',false)::text,true);
 perform wakppu_api(jsonb_build_object('action','admin_ranking_visibility','user_id',player_id,'hidden',true,'reason','transaction-only-hidden'));
 if exists(select 1 from jsonb_array_elements(wakppu_api('{"action":"rankings"}')) x where x->>'nickname'=nickname) then raise exception 'Hidden player remains in rankings'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',player_id,'role','authenticated','is_anonymous',false)::text,true);
 if (wakppu_api('{"action":"bootstrap"}')->'state'->>'gold')<>saved.gold::text then raise exception 'Ranking hide changed progress'; end if;
 perform wakppu_api(jsonb_build_object('action','save_progress','gold',saved.gold::text,'admin_revision',saved.admin_revision+1,'rebirths',saved.rebirths,'unlocked_ball_ids',saved.unlocked_ball_ids,'selected_ball_id',saved.selected_ball_id,'hammer_owned',saved.hammer_owned,'hammer_level',saved.hammer_level,'honey_expires_at',saved.honey_expires_at));
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated','is_anonymous',false)::text,true);
 perform wakppu_api(jsonb_build_object('action','admin_ranking_visibility','user_id',player_id,'hidden',false));
 if not exists(select 1 from jsonb_array_elements(wakppu_api('{"action":"rankings"}')) x where x->>'nickname'=nickname) then raise exception 'Restored player missing from rankings'; end if;
 perform wakppu_api(jsonb_build_object('action','admin_ban','user_id',player_id,'mode','temporary','duration_hours',24,'reason','transaction-only-ban'));
 if not exists(select 1 from moderation_cases where user_id=player_id and status='suspended' and suspended_until>now()) then raise exception 'Temporary ban not applied'; end if;
 if exists(select 1 from jsonb_array_elements(wakppu_api('{"action":"rankings"}')) x where x->>'nickname'=nickname) then raise exception 'Banned player remains in rankings'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',player_id,'role','authenticated','is_anonymous',false)::text,true);
 if (wakppu_api('{"action":"status"}')->'moderation'->>'blocked')<>'true' then raise exception 'Ban status unavailable'; end if;
 foreach blocked_action in array array['bootstrap','save_progress','rankings','set_nickname'] loop
  begin
   perform wakppu_api(jsonb_build_object('action',blocked_action));
   raise exception 'Banned action % was allowed',blocked_action;
  exception when sqlstate 'PT403' then null; end;
 end loop;
 update moderation_cases set suspended_until=now()-interval '1 second' where user_id=player_id;
 if (wakppu_api('{"action":"status"}')->'moderation'->>'blocked')<>'false' then raise exception 'Expired ban still blocks player'; end if;
 perform wakppu_api('{"action":"bootstrap"}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated','is_anonymous',false)::text,true);
 perform wakppu_api(jsonb_build_object('action','admin_ban','user_id',player_id,'mode','permanent','reason','transaction-only-permanent'));
 if not exists(select 1 from moderation_cases where user_id=player_id and status='banned' and suspended_until is null) then raise exception 'Permanent ban not applied'; end if;
 perform wakppu_api(jsonb_build_object('action','admin_ranking_visibility','user_id',player_id,'hidden',true));
 perform wakppu_api(jsonb_build_object('action','admin_unban','user_id',player_id));
 if not (select ranking_hidden from players where user_id=player_id) then raise exception 'Unban incorrectly removed independent ranking flag'; end if;
 if (select status from moderation_cases where user_id=player_id)<>'active' then raise exception 'Unban failed'; end if;
 begin
  perform wakppu_api(jsonb_build_object('action','admin_ban','user_id',admin_id,'mode','permanent','reason','transaction-only-admin'));
  raise sqlstate 'P0002' using message='Administrator ban was allowed';
 exception when sqlstate 'P0001' then null; end;
 if (select count(*) from admin_audit_logs)<>logs_before+6 then raise exception 'Expected six moderation audit records'; end if;
 if not exists(select 1 from admin_audit_logs where admin_user_id=admin_id and target_user_id=player_id and action='ADMIN_BAN' and reason='transaction-only-ban' and details->'before' is not null and details->'after' is not null) then raise exception 'Ban audit missing'; end if;
 -- Verify effective RPC grants and RLS against direct self-modification.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',player_id,'role','authenticated','is_anonymous',false)::text,true);
 execute 'set local role authenticated';
 begin
  execute 'update public.players set ranking_hidden=false where user_id=auth.uid()';
  get diagnostics updated_rows=row_count;
  if updated_rows<>0 then raise exception 'Player bypassed moderation via direct table update'; end if;
 exception when insufficient_privilege then null; end;
 begin
  perform wakppu_api(jsonb_build_object('action','admin_ban','user_id',player_id,'mode','permanent','reason','test'));
  raise exception 'Authenticated player RPC bypass';
 exception when sqlstate 'PT403' then null; end;
 execute 'reset role';
end $test$;
rollback;
select 'PASS: ranking hide/show, playable hidden account, temporary/permanent bans, expiry/unban, independent flags, audit, admin protection, player/anonymous/unauthenticated denial and direct-table RLS; all test changes rolled back' as verification;
