-- Exercise the real save/reset wrappers without preserving test changes.
begin;
do $check$
declare u uuid;s public.game_states%rowtype;r jsonb;begin
 select p.user_id into u from public.players p join auth.users a on a.id=p.user_id where p.role='admin' and not a.is_anonymous limit 1;
 if u is null then raise exception 'Administrator fixture unavailable';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','is_anonymous',false)::text,true);
 r:=public.wakppu_api('{"action":"auto_rebirth_status"}');
 if r->>'owned'<>'true' then raise exception 'Admin access failed';end if;
 perform public.wakppu_api('{"action":"auto_rebirth_toggle","enabled":true}');
 update public.game_states set gold=2000000,rebirths=0,honey_expires_at=now()+interval '1 hour',coating_expires_at=now()+interval '1 hour',current_clicks=2,item_current_clicks=2 where user_id=u;
 select * into s from public.game_states where user_id=u;
 r:=public.wakppu_api(jsonb_build_object('action','auto_rebirth_run','rebirths',0,'item_revision',s.item_revision));
 if r->>'performed'<>'true' then raise exception 'Auto rebirth failed';end if;
 if exists(select 1 from public.game_states where user_id=u and (gold<>0 or rebirths<>1 or honey_expires_at is not null or coating_expires_at is not null or current_clicks<>0 or item_current_clicks<>0 or item_revision<>s.item_revision+1 or hammer_level<>s.hammer_level or hammer_owned<>s.hammer_owned)) then raise exception 'Real reset contract failed';end if;
 if exists(select 1 from public.wakppu_items where user_id=u and effects<>'{}') then raise exception 'Effects survived';end if;
 r:=public.wakppu_api(jsonb_build_object('action','auto_rebirth_run','rebirths',0,'item_revision',s.item_revision));if r->>'performed'<>'false' then raise exception 'Replay duplicated';end if;
 if(select amount from public.wakppu_purchase_products where id='auto_rebirth')<>4000 then raise exception 'Price mismatch';end if;
 if has_table_privilege('authenticated','public.wakppu_auto_rebirth','SELECT') or has_function_privilege('anon','public.wakppu_api_before_auto_rebirth(jsonb)','EXECUTE') then raise exception 'Private state exposed';end if;
end $check$;
rollback;
select true as real_auto_rebirth_checks_passed,true as test_changes_rolled_back;
