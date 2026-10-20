-- Synthetic account only; all account/progress/reward writes roll back.
begin;
do $test$
declare u uuid:=gen_random_uuid();request jsonb;r jsonb;again jsonb;gold_after numeric;tokens_before bigint:=7;
begin
 insert into auth.users(id,aud,role,is_anonymous,created_at,updated_at,raw_user_meta_data)
 values(u,'authenticated','authenticated',true,now(),now(),'{}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',true)::text,true);
 perform public.wakppu_api('{"action":"bootstrap"}');
 perform public.wakppu_api('{"action":"limited"}');
 update public.wakppu_limited_players set tokens=tokens_before,owned='{"halloween-pumpkin-2026":{"reward":"1500000000"}}',selected='halloween-pumpkin-2026',clicks=99 where user_id=u;
 request:=jsonb_build_object('action','limited_hit','request_id',gen_random_uuid(),'item_revision',(select item_revision from public.game_states where user_id=u));
 r:=public.wakppu_api(request);
 if (r->>'reward')::numeric<=0 or (r->'limited'->>'tokens')::bigint<>tokens_before+(case when (r->>'candy_drop')::boolean then 1 else 0 end) then raise exception 'Live pumpkin reward/drop mismatch';end if;
 if (r->'limited'->'season'->>'pumpkinDropChance')::numeric<>0.3 or (r->'limited'->'season'->>'dropChance')::numeric<>0.1 then raise exception 'Live rate metadata mismatch';end if;
 select gold into gold_after from public.game_states where user_id=u;
 again:=public.wakppu_api(request);
 if again<>r or (select gold from public.game_states where user_id=u)<>gold_after or (select tokens from public.wakppu_limited_players where user_id=u)<>(r->'limited'->>'tokens')::bigint then raise exception 'Live replay changed rewards';end if;
 request:=jsonb_build_object('action','limited_hit','request_id',gen_random_uuid(),'item_revision',(select item_revision from public.game_states where user_id=u));
 r:=public.wakppu_api(request);
 if (r->>'reward')::numeric<>0 or (r->>'candy_drop')::boolean then raise exception 'Nonfinal live hit awarded candy';end if;
 if has_function_privilege('anon','public.wakppu_pumpkin_candy_roll()','execute') or has_function_privilege('authenticated','public.wakppu_pumpkin_candy_roll()','execute') then raise exception 'Internal RNG is exposed';end if;
end $test$;
select 'PASS: live drop/reward, replay, nonfinal hit and private RNG; synthetic changes rolled back' as result;
rollback;
