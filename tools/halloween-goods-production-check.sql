-- Synthetic player only. Every test purchase, reward and role change rolls back.
begin;
do $check$
declare u uuid:=gen_random_uuid();r jsonb;req jsonb;expiry bigint;tokens bigint;stock integer;reward numeric;
begin
 insert into auth.users(id,aud,role,is_anonymous,email,email_confirmed_at,created_at,updated_at,raw_user_meta_data)
 values(u,'authenticated','authenticated',false,'halloween-goods-'||u::text||'@example.invalid',now(),now(),now(),'{}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api('{"action":"bootstrap"}');
 r:=public.wakppu_api('{"action":"halloween_goods"}');
 update public.wakppu_limited_players set tokens=1000 where user_id=u;
 req:=jsonb_build_object('action','halloween_goods_buy','id','witch_potion','goods_revision',r->'revision','request_id',gen_random_uuid());
 r:=public.wakppu_api(req);perform public.wakppu_api(req);
 if r->>'tokens'<>'950' or r#>>'{stock,witch_potion}'<>'1' then raise exception 'Purchase/replay failed';end if;
 req:=jsonb_build_object('action','halloween_goods_use','id','witch_potion','goods_revision',r->'revision','request_id',gen_random_uuid());
 r:=public.wakppu_api(req);expiry:=(r#>>'{expires,witch_potion}')::bigint;
 if expiry-(r->>'server_time')::bigint<>1800000 or r#>>'{stock,witch_potion}'<>'0' then raise exception 'Use failed';end if;
 if (public.wakppu_api(req)#>>'{expires,witch_potion}')::bigint<>expiry then raise exception 'Repeated use extended twice';end if;
 reward:=public.wakppu_supporter_reward(u,100);if reward<>150 then raise exception 'Gold potion failed: %',reward;end if;
 r:=public.wakppu_api(jsonb_build_object('action','halloween_goods_buy','id','ghost_potion','goods_revision',r->'revision','request_id',gen_random_uuid()));
 r:=public.wakppu_api(jsonb_build_object('action','halloween_goods_use','id','ghost_potion','goods_revision',r->'revision','request_id',gen_random_uuid()));
 if r#>>'{timing,animation}'<>'2' then raise exception 'Timing potion failed';end if;
 r:=public.wakppu_api(jsonb_build_object('action','halloween_goods_buy','id','halloween_witch','goods_revision',r->'revision','request_id',gen_random_uuid()));
 perform public.wakppu_api('{"action":"profile_equip","card_id":"halloween_witch"}');
 if public.wakppu_api('{"action":"profile_status"}')->>'equipped'<>'halloween_witch' then raise exception 'Card equip failed';end if;
 r:=public.wakppu_api(jsonb_build_object('action','halloween_goods_buy','id','halloween_ghost_title','goods_revision',r->'revision','request_id',gen_random_uuid()));
 if public.wakppu_api('{"action":"profile_title","title_id":"halloween_ghost_title"}')->>'title'<>'유령의 친구' then raise exception 'Title equip failed';end if;
 perform public.wakppu_api('{"action":"profile_equip","card_id":null}');perform public.wakppu_api('{"action":"profile_title","title_id":"none"}');
 
 update public.players set role='admin' where user_id=u;
 r:=public.wakppu_api('{"action":"halloween_goods"}');stock:=coalesce((r#>>'{stock,pumpkin_potion}')::integer,0);
 r:=public.wakppu_api(jsonb_build_object('action','halloween_goods_use','id','pumpkin_potion','goods_revision',r->'revision','request_id',gen_random_uuid()));
 if coalesce((r#>>'{stock,pumpkin_potion}')::integer,0)<>stock or r#>>'{timing,respawn}'<>'2' then raise exception 'Admin stock/access failed';end if;
 update public.players set role='player' where user_id=u;
 r:=public.wakppu_api('{"action":"halloween_goods"}');if r#>>'{timing,respawn}'<>'1' then raise exception 'Revoked admin bonus remains';end if;
 update public.players set role='admin' where user_id=u;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',true)::text,true);
 r:=public.wakppu_api('{"action":"halloween_goods"}');if r->>'admin_access'<>'false' or r#>>'{timing,respawn}'<>'1' then raise exception 'Anonymous admin bypass';end if;
 if has_table_privilege('authenticated','public.wakppu_halloween_goods','UPDATE') or has_function_privilege('authenticated','public.wakppu_halloween_goods_expiry(uuid)','EXECUTE') then raise exception 'Private goods exposed';end if;
end $check$;
rollback;
select true as halloween_goods_verified,true as test_changes_rolled_back;
