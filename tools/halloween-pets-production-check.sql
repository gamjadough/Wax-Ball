-- Disposable signed-in administrator: works while maintenance stays enabled.
begin;
do $check$
declare u uuid:=gen_random_uuid();s jsonb;r jsonb;req jsonb;base numeric;expected numeric;before_gold numeric;rewarded numeric;id text;carry integer;
begin
 insert into auth.users(id,aud,role,is_anonymous,created_at,updated_at,raw_user_meta_data) values(u,'authenticated','authenticated',false,now(),now(),'{}');
 insert into public.players(user_id,nickname,role) values(u,'펫검증'||substr(u::text,1,6),'admin') on conflict(user_id) do update set role='admin';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api('{"action":"bootstrap"}');s:=public.wakppu_api('{"action":"halloween_cosmetics"}');
 if (s->>'pet_version')::integer<>1 or jsonb_array_length(s->'catalog')<>3 then raise exception 'Pet catalog not live';end if;
 foreach id in array array['little_ghost','pumpkin_ember','bat_swarm',null,'little_ghost'] loop
  s:=public.wakppu_api(jsonb_build_object('action','halloween_decor_equip','item_id',id,'request_id',gen_random_uuid(),'item_revision',s->'revision','decor_revision',s->'decor_revision'));
  if s->>'equipped' is distinct from id then raise exception 'Permanent pet equip/unequip failed';end if;
  r:=public.wakppu_api('{"action":"items"}');
  if r#>>'{pet_timing,equipped}' is distinct from id or (r#>>'{pet_timing,animation}')::numeric<>(case when id='pumpkin_ember' then .9 else 1 end) or (r#>>'{pet_timing,respawn}')::numeric<>(case when id='bat_swarm' then .9 else 1 end) then raise exception 'Timing selection mismatch';end if;
 end loop;
 -- Ordinary finishing hit with rebirth, honey, coating and item reward multipliers.
 update public.game_states set selected_ball_id='yellow',current_ball_id='yellow',gold=0,rebirths=2,hammer_owned=false,hammer_level=0,hammer_selected_level=null,honey_expires_at=now()+interval '1 hour',coating_expires_at=now()+interval '1 hour',item_current_clicks=9 where user_id=u;
 update public.wakppu_items set effects='{"hero_destruction_crystal":{"remaining":10}}' where user_id=u;
 s:=public.wakppu_api('{"action":"items"}');
 req:=jsonb_build_object('action','item_hit','request_id',gen_random_uuid(),'item_revision',s->'revision','pet_timing',jsonb_build_object('equipped','forged'));
 r:=public.wakppu_api(req);rewarded:=(r->>'reward')::numeric;
 if rewarded<79 or r#>>'{pet_timing,equipped}'<>'little_ghost' then raise exception 'Stacked gold/hit failed: %',r;end if;
 if public.wakppu_api(req)->>'gold'<>r->>'gold' then raise exception 'Replay charged/rewarded twice';end if;
 -- Test the exact 10% bonus independently of any currently running global Gold event.
 update public.wakppu_halloween_cosmetics set pet_gold_remainder=0 where user_id=u;
 if public.wakppu_supporter_reward(u,100)<>110 then raise exception 'Exact 10 percent bonus failed';end if;
 rewarded:=0;for carry in 1..10 loop rewarded:=rewarded+public.wakppu_supporter_reward(u,1);end loop;
 if rewarded<>11 then raise exception 'Fractional Gold lost';end if;
 -- Limited-ball rewards take the same final bonus path.
 update public.game_states set honey_expires_at=null,coating_expires_at=null,rebirths=0 where user_id=u;
 update public.wakppu_items set effects='{}' where user_id=u;
 update public.wakppu_limited_players set selected='halloween-pumpkin-2026',clicks=99 where user_id=u;
 update public.wakppu_halloween_cosmetics set pet_gold_remainder=0 where user_id=u;
 s:=public.wakppu_api('{"action":"items"}');r:=public.wakppu_api(jsonb_build_object('action','limited_hit','request_id',gen_random_uuid(),'item_revision',s->'revision'));
 if (r->>'reward')::numeric<1650000000 then raise exception 'Limited pet reward missing: %',r;end if;
 -- Administrator event balls use the same reward helper too.
 insert into public.wakppu_event_ball_progress(user_id,event_id,clicks) values(u,'admin-always',599) on conflict(user_id,event_id) do update set clicks=599;
 select max(reward)*10 into base from public.wakppu_ball_rewards where ball_id in (select jsonb_array_elements_text(unlocked_ball_ids) from public.game_states where user_id=u);
 s:=public.wakppu_api('{"action":"items"}');r:=public.wakppu_api(jsonb_build_object('action','item_hit','event_id','admin-always','request_id',gen_random_uuid(),'item_revision',s->'revision'));
 if (r->>'reward')::numeric<floor(base*1.1) then raise exception 'Event pet reward missing';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',true)::text,true);
 if public.wakppu_equipped_pet(u) is not null then raise exception 'Anonymous entitlement bypass';end if;
 if has_function_privilege('authenticated','public.wakppu_equipped_pet(uuid)','execute') then raise exception 'Private function exposed';end if;
end $check$;
select 'PASS: live permanent pets, exact timing, stacked ordinary/limited/event rewards, fractional carry, replay and anonymous guard; all test data rolled back' result;
rollback;
