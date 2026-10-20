-- Synthetic user only: no real accounts, event settings or balances are changed.
begin;
do $test$
declare u uuid:=gen_random_uuid();r jsonb;req jsonb;before_state jsonb;id text;expected bigint:=350;
begin
 insert into auth.users(id,aud,role,is_anonymous,created_at,updated_at,raw_user_meta_data)
 values(u,'authenticated','authenticated',true,now(),now(),'{}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',true)::text,true);
 perform public.wakppu_api('{"action":"bootstrap"}');
 r:=public.wakppu_api('{"action":"pumpkin_skins"}');
 if not (r->>'active')::boolean then raise exception 'Event inactive: do not alter production settings to run this check';end if;
 if (r->>'admin_content_access')::boolean or (r->>'can_equip')::boolean then raise exception 'Anonymous player received admin/base access';end if;
 update public.wakppu_limited_players set tokens=350,owned='{"halloween-pumpkin-2026":{"reward":"1500000000"}}' where user_id=u;
 update public.wakppu_skins set owned='{"eternity_hero":true}',equipped='{"eternity":"eternity_hero"}',shards=17,pity=12 where user_id=u;
 select to_jsonb(g)-'item_revision'-'updated_at' into before_state from public.game_states g where user_id=u;
 foreach id in array array['pumpkin_wisp','pumpkin_ghost','pumpkin_eclipse'] loop
  r:=public.wakppu_api('{"action":"pumpkin_skins"}');
  req:=jsonb_build_object('action','pumpkin_skin_exchange','skin_id',id,'request_id',gen_random_uuid(),'item_revision',r->'revision','skin_revision',r->'skin_revision','price',0);
  r:=public.wakppu_api(req);expected:=expected-case id when 'pumpkin_wisp' then 50 when 'pumpkin_ghost' then 100 else 200 end;
  if (r->>'tokens')::bigint<>expected or not(r->'owned'?id) then raise exception 'Wrong live price/ownership';end if;
  if public.wakppu_api(req)<>r then raise exception 'Live retry is not idempotent';end if;
  req:=jsonb_build_object('action','pumpkin_skin_equip','ball_id','halloween-pumpkin-2026','skin_id',id,'request_id',gen_random_uuid(),'item_revision',r->'revision','skin_revision',r->'skin_revision');
  r:=public.wakppu_api(req);if r->>'equipped'<>id then raise exception 'Live equip failed';end if;
 end loop;
 if (select to_jsonb(g)-'item_revision'-'updated_at' from public.game_states g where user_id=u)<>before_state then raise exception 'Unrelated game progress changed';end if;
 if exists(select 1 from public.wakppu_skins where user_id=u and (shards<>17 or pity<>12 or total<>0 or equipped->>'eternity'<>'eternity_hero')) then raise exception 'Eternity data changed';end if;
 if has_table_privilege('authenticated','public.wakppu_pumpkin_skin_defs','select') or has_function_privilege('anon','public.wakppu_api_before_pumpkin_skins(jsonb)','execute') or has_function_privilege('authenticated','public.wakppu_api_before_pumpkin_skins(jsonb)','execute') then raise exception 'Internal access exposed';end if;
end $test$;
select 'PASS: actual API candy exchange, equip, replay, progress preservation and permissions; synthetic writes rolled back' as result;
rollback;
