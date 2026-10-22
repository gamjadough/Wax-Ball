-- Run in a transaction and roll back: no real purchase, image or account changes remain.
begin;
do $check$
declare u uuid;s jsonb;r jsonb;rid uuid:=gen_random_uuid();gold_before numeric;begin
 select p.user_id into u from public.players p join auth.users a on a.id=p.user_id where p.role='admin' and not a.is_anonymous limit 1;
 if u is null then raise exception 'Administrator check fixture unavailable';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 s:=public.wakppu_api('{"action":"custom_status"}');if s->>'plan'<>'all' then raise exception 'Administrator auto access failed';end if;
 if not(s->'presets'?'skin:transcendent') or not(s->'presets'?'pumpkin:eclipse') then raise exception 'Preset catalog incomplete';end if;
 select gold into gold_before from public.game_states where user_id=u;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 r:=public.wakppu_custom_commit(u,jsonb_build_object('mode','save','target','yellow','effect','whitehole','sound','admin-event','revision',(s->>'revision')::bigint,'request_id',rid,'new_image',true,'path',u::text||'/'||rid::text||'.png','sha256',repeat('a',64),'bytes',1000));
 if r#>>'{profiles,yellow,asset_id}' is distinct from rid::text then raise exception 'Commit failed';end if;
 if(select gold from public.game_states where user_id=u)<>gold_before then raise exception 'Cosmetic changed Gold';end if;
 if has_function_privilege('authenticated','public.wakppu_custom_commit(uuid,jsonb)','EXECUTE') or has_function_privilege('anon','public.wakppu_custom_gc_batch(text[])','EXECUTE') then raise exception 'Private function exposed';end if;
 if has_table_privilege('authenticated','public.wakppu_custom_assets','SELECT') then raise exception 'Asset table exposed';end if;
 if(select public from storage.buckets where id='wakppu-custom') is distinct from false then raise exception 'Storage must be private';end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='wakppu_custom_service_only' and permissive='RESTRICTIVE') then raise exception 'Storage policy missing';end if;
 if(select amount from public.wakppu_purchase_products where id='custom_ball_single')<>30000 or(select amount from public.wakppu_purchase_products where id='custom_ball_all')<>50000 then raise exception 'Product price mismatch';end if;
end $check$;
rollback;
select true as custom_production_checks_passed,true as test_changes_rolled_back;
