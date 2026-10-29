-- Production smoke: synthetic account only; all progress/cosmetics/settings rolled back.
begin;
do $check$
declare u uuid:=gen_random_uuid();r jsonb;request jsonb;first_r jsonb;count_before bigint;m date:=date_trunc('month',clock_timestamp() at time zone 'Asia/Seoul')::date;
begin
 insert into auth.users(id,aud,role,is_anonymous,email,email_confirmed_at,created_at,updated_at,raw_user_meta_data)
 values(u,'authenticated','authenticated',false,'monthly-check-'||u::text||'@example.invalid',now(),now(),now(),'{}');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 perform public.wakppu_api('{"action":"bootstrap"}');
 update public.game_states set gold=0,rebirths=0,hammer_owned=true,hammer_level=30,hammer_selected_level=30,honey_expires_at=null,coating_expires_at=null,current_ball_id='yellow',selected_ball_id='yellow',current_clicks=0,item_current_clicks=0 where user_id=u;
 r:=public.wakppu_api('{"action":"items"}');
 request:=jsonb_build_object('action','item_hit','request_id',gen_random_uuid(),'item_revision',r->'revision','hit_source','ember_auto','clicks',999999999);
 first_r:=public.wakppu_api(request);
 if first_r->>'reward'<>'1' then raise exception 'Manual real hit failed';end if;
 if public.wakppu_api(request)<>first_r then raise exception 'Manual replay mismatch';end if;
 if (select clicks from public.wakppu_monthly_clicks where user_id=u and month=m)<>1 then raise exception 'Manual replay or forged count/source changed score';end if;
 r:=public.wakppu_api('{"action":"halloween_cosmetics"}');
 update public.wakppu_halloween_cosmetics set owned=owned||'{"pumpkin_ember":true}'::jsonb where user_id=u;
 r:=public.wakppu_api('{"action":"halloween_cosmetics"}');
 perform public.wakppu_api(jsonb_build_object('action','halloween_decor_equip','item_id','pumpkin_ember','request_id',gen_random_uuid(),'item_revision',r->'revision','decor_revision',r->'decor_revision'));
 r:=public.wakppu_api('{"action":"items"}');
 request:=jsonb_build_object('action','ember_auto_hit','hit_action','item_hit','request_id',gen_random_uuid(),'item_revision',r->'revision');
 first_r:=public.wakppu_api(request);perform public.wakppu_api(request);
 if (select clicks from public.wakppu_monthly_clicks where user_id=u and month=m)<>1 then raise exception 'Ember counted as manual score';end if;
 -- Latest gem-ball release shares item_hit transport, including manual vs ember provenance.
 insert into public.wakppu_blue_gems(user_id,balance) values(u,(select price from public.wakppu_gem_ball_defs where ball_id='blue-crystal-wax')) on conflict(user_id) do update set balance=excluded.balance;
 r:=public.wakppu_api('{"action":"items"}');
 perform public.wakppu_api(jsonb_build_object('action','gem_ball_buy','ball_id','blue-crystal-wax','request_id',gen_random_uuid(),'item_revision',r->'revision'));
 r:=public.wakppu_api('{"action":"items"}');
 perform public.wakppu_api(jsonb_build_object('action','gem_ball_select','ball_id','blue-crystal-wax','request_id',gen_random_uuid(),'item_revision',r->'revision'));
 r:=public.wakppu_api('{"action":"items"}');request:=jsonb_build_object('action','item_hit','request_id',gen_random_uuid(),'item_revision',r->'revision');
 first_r:=public.wakppu_api(request);perform public.wakppu_api(request);
 if first_r->>'gem_reward'<>'5' or (select clicks from public.wakppu_monthly_clicks where user_id=u and month=m)<>2 then raise exception 'Gem manual or replay count mismatch';end if;
 update public.wakppu_halloween_cosmetics set ember_last_hit_at=clock_timestamp()-interval '2 seconds' where user_id=u;
 r:=public.wakppu_api('{"action":"items"}');perform public.wakppu_api(jsonb_build_object('action','ember_auto_hit','hit_action','item_hit','request_id',gen_random_uuid(),'item_revision',r->'revision'));
 if (select clicks from public.wakppu_monthly_clicks where user_id=u and month=m)<>2 then raise exception 'Gem automatic attack counted';end if;
 r:=public.wakppu_api('{"action":"monthly_rankings"}');if r#>>'{me,clicks}'<>'2' or r->>'month'<>to_char(m,'YYYY-MM') then raise exception 'Monthly snapshot mismatch';end if;
 begin perform public.wakppu_api('{"action":"monthly_badge_equip","badge_id":"monthly_202611_participant"}');raise exception 'Unowned badge equipped';exception when sqlstate 'PT403' then null;end;
 begin perform public.wakppu_api('{"action":"profile_title","title_id":"monthly_202611_champion"}');raise exception 'Unowned monthly title equipped';exception when sqlstate 'PT403' then null;end;
 update public.server_settings set maintenance=true;
 r:=public.wakppu_api('{"action":"monthly_rankings"}');if r#>>'{me,clicks}'<>'2' then raise exception 'Maintenance blocks read';end if;
 if not exists(select 1 from cron.job where jobname='wakppu-monthly-settle' and active and schedule='* * * * *' and command='select public.wakppu_monthly_settle()') then raise exception 'Settlement job missing';end if;
 if has_table_privilege('authenticated','public.wakppu_monthly_clicks','UPDATE') or has_table_privilege('anon','public.wakppu_monthly_rewards','SELECT') or has_function_privilege('authenticated','public.wakppu_monthly_settle()','EXECUTE') or has_function_privilege('anon','public.wakppu_api_before_monthly(jsonb)','EXECUTE') then raise exception 'Monthly state or internal helper exposed';end if;
end $check$;
rollback;
select true as monthly_production_verified,true as test_changes_rolled_back;
