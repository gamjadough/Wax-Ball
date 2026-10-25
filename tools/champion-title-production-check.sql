-- New synthetic accounts only; all fixture changes and souvenir grants roll back.
begin;
do $check$
declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();a uuid:=gen_random_uuid();r jsonb;n text;g numeric;card text;
begin
 insert into auth.users(id,aud,role,is_anonymous,email,email_confirmed_at,created_at,updated_at,raw_user_meta_data)
 values(u,'authenticated','authenticated',false,'champ-title-test-'||u::text||'@example.invalid',now(),now(),now(),'{}'),
       (v,'authenticated','authenticated',false,'champ-title-test-'||v::text||'@example.invalid',now(),now(),now(),'{}'),
       (a,'authenticated','authenticated',false,'champ-title-test-'||a::text||'@example.invalid',now(),now(),now(),'{}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);perform public.wakppu_api('{"action":"bootstrap"}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v,'role','authenticated','is_anonymous',false)::text,true);perform public.wakppu_api('{"action":"bootstrap"}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','is_anonymous',false)::text,true);perform public.wakppu_api('{"action":"bootstrap"}');
 update public.players set role='admin' where user_id=a;
 update public.game_states set rebirths=1000,gold=case when user_id=u then 1e4000 else 1e3999 end where user_id in (u,v);
 if public.wakppu_current_champion() is distinct from u then raise exception 'Ranking fixture not first';end if;
 begin perform public.wakppu_api('{"action":"profile_title","title_id":"champion"}');raise exception 'Admin bypass permitted';
 exception when sqlstate 'PT403' then null;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 select gold into g from public.game_states where user_id=u;select nickname into n from public.players where user_id=u;
 r:=public.wakppu_api('{"action":"profile_status"}');card:=r->>'equipped';
 r:=public.wakppu_api('{"action":"profile_title","title_id":"champion"}');
 if r->>'title'<>'👑 왁뿌볼의 정점' or r->>'equipped' is distinct from card or (select gold from public.game_states where user_id=u)<>g then raise exception 'Title changed card/progress';end if;
 perform public.wakppu_api('{"action":"profile_title","title_id":"none"}');
 if public.wakppu_api('{"action":"profile_status"}')->'title'<>'null' then raise exception 'Unequip failed';end if;
 perform public.wakppu_api('{"action":"profile_title","title_id":"champion"}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',v,'role','authenticated','is_anonymous',false)::text,true);
 r:=public.wakppu_api(jsonb_build_object('action','player_profile','nickname',n));
 if r->>'title'<>'👑 왁뿌볼의 정점' then raise exception 'Public profile missing champion';end if;
 r:=public.wakppu_api('{"action":"rankings"}');
 if (r->0->>'nickname') is distinct from n or (r->0->>'profile_title') is distinct from '👑 왁뿌볼의 정점' then raise exception 'Public ranking mismatch';end if;
 update public.game_states set gold=1e4001 where user_id=v;
 perform public.wakppu_api('{"action":"profile_title","title_id":"champion"}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 r:=public.wakppu_api('{"action":"profile_status"}');
 if r->'title'<>'null' or exists(select 1 from jsonb_array_elements(r->'title_catalog') t where t->>'id'='champion') then raise exception 'Lost first place retained access';end if;
 begin perform public.wakppu_api('{"action":"profile_title","title_id":"champion","rank":1}');raise exception 'Spoofed rank permitted';
 exception when sqlstate 'PT403' then null;end;
 update public.players set ranking_hidden=true where user_id=v;
 if public.wakppu_current_champion() is distinct from u then raise exception 'Hidden player eligible';end if;
 update public.players set ranking_hidden=false where user_id=v;
 insert into public.moderation_cases(user_id,status) values(v,'banned') on conflict(user_id) do update set status='banned';
 if public.wakppu_current_champion() is distinct from u then raise exception 'Banned player eligible';end if;
 if has_function_privilege('authenticated','public.wakppu_current_champion()','EXECUTE') or has_function_privilege('anon','public.wakppu_profile_title_state(uuid)','EXECUTE') then raise exception 'Private title lookup exposed';end if;
end $check$;
rollback;
select true as champion_title_verified,true as test_changes_rolled_back;
