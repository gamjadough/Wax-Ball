-- Synthetic player only; all accounts, candy, cosmetics, requests and hit progress roll back.
begin;
do $check$
declare u uuid:=gen_random_uuid();s jsonb;r jsonb;req jsonb;balance text;
begin
 insert into auth.users(id,aud,role,is_anonymous,created_at,updated_at,raw_user_meta_data) values(u,'authenticated','authenticated',false,now(),now(),'{}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api('{"action":"bootstrap"}');s:=public.wakppu_api('{"action":"halloween_cosmetics"}');balance:=s->>'gold';
 if s->>'price'<>'100' or s->>'exchange_cost'<>'3' or jsonb_array_length(s->'catalog')<>3 then raise exception 'Live catalog mismatch';end if;
 update public.wakppu_limited_players set tokens=1000 where user_id=u;
 req:=jsonb_build_object('action','halloween_decor_open','request_id',gen_random_uuid(),'item_revision',s->'revision','decor_revision',s->'decor_revision','price',0);
 r:=public.wakppu_api(req);if r->>'tokens'<>'900' or r->>'gold'<>balance or (select count(*) from jsonb_object_keys(r->'owned'))<>1 then raise exception 'Live price/award mismatch';end if;
 if public.wakppu_api(req)<>r then raise exception 'Live retry changed result/balance';end if;
 -- Fixture ownership isolates post-acquisition behavior, without relying on random luck.
 update public.wakppu_halloween_cosmetics set owned='{"little_ghost":true,"bat_swarm":true}',shards=3 where user_id=u;
 s:=public.wakppu_api('{"action":"halloween_cosmetics"}');
 r:=public.wakppu_api(jsonb_build_object('action','halloween_decor_exchange','item_id','pumpkin_ember','request_id',gen_random_uuid(),'item_revision',s->'revision','decor_revision',s->'decor_revision'));
 if r->>'shards'<>'0' or not(r->'owned'?'pumpkin_ember') then raise exception 'Live choice exchange failed';end if;
 s:=public.wakppu_api(jsonb_build_object('action','halloween_decor_equip','item_id','little_ghost','request_id',gen_random_uuid(),'item_revision',r->'revision','decor_revision',r->'decor_revision'));
 if s->>'equipped'<>'little_ghost' then raise exception 'Live equip failed';end if;
 r:=public.wakppu_api(jsonb_build_object('action','halloween_decor_use','item_id','bat_swarm','request_id',gen_random_uuid(),'item_revision',s->'revision','decor_revision',s->'decor_revision'));
 if r#>>'{result,used}'<>'bat_swarm' or r->>'tokens'<>'900' or r->>'gold'<>balance then raise exception 'Live permanent use failed';end if;
 s:=public.wakppu_api('{"action":"items"}');r:=public.wakppu_api(jsonb_build_object('action','item_hit','request_id',gen_random_uuid(),'item_revision',s->'revision'));
 if (r->>'clicks')::integer<>1 then raise exception 'Existing gameplay changed';end if;
 if has_table_privilege('authenticated','public.wakppu_halloween_cosmetics','select,insert,update,delete') or has_function_privilege('anon','public.wakppu_halloween_cosmetic_snapshot(uuid)','execute') then raise exception 'Private state exposed';end if;
end $check$;
select 'PASS: live 100 candy price, reward/retry, shards, equip/use, unchanged normal hit; synthetic changes rolled back' as result;
rollback;
