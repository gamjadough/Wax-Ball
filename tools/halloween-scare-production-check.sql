-- Synthetic account only; all writes, including auth trigger side effects, roll back.
begin;
do $test$
declare u uuid:=gen_random_uuid();s jsonb;r jsonb;req jsonb;skin text;enabled boolean;
begin
 insert into auth.users(id,aud,role,is_anonymous,created_at,updated_at,raw_user_meta_data) values(u,'authenticated','authenticated',false,now(),now(),'{}');
 -- Synthetic staff can exercise the API during maintenance; global settings stay untouched.
 update public.players set role='admin' where user_id=u;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api('{"action":"bootstrap"}');s:=public.wakppu_api('{"action":"pumpkin_skins"}');
 update public.wakppu_limited_players set tokens=100,owned='{"halloween-pumpkin-2026":{"reward":"1500000000"}}' where user_id=u;
 update public.wakppu_skins set owned='{"pumpkin_wisp":true,"pumpkin_ghost":true,"pumpkin_eclipse":true,"eternity_hero":true}',equipped='{"eternity":"eternity_hero"}' where user_id=u;
 foreach skin in array array['pumpkin_wisp','pumpkin_ghost','pumpkin_eclipse'] loop
  s:=public.wakppu_api('{"action":"pumpkin_skins"}');
  req:=jsonb_build_object('action','pumpkin_skin_equip','ball_id','halloween-pumpkin-2026','skin_id',skin,'request_id',gen_random_uuid(),'item_revision',s->'revision','skin_revision',s->'skin_revision');
  s:=public.wakppu_api(req);if s->>'equipped' is distinct from skin then raise exception 'Live skin equip failed';end if;
  req:=jsonb_build_object('action','pumpkin_skin_equip','ball_id','halloween-pumpkin-2026','skin_id',null,'request_id',gen_random_uuid(),'item_revision',s->'revision','skin_revision',s->'skin_revision');
  s:=public.wakppu_api(req);
  if s->>'equipped' is not null or exists(select 1 from public.wakppu_skins where user_id=u and equipped?'halloween-pumpkin-2026') then raise exception 'Live skin unequip failed';end if;
  if (select equipped->>'eternity' from public.wakppu_skins where user_id=u) is distinct from 'eternity_hero' then raise exception 'Other equipment changed';end if;
 end loop;
 req:=jsonb_build_object('action','pumpkin_scare_disable_buy','request_id',gen_random_uuid(),'item_revision',s->'revision','skin_revision',s->'skin_revision','price',0);
 r:=public.wakppu_api(req);
 if not (r->>'scare_disabled')::boolean or (r->>'tokens')::bigint<>0 then raise exception 'Live optout price/ownership failed';end if;
 if public.wakppu_api(req)<>r then raise exception 'Live optout replay failed';end if;
 foreach enabled in array array[false,true] loop
  req:=jsonb_build_object('action','pumpkin_scare_disable_equip','enabled',enabled,'request_id',gen_random_uuid(),'item_revision',r->'revision','skin_revision',r->'skin_revision');r:=public.wakppu_api(req);
  if (r->>'scare_disabled')::boolean is distinct from enabled or not(r->>'scare_optout_owned')::boolean or (r->>'tokens')::bigint<>0 then raise exception 'Live optout equip/unequip failed';end if;
 end loop;
end $test$;
select 'PASS: all three skins equip/unequip, other equipment preserved, 100 candy permanent optout and retry; synthetic writes rolled back' as result;
rollback;
