-- Synthetic users/evidence only. Never changes an existing player's moderation.
begin;
do $test$
declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();sid uuid:=gen_random_uuid();step int;i int;points jsonb;req jsonb;r jsonb;again jsonb;before_gold numeric;
begin
 insert into auth.users(id,aud,role,is_anonymous,created_at,updated_at,raw_user_meta_data)
 values(u,'authenticated','authenticated',true,now(),now(),'{}'),(v,'authenticated','authenticated',true,now(),now(),'{}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',true)::text,true);
 perform public.wakppu_api('{"action":"bootstrap"}');
 insert into public.wakppu_input_guard(user_id) values(u) on conflict do nothing;
 for step in 0..2 loop
  update public.wakppu_input_guard set tokens=80,token_at=clock_timestamp()-interval '1 second',first_seen=clock_timestamp()-interval '1 minute',last_report=clock_timestamp()-interval '15 seconds' where user_id=u;
  for i in 1..8 loop
   perform public.wakppu_api(jsonb_build_object('action','item_hit','request_id',gen_random_uuid(),'item_revision',(select item_revision from public.game_states where user_id=u)));
  end loop;
  select jsonb_agg(jsonb_build_array(step*40000+j*60+(array[0,13,-7,9,-11,5,-6])[j%7+1],(array[250,400,600,750,650,450,300])[j%7+1],(array[350,200,250,500,700,750,600])[j%7+1]) order by j) into points from generate_series(0,250) j;
  if (public.wakppu_input_metrics(points)->>'loop_period')::int<>7 then raise exception 'Live cycle metrics mismatch';end if;
  req:=jsonb_build_object('action','input_report','request_id',gen_random_uuid(),'session_id',sid,'samples',points);r:=public.wakppu_api(req);
  if (r->'input_guard'->>'score')::int<>least(100,(step+1)*35) or r->'input_guard'->>'speed_limited_until' is null then raise exception 'Live escalation mismatch';end if;
  again:=public.wakppu_api(req);if again<>r then raise exception 'Replayed report changed evidence';end if;
  if step<2 and r->'input_guard'->>'restricted_until' is not null then raise exception 'Premature suspension';end if;
 end loop;
 if r->'input_guard'->>'restricted_until' is null then raise exception 'No repeated-cycle suspension';end if;
 if exists(select 1 from public.wakppu_input_events where user_id=u and metrics?'samples') then raise exception 'Raw coordinates persisted';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v,'role','authenticated','is_anonymous',true)::text,true);
 perform public.wakppu_api('{"action":"bootstrap"}');
 -- Client-only cycle evidence must not punish an account with no actual hits.
 r:=public.wakppu_api(jsonb_build_object('action','input_report','request_id',gen_random_uuid(),'session_id',gen_random_uuid(),'samples',points));
 if (r->'input_guard'->>'score')::int<>0 or r->'input_guard'->>'speed_limited_until' is not null then raise exception 'Uncorroborated report restricted a user';end if;
 update public.wakppu_input_guard set tokens=80,token_at=clock_timestamp()-interval '1 second',first_seen=clock_timestamp()-interval '1 minute',last_report=clock_timestamp()-interval '15 seconds' where user_id=v;
 for i in 1..8 loop perform public.wakppu_api(jsonb_build_object('action','item_hit','request_id',gen_random_uuid(),'item_revision',(select item_revision from public.game_states where user_id=v)));end loop;
 select jsonb_agg(jsonb_build_array(200000+j*32+(j*37)%17,(j*173)%1001,(j*311)%1001) order by j) into points from generate_series(0,450) j;
 r:=public.wakppu_api(jsonb_build_object('action','input_report','request_id',gen_random_uuid(),'session_id',gen_random_uuid(),'samples',points));
 if (r->'input_guard'->>'score')::int<>0 or r->'input_guard'->>'restricted_until' is not null or r->'input_guard'->>'speed_limited_until' is null then raise exception 'Irregular overspeed should cap, not suspend';end if;
 update public.wakppu_input_guard set tokens=0,token_at=clock_timestamp()+interval '1 day' where user_id=v;
 select gold into before_gold from public.game_states where user_id=v;
 begin
  perform public.wakppu_api(jsonb_build_object('action','item_hit','request_id',gen_random_uuid(),'item_revision',(select item_revision from public.game_states where user_id=v)));
  raise exception 'Expected speed cap';exception when sqlstate 'PT429' then null;
 end;
 if (select gold from public.game_states where user_id=v)<>before_gold then raise exception 'Rejected hit granted Gold';end if;
 if has_function_privilege('anon','public.wakppu_input_metrics(jsonb)','execute') or has_function_privilege('authenticated','public.wakppu_input_metrics(jsonb)','execute') or has_table_privilege('authenticated','public.wakppu_input_guard','update') then raise exception 'Guard internals exposed';end if;
end $test$;
select 'PASS: live multi-position cycles, replay, staged cap/suspension, no client-only punishment, overspeed-only no suspension and reward safety; synthetic writes rolled back' as result;
rollback;
