-- Synthetic accounts only. All fixture, purchases, gem state and audit writes roll back.
begin;
do $check$
declare u uuid:=gen_random_uuid();a uuid:=gen_random_uuid();r jsonb;g jsonb;hit jsonb;rid uuid;rev bigint;before_gold numeric;before_gems text;
begin
 insert into auth.users(id,aud,role,is_anonymous,email,email_confirmed_at,created_at,updated_at,raw_user_meta_data)
 values(u,'authenticated','authenticated',false,'blue-gem-test-'||u::text||'@example.invalid',now(),now(),now(),'{}'),
       (a,'authenticated','authenticated',false,'blue-gem-test-'||a::text||'@example.invalid',now(),now(),now(),'{}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api('{"action":"bootstrap"}');
 g:=public.wakppu_api('{"action":"blue_gems"}');if g->>'balance'<>'0' or g->>'multiplier'<>'1' then raise exception 'Initial gems invalid';end if;
 r:=public.wakppu_api('{"action":"items"}');
 r:=public.wakppu_api(jsonb_build_object('action','item_hit','request_id',gen_random_uuid(),'item_revision',r->'revision'));
 if r#>>'{blue_gems,balance}'<>'0' then raise exception 'Partial hit granted gem';end if;
 update public.game_states set hammer_owned=true,hammer_level=30 where user_id=u;
 rid:=gen_random_uuid();rev:=(r->>'revision')::bigint;
 hit:=public.wakppu_api(jsonb_build_object('action','item_hit','request_id',rid,'item_revision',rev));
 if hit->>'reward'<>'1' or hit#>>'{blue_gems,balance}'<>'1' then raise exception 'Ordinary break grant invalid';end if;
 perform public.wakppu_api(jsonb_build_object('action','item_hit','request_id',rid,'item_revision',rev));
 if public.wakppu_api('{"action":"blue_gems"}')->>'balance'<>'1' then raise exception 'Duplicate gem grant';end if;
 update public.wakppu_blue_gems set balance=20000 where user_id=u;
 select gold into before_gold from public.game_states where user_id=u;
 g:=public.wakppu_api('{"action":"blue_gems"}');rid:=gen_random_uuid();rev:=(g->>'revision')::bigint;
 r:=public.wakppu_api(jsonb_build_object('action','blue_gem_buy','level',1,'gem_revision',rev,'request_id',rid));
 if r->>'balance'<>'19000' or r->>'multiplier'<>'2' then raise exception 'Purchase invalid';end if;
 perform public.wakppu_api(jsonb_build_object('action','blue_gem_buy','level',1,'gem_revision',rev,'request_id',rid));
 if (select gold from public.game_states where user_id=u)<>before_gold or public.wakppu_api('{"action":"blue_gems"}')->>'balance'<>'19000' then raise exception 'Purchase charged Gold or repeated';end if;
 r:=public.wakppu_api('{"action":"items"}');hit:=public.wakppu_api(jsonb_build_object('action','item_hit','request_id',gen_random_uuid(),'item_revision',r->'revision'));
 if hit->>'reward'<>'2' or hit#>>'{blue_gems,balance}'<>'19001' then raise exception 'Permanent reward invalid';end if;
 g:=public.wakppu_api('{"action":"blue_gems"}');r:=public.wakppu_api(jsonb_build_object('action','blue_gem_buy','level',2,'gem_revision',g->'revision','request_id',gen_random_uuid()));
 if r->>'multiplier'<>'5' then raise exception 'Multipliers stacked incorrectly';end if;
 perform public.wakppu_api('{"action":"limited"}');
 update public.wakppu_limited_players set tokens=100 where user_id=u;
 r:=public.wakppu_api('{"action":"items"}');r:=public.wakppu_api(jsonb_build_object('action','limited_buy','request_id',gen_random_uuid(),'item_revision',r->'revision'));
 r:=public.wakppu_api(jsonb_build_object('action','limited_select','ball_id','halloween-pumpkin-2026','request_id',gen_random_uuid(),'item_revision',r->'revision'));
 g:=public.wakppu_api('{"action":"blue_gems"}');
 r:=public.wakppu_api(jsonb_build_object('action','limited_hit','request_id',gen_random_uuid(),'item_revision',r->'revision'));
 if r->>'reward'<>'7500000000' or (r#>>'{blue_gems,balance}')::numeric<>(g->>'balance')::numeric+1 then raise exception 'Halloween gem/reward invalid';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api('{"action":"bootstrap"}');update public.players set role='admin' where user_id=a;
 r:=public.wakppu_api('{"action":"items"}');r:=public.wakppu_api(jsonb_build_object('action','item_hit','event_id','admin-always','request_id',gen_random_uuid(),'item_revision',r->'revision'));
 -- Admin hammer is not automatic: force a final event hit on the isolated fixture.
 update public.game_states set hammer_owned=true,hammer_level=30 where user_id=a;
 for i in 1..10 loop
  if (r->>'reward')::numeric>0 then exit;end if;
  r:=public.wakppu_api(jsonb_build_object('action','item_hit','event_id','admin-always','request_id',gen_random_uuid(),'item_revision',r->'revision'));
 end loop;
 if (r->>'reward')::numeric<=0 or r#>>'{blue_gems,balance}'<>'1' then raise exception 'Admin event gem invalid';end if;
 g:=public.wakppu_api('{"action":"blue_gems"}');r:=public.wakppu_api(jsonb_build_object('action','blue_gem_buy','level',7,'gem_revision',g->'revision','request_id',gen_random_uuid()));
 if r->>'balance'<>'1' or r->>'multiplier'<>'1000000000' then raise exception 'Admin altered real stock';end if;
 perform public.wakppu_api(jsonb_build_object('action','admin_paid_grant','user_id',u,'product_id','auto_rebirth','request_id',gen_random_uuid(),'reason','푸른젬 환생 롤백 검증'));
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','is_anonymous',true)::text,true);
 if public.wakppu_api('{"action":"blue_gems"}')->>'multiplier'<>'1' then raise exception 'Anonymous admin virtual access';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api('{"action":"auto_rebirth_toggle","enabled":true}');
 update public.game_states set gold=2000000,rebirths=0 where user_id=u;
 g:=public.wakppu_api('{"action":"blue_gems"}');r:=public.wakppu_api('{"action":"items"}');
 r:=public.wakppu_api(jsonb_build_object('action','auto_rebirth_run','rebirths',0,'item_revision',r->'revision'));
 if r->>'performed'<>'true' or r#>>'{blue_gems,balance}'<>g->>'balance' or r#>>'{blue_gems,multiplier}'<>'5' then raise exception 'Rebirth reset gems';end if;
 begin perform public.wakppu_api(jsonb_build_object('action','blue_gem_buy','level',3,'gem_revision',g->'revision','request_id',gen_random_uuid(),'user_id',a));raise exception 'Cross-account write';
 exception when sqlstate 'PT403' then null;end;
 update public.wakppu_blue_gems set balance=1e39 where user_id=u;
 g:=public.wakppu_api('{"action":"blue_gems"}');r:=public.wakppu_api(jsonb_build_object('action','blue_gem_buy','level',7,'gem_revision',g->'revision','request_id',gen_random_uuid()));
 if r->>'balance'<>'0' or r->>'multiplier'<>'1000000000' then raise exception 'Large integer purchase invalid';end if;
 if has_table_privilege('authenticated','public.wakppu_blue_gems','SELECT') or has_function_privilege('anon','public.wakppu_api_before_blue_gems(jsonb)','EXECUTE') or has_function_privilege('authenticated','public.wakppu_supporter_reward(uuid,numeric)','EXECUTE') then raise exception 'Private gem data exposed';end if;
end $check$;
rollback;
select true as blue_gems_verified,true as test_changes_rolled_back;
