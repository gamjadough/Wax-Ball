begin;
insert into public.wakppu_purchase_products(id,name,amount,description) values
 ('auto_rebirth','자동 환생 영구 이용권',4000,'접속 중 필요 골드 도달 시 자동 환생 · 구매 후 OFF · ON/OFF 가능 · 기존 환생 초기화 규칙 적용') on conflict(id) do nothing;
create table public.wakppu_auto_rebirth(user_id uuid primary key references public.players(user_id) on delete cascade,enabled boolean not null default false);
alter table public.wakppu_auto_rebirth enable row level security;
revoke all on public.wakppu_auto_rebirth from public,anon,authenticated;
create function public.wakppu_rebirth_cost(n integer) returns numeric language plpgsql immutable set search_path=public,pg_temp as $$
declare costs numeric[]:=array[2000000,6000000,16000000,40000000,100000000,240000000,600000000,1600000000,4000000000,10000000000,30000000000,80000000000,200000000000,500000000000,1200000000000,3000000000000,8000000000000,20000000000000,48000000000000,120000000000000,300000000000000,800000000000000,2000000000000000,4800000000000000,12000000000000000];c numeric; i integer;
begin
 if n is null or n<0 or n>=1000 then return null;end if;
 if n<25 then return costs[n+1];end if;c:=costs[25];
 for i in 26..n+1 loop c:=c*case when i<=100 and (i-26)%10=9 then 1 when i<=500 then 2 else 3 end;end loop;
 return c;
end$$;
-- Reacquiring a refunded/revoked entitlement starts OFF as well.
create function public.wakppu_auto_rebirth_reset() returns trigger language plpgsql set search_path=public,pg_temp as $$begin
 if coalesce(new.product_id,old.product_id)='auto_rebirth' then
  if tg_op='DELETE' then update public.wakppu_auto_rebirth set enabled=false where user_id=old.user_id;
  else insert into public.wakppu_auto_rebirth(user_id,enabled) values(new.user_id,false) on conflict(user_id) do update set enabled=false;end if;
 end if;return null;
end$$;
create trigger wakppu_auto_rebirth_reset after insert or delete on public.wakppu_purchase_entitlements for each row execute function public.wakppu_auto_rebirth_reset();
alter function public.wakppu_api(jsonb) rename to wakppu_api_before_auto_rebirth;
revoke all on function public.wakppu_api_before_auto_rebirth(jsonb) from public,anon,authenticated;
create function public.wakppu_api(b jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a text:=b->>'action';u uuid:=auth.uid();s public.game_states%rowtype;r jsonb;owned boolean;enabled_now boolean;cost numeric;done boolean:=false;
begin
 if a not in('auto_rebirth_status','auto_rebirth_toggle','auto_rebirth_run','purchase_catalog') then return public.wakppu_api_before_auto_rebirth(b);end if;
 if u is null then raise sqlstate 'PT401';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,19));
 r:=public.wakppu_api_before_auto_rebirth('{"action":"bootstrap"}');
 owned:=public.wakppu_admin_content_access() or exists(select 1 from public.wakppu_purchase_entitlements where user_id=u and product_id='auto_rebirth');
 select * into s from public.game_states where user_id=u for update;
 select coalesce(enabled,false) into enabled_now from public.wakppu_auto_rebirth where user_id=u;
 enabled_now:=owned and coalesce(enabled_now,false);cost:=public.wakppu_rebirth_cost(s.rebirths);
 if a='auto_rebirth_toggle' then
  if not owned then raise sqlstate 'PT403' using message='자동 환생 이용권이 필요합니다.';end if;
  if jsonb_typeof(b->'enabled') is distinct from 'boolean' then raise sqlstate 'PT400';end if;
  enabled_now:=(b->>'enabled')::boolean;
  insert into public.wakppu_auto_rebirth values(u,enabled_now) on conflict(user_id) do update set enabled=excluded.enabled;
 elsif a='auto_rebirth_run' then
  if not owned then raise sqlstate 'PT403' using message='자동 환생 이용권이 필요합니다.';end if;
  if enabled_now and cost is not null and s.gold>=cost and (b->>'rebirths')::integer=s.rebirths and (b->>'item_revision')::bigint=s.item_revision then
   -- Use the existing reset/save chain, including item-effect cleanup and moderation checks.
   perform public.wakppu_api_before_auto_rebirth(to_jsonb(s)||jsonb_build_object('action','save_progress','gold','0','rebirths',s.rebirths+1,'unlocked_ball_ids',jsonb_build_array('yellow'),'selected_ball_id','yellow','current_ball_id','yellow','current_clicks',0,'honey_expires_at',null,'coating_expires_at',null));
   update public.game_states set item_revision=item_revision+1 where user_id=u;
   update public.wakppu_limited_players set selected=null,clicks=0 where user_id=u;
   done:=true;
  end if;
  return jsonb_build_object('performed',done);
 elsif a='purchase_catalog' then
  r:=public.wakppu_api_before_auto_rebirth(b);
  return r||jsonb_build_object('auto_rebirth',jsonb_build_object('owned',owned,'enabled',enabled_now));
 end if;
 return jsonb_build_object('owned',owned,'enabled',enabled_now,'rebirths',s.rebirths,'cost',cost::text);
end$$;
revoke all on function public.wakppu_rebirth_cost(integer),public.wakppu_auto_rebirth_reset() from public,anon,authenticated;
revoke all on function public.wakppu_api(jsonb) from public;
grant execute on function public.wakppu_api(jsonb) to anon,authenticated;
commit;
