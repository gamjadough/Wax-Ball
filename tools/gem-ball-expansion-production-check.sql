-- New synthetic accounts only; every account, purchase and reward is rolled back.
begin;
do $check$
declare u uuid:=gen_random_uuid();a uuid:=gen_random_uuid();r jsonb;req jsonb;d record;expected_balance numeric:=630000;g numeric;paused boolean;
begin
 select maintenance into paused from public.server_settings limit 1;
 insert into auth.users(id,aud,role,is_anonymous,email,email_confirmed_at,created_at,updated_at,raw_user_meta_data)
 values(u,'authenticated','authenticated',false,'gem-catalog-'||u::text||'@example.invalid',now(),now(),now(),'{}'),
 (a,'authenticated','authenticated',false,'gem-catalog-'||a::text||'@example.invalid',now(),now(),now(),'{}');
 -- Mark only these temporary accounts as previously played for the friends gate.
 update public.game_states set gold=1 where user_id in(u,a);
 update public.players set role='admin' where user_id=a;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 r:=public.wakppu_gem_ball_snapshot(u);
 if jsonb_array_length(r->'catalog')<>4 or r->'owned'<>'[]'::jsonb then raise exception 'Bad initial catalog';end if;
 if paused then
  -- Preserve maintenance: do not change the setting even inside this transaction.
  begin perform public.wakppu_api('{"action":"gem_balls"}');raise exception 'Maintenance bypassed';exception when sqlstate 'PT503' then null;end;
 else
  perform public.wakppu_api('{"action":"bootstrap"}');
  r:=public.wakppu_api('{"action":"items"}');
  begin perform public.wakppu_api(jsonb_build_object('action','gem_ball_buy','ball_id','stellar-crystal-core','item_revision',r->'revision','request_id',gen_random_uuid()));raise exception 'Prerequisite bypassed';exception when sqlstate 'PT403' then null;end;
  insert into public.wakppu_blue_gems(user_id,balance) values(u,expected_balance) on conflict(user_id) do update set balance=630000;
  select gold into g from public.game_states where user_id=u;
  for d in select * from public.wakppu_gem_ball_defs order by unlock_order loop
   r:=public.wakppu_api('{"action":"items"}');req:=jsonb_build_object('action','gem_ball_buy','ball_id',d.ball_id,'request_id',gen_random_uuid(),'item_revision',r->'revision');r:=public.wakppu_api(req);perform public.wakppu_api(req);expected_balance:=expected_balance-d.price;
   if (r#>>'{blue_gems,balance}')::numeric<>expected_balance then raise exception 'Bad purchase';end if;
   r:=public.wakppu_api(jsonb_build_object('action','gem_ball_select','ball_id',d.ball_id,'request_id',gen_random_uuid(),'item_revision',r->'revision'));
   update public.game_states set hammer_owned=true,hammer_level=30,hammer_selected_level=30 where user_id=u;
   req:=jsonb_build_object('action','item_hit','request_id',gen_random_uuid(),'item_revision',r->'revision');r:=public.wakppu_api(req);expected_balance:=expected_balance+d.gem_reward;
   if r->>'broken'<>'true' or (r->>'required_clicks')::bigint<>d.clicks or (r->>'gem_reward')::numeric<>d.gem_reward or r->>'reward'<>'0' or (r->>'gold')::numeric<>g or (r#>>'{blue_gems,balance}')::numeric<>expected_balance then raise exception 'Bad ball reward: %',d.ball_id;end if;
   perform public.wakppu_api(req);if (select balance from public.wakppu_blue_gems where user_id=u)<>expected_balance then raise exception 'Replay paid twice';end if;
  end loop;
  if expected_balance<>45 then raise exception 'Bad total reward';end if;
 end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','is_anonymous',false)::text,true);
 r:=public.wakppu_gem_ball_snapshot(a);if r->>'admin_access'<>'true' or jsonb_array_length(r->'catalog')<>4 or r->'owned'<>'[]'::jsonb then raise exception 'Admin catalog access';end if;
 if not paused then
  for d in select * from public.wakppu_gem_ball_defs order by unlock_order loop
   r:=public.wakppu_api('{"action":"items"}');r:=public.wakppu_api(jsonb_build_object('action','gem_ball_select','ball_id',d.ball_id,'request_id',gen_random_uuid(),'item_revision',r->'revision'));
   if r#>>'{gem_balls,selected}'<>d.ball_id or r#>'{gem_balls,owned}'<>'[]'::jsonb or r#>>'{blue_gems,balance}'<>'0' then raise exception 'Admin stock changed';end if;
  end loop;
 end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','is_anonymous',true)::text,true);
 if public.wakppu_gem_ball_snapshot(a)->>'admin_access'<>'false' then raise exception 'Anonymous admin bypass';end if;
 if has_table_privilege('authenticated','public.wakppu_gem_ball_players','SELECT') or has_function_privilege('anon','public.wakppu_gem_ball_hit(jsonb)','EXECUTE') then raise exception 'Private gem data exposed';end if;
end $check$;
rollback;
select true as gem_catalog_verified,true as synthetic_changes_rolled_back,(select maintenance from public.server_settings limit 1) as maintenance_preserved;
