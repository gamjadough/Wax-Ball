-- Only synthetic accounts; all writes are rolled back. Preserve maintenance.
begin;
do $check$
declare u uuid:=gen_random_uuid();a uuid:=gen_random_uuid();paused boolean;r jsonb;req jsonb;d record;n numeric:=0;deadline numeric;
begin
 select maintenance into paused from public.server_settings limit 1;
 insert into auth.users(id,aud,role,is_anonymous,email,email_confirmed_at,created_at,updated_at,raw_user_meta_data)
 values(u,'authenticated','authenticated',false,'gem-boost-'||u::text||'@example.invalid',now(),now(),now(),'{}'),
 (a,'authenticated','authenticated',false,'gem-boost-'||a::text||'@example.invalid',now(),now(),now(),'{}');
 update public.game_states set gold=1,hammer_owned=true,hammer_level=30,hammer_selected_level=30 where user_id in(u,a);
 update public.players set role='admin' where user_id=a;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 r:=public.wakppu_blue_gem_boost_snapshot(u);
 if r->>'price'<>'100' or r->>'active_multiplier'<>'1' or r->>'stock'<>'0' then raise exception 'Bad initial booster';end if;
 if paused then
  begin perform public.wakppu_api('{"action":"blue_gem_boost_buy"}');raise exception 'Maintenance bypassed';exception when sqlstate 'PT503' then null;end;
 else
  perform public.wakppu_api('{"action":"bootstrap"}');
  insert into public.wakppu_blue_gems(user_id,balance) values(u,200) on conflict(user_id) do update set balance=200;
  for i in 1..2 loop
   r:=public.wakppu_api('{"action":"items"}');req:=jsonb_build_object('action','blue_gem_boost_buy','request_id',gen_random_uuid(),'item_revision',r->'revision','gem_revision',public.wakppu_blue_gem_snapshot(u)->'revision');
   r:=public.wakppu_api(req);if public.wakppu_api(req)<>r then raise exception 'Buy replay changed';end if;
  end loop;
  if r#>>'{inventory,blue_gem_boost}'<>'2' or r#>>'{blue_gems,balance}'<>'0' or r#>>'{blue_gems,boost,active_multiplier}'<>'1' then raise exception 'Bad stock/payment';end if;
  for i in 1..2 loop
   req:=jsonb_build_object('action','item_use','item_id','blue_gem_boost','request_id',gen_random_uuid(),'item_revision',r->'revision');r:=public.wakppu_api(req);
   if public.wakppu_api(req)<>r then raise exception 'Use replay changed';end if;
   if i=1 then deadline:=(r#>>'{blue_gems,boost,expires_at}')::numeric;
   elsif (r#>>'{blue_gems,boost,expires_at}')::numeric-deadline<>600000 then raise exception 'Bad duration stacking';end if;
  end loop;
  if r#>>'{inventory,blue_gem_boost}'<>'0' or r#>>'{blue_gems,boost,active_multiplier}'<>'2' then raise exception 'Bad activation';end if;
  req:=jsonb_build_object('action','item_hit','request_id',gen_random_uuid(),'item_revision',r->'revision');r:=public.wakppu_api(req);
  if r#>>'{blue_gems,balance}'<>'2' or r->>'gold'<>'2' then raise exception 'Ordinary reward changed';end if;n:=2;
  insert into public.wakppu_gem_ball_players(user_id,owned) select u,jsonb_agg(ball_id) from public.wakppu_gem_ball_defs on conflict(user_id) do update set owned=excluded.owned;
  for d in select * from public.wakppu_gem_ball_defs order by unlock_order loop
   r:=public.wakppu_api(jsonb_build_object('action','gem_ball_select','ball_id',d.ball_id,'request_id',gen_random_uuid(),'item_revision',r->'revision'));
   req:=jsonb_build_object('action','item_hit','request_id',gen_random_uuid(),'item_revision',r->'revision');r:=public.wakppu_api(req);n:=n+d.gem_reward*2;
   if (r->>'gem_reward')::numeric<>d.gem_reward*2 or (r#>>'{blue_gems,balance}')::numeric<>n or r->>'gold'<>'2' then raise exception 'Bad gem reward';end if;
   perform public.wakppu_api(req);if (select balance from public.wakppu_blue_gems where user_id=u)<>n then raise exception 'Double reward';end if;
  end loop;
 end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','is_anonymous',false)::text,true);
 insert into public.wakppu_blue_gem_boosts(user_id,stock,admin_expires_at) values(a,4,clock_timestamp()+interval '10 minutes');
 if public.wakppu_blue_gem_boost_multiplier(a)<>2 then raise exception 'Admin free activation';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','is_anonymous',true)::text,true);
 if public.wakppu_blue_gem_boost_multiplier(a)<>1 then raise exception 'Anonymous admin activation';end if;
 if has_table_privilege('authenticated','public.wakppu_blue_gem_boosts','SELECT') or has_function_privilege('anon','public.wakppu_blue_gem_boost_multiplier(uuid)','EXECUTE') or has_function_privilege('authenticated','public.wakppu_api_before_gem_boost(jsonb)','EXECUTE') then raise exception 'Private booster access';end if;
end $check$;
rollback;
select true as gem_boost_verified,true as synthetic_changes_rolled_back,(select maintenance from public.server_settings limit 1) as maintenance_preserved;
