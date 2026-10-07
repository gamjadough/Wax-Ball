-- Local review only. Preserve the existing game/API wrappers.
begin;
alter table public.game_states add column if not exists item_revision bigint not null default 0;
alter table public.game_states add column if not exists item_current_clicks bigint not null default 0;
create table if not exists public.wakppu_item_defs(item_id text primary key,rank text not null,seconds integer not null,channel text not null,value integer not null,charges integer not null,unit text not null);
create table if not exists public.wakppu_item_ranks(rank text primary key,position integer not null unique,weight integer not null check(weight>=0));
-- ITEM_CONFIG_BEGIN
insert into public.wakppu_item_defs values ('common_honey_small','common',300,'honey',125,0,'break'),('common_crack_piece','common',0,'add',2,30,'hit'),('common_wax_polish','common',0,'reward',125,1,'break'),('common_mini_hammer','common',0,'add',3,20,'hit'),('common_lucky_wax','common',0,'reward',150,10,'break'),('rare_honey','rare',600,'honey',150,0,'break'),('rare_crack_booster','rare',120,'damage',150,0,'break'),('rare_wax_coating','rare',0,'reward',200,5,'break'),('rare_iron_hammer','rare',0,'add',10,50,'hit'),('rare_lucky_crystal','rare',600,'reward',150,0,'break'),('hero_golden_honey','hero',900,'honey',200,0,'break'),('hero_explosion_crystal','hero',300,'damage',200,0,'break'),('hero_time_wax','hero',180,'difficulty',50,0,'break'),('legendary_destruction_core','legendary',600,'damage',300,0,'break'),('legendary_golden_coating','legendary',0,'reward',400,20,'break'),('transcendent_wax_heart','transcendent',1800,'heart',300,0,'break') on conflict(item_id) do update set rank=excluded.rank,seconds=excluded.seconds,channel=excluded.channel,value=excluded.value,charges=excluded.charges,unit=excluded.unit;
insert into public.wakppu_item_ranks values ('common',0,6000),('rare',1,2500),('hero',2,1000),('legendary',3,450),('transcendent',4,50) on conflict(rank) do update set position=excluded.position,weight=excluded.weight;
-- ITEM_CONFIG_END
create table if not exists public.wakppu_items(user_id uuid primary key references public.players(user_id) on delete cascade,inventory jsonb not null default '{}',effects jsonb not null default '{}',pity integer not null default 0 check(pity between 0 and 99),total bigint not null default 0);
create table if not exists public.wakppu_item_requests(user_id uuid references public.players(user_id) on delete cascade,request_id uuid,action text not null,response jsonb not null,primary key(user_id,request_id));
create table if not exists public.wakppu_item_balls(ball_id text primary key,clicks bigint not null,reward numeric not null);
insert into public.wakppu_item_balls values ('yellow',5,1),('green',8,10),('strawberry',11,30),('apple',14,50),('chocolate',17,100),('donut',20,250),('rainbow',23,400),('water',26,1000),('emerald',29,1500),('diamond',32,2000),('planet',50,10000),('sun',100,500000),('blackhole',180,5000000),('whitehole',300,15000000),('starlight',360,20000000),('hellfire',720,30000000),('heaven-cloud',1440,45000000),('hell-ember',2880,70000000),('heaven-gem',5760,100000000),('hell-core',11520,150000000),('judgment',23040,250000000),('heaven-earth',46080,400000000),('soul',92160,600000000),('eternity',184320,1000000000) on conflict(ball_id) do update set clicks=excluded.clicks,reward=excluded.reward;
alter table public.wakppu_item_ranks enable row level security;
alter table public.wakppu_items enable row level security;
alter table public.wakppu_item_requests enable row level security;
alter table public.wakppu_item_defs enable row level security;
alter table public.wakppu_item_balls enable row level security;
revoke all on public.wakppu_item_ranks,public.wakppu_items,public.wakppu_item_requests,public.wakppu_item_defs,public.wakppu_item_balls from public,anon,authenticated;
do $migration$ begin
 if to_regprocedure('public.wakppu_api_before_items(jsonb)') is null then alter function public.wakppu_api(jsonb) rename to wakppu_api_before_items; end if;
end $migration$;
revoke all on function public.wakppu_api_before_items(jsonb) from public,anon,authenticated;
create or replace function public.wakppu_api(b jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $api$
declare u uuid:=auth.uid(); a text:=b->>'action'; s public.game_states%rowtype; inv public.wakppu_items%rowtype; d public.wakppu_item_defs%rowtype; stat jsonb; result jsonb; cached jsonb; ids text[]; rank_name text; n integer; cost numeric; roll bigint; chosen text; results jsonb:='[]'; instant timestamptz:=clock_timestamp(); ms bigint:=floor(extract(epoch from instant)*1000);
 expires bigint; charges bigint; channel text; multiplier numeric; honey numeric:=1; bonus numeric:=1; damage_mult numeric:=1; addition numeric:=0; difficulty numeric:=1;
 winners jsonb:='{}'; it record; total_hits bigint; hits bigint; damage bigint; base_reward numeric; earned numeric:=0; event jsonb; event_key text:=b->>'event_id'; ball text; previous jsonb; old_rebirth integer;
begin
 if a not in ('items','item_draw','item_use','item_hit','save_progress') then return public.wakppu_api_before_items(b); end if;
 if u is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.'; end if;
 -- Reuse the existing authentication, maintenance and moderation checks.
 previous:=public.wakppu_api_before_items(jsonb_build_object('action','bootstrap'));
 select * into s from public.game_states where user_id=u for update;
 insert into public.wakppu_items(user_id) values(u) on conflict do nothing;
 select * into inv from public.wakppu_items where user_id=u for update;
 if a='save_progress' then
  if coalesce((b->>'item_revision')::bigint,0)<>s.item_revision then raise sqlstate 'PT409' using message='아이템 상태를 다시 불러옵니다.'; end if;
  old_rebirth:=s.rebirths;result:=public.wakppu_api_before_items(b);
  if coalesce((b->>'current_clicks')::bigint,0) not between 0 and 1000000000 then raise exception '잘못된 타격 진행도'; end if;
  update public.game_states set item_current_clicks=coalesce((b->>'current_clicks')::bigint,0) where user_id=u;
  if (b->>'rebirths')::integer>old_rebirth then update public.wakppu_items set effects='{}' where user_id=u; end if;
  return result;
 end if;
 if a<>'items' then
  if coalesce(b->>'request_id','') !~ '^[a-f0-9-]{36}$' then raise exception '잘못된 요청 ID'; end if;
  select response,action into cached,chosen from public.wakppu_item_requests where user_id=u and request_id=(b->>'request_id')::uuid;
  if found then if chosen<>a then raise exception '요청 ID 충돌'; end if;return cached;end if;
  if (b->>'item_revision') is null or (b->>'item_revision')::bigint<>s.item_revision then raise sqlstate 'PT409' using message='아이템 상태를 다시 불러옵니다.'; end if;
 end if;
 if a='item_draw' then
  n:=(b->>'count')::integer;cost:=case n when 1 then 5000000000000000000 when 3 then 14000000000000000000 when 5 then 22000000000000000000 end;
  if cost is null then raise exception '뽑기 횟수 오류'; end if;
  if s.gold<cost then raise exception 'Gold가 부족합니다.';end if;
  for i in 1..n loop
   if inv.pity=99 then rank_name:='transcendent';
   else
    roll:=floor(('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint::numeric/4294967296*10000);
    if (select sum(weight) from public.wakppu_item_ranks)<>10000 then raise exception '확률 설정 오류';end if;
    select r.rank into rank_name from (select rank,sum(weight) over(order by position) as edge from public.wakppu_item_ranks) r where roll<r.edge order by r.edge limit 1;
   end if;
   select array_agg(item_id order by item_id) into ids from public.wakppu_item_defs where rank=rank_name;
   roll:=floor(('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint::numeric/4294967296*array_length(ids,1));chosen:=ids[roll+1];
   inv.inventory:=jsonb_set(inv.inventory,array[chosen],to_jsonb(coalesce((inv.inventory->>chosen)::bigint,0)+1));
   inv.pity:=case when rank_name='transcendent' then 0 else inv.pity+1 end;inv.total:=inv.total+1;results:=results||jsonb_build_array(chosen);
  end loop;
  s.gold:=s.gold-cost;
 elsif a='item_use' then
  select * into d from public.wakppu_item_defs where item_id=b->>'item_id';
  if not found or coalesce((inv.inventory->>d.item_id)::bigint,0)<=0 then raise exception '보유한 아이템이 없습니다.'; end if;
  if d.seconds>0 then
   expires:=greatest(ms,coalesce((inv.effects->d.item_id->>'expires_at')::bigint,0))+d.seconds::bigint*1000;
   if expires>ms+604800000 then raise exception '최대 연장 시간은 7일입니다.'; end if;
   inv.effects:=jsonb_set(inv.effects,array[d.item_id],jsonb_build_object('expires_at',expires));
  else
   inv.effects:=jsonb_set(inv.effects,array[d.item_id],jsonb_build_object('remaining',coalesce((inv.effects->d.item_id->>'remaining')::bigint,0)+d.charges));
  end if;
  inv.inventory:=jsonb_set(inv.inventory,array[d.item_id],to_jsonb((inv.inventory->>d.item_id)::bigint-1));
 elsif a='item_hit' then
  honey:=case when s.honey_expires_at>instant then 2 else 1 end;bonus:=case when s.coating_expires_at>instant then 3 else 1 end;
  for it in select def.*,e.value as effect from jsonb_each(inv.effects) e join public.wakppu_item_defs def on def.item_id=e.key order by def.item_id loop
   if not (case when it.seconds>0 then coalesce((it.effect->>'expires_at')::bigint,0)>ms else coalesce((it.effect->>'remaining')::bigint,0)>0 end) then continue; end if;
   if it.channel='honey' and it.value/100.0>honey then honey:=it.value/100.0;winners:=jsonb_set(winners,array['honey'],to_jsonb(it.item_id)); end if;
   if it.channel in ('reward','heart') and it.value/100.0>bonus then bonus:=it.value/100.0;winners:=jsonb_set(winners,array['reward'],to_jsonb(it.item_id)); end if;
   multiplier:=case when it.channel='heart' then 2 else it.value/100.0 end;
   if it.channel in ('damage','heart') and multiplier>damage_mult then damage_mult:=multiplier;winners:=jsonb_set(winners,array['damage'],to_jsonb(it.item_id)); end if;
   if it.channel='add' and it.value>addition then addition:=it.value;winners:=jsonb_set(winners,array['add'],to_jsonb(it.item_id)); end if;
   if it.channel='difficulty' and multiplier<difficulty then difficulty:=multiplier;winners:=jsonb_set(winners,array['difficulty'],to_jsonb(it.item_id)); end if;
  end loop;
  ball:=s.selected_ball_id;hits:=s.item_current_clicks;
  if event_key is not null then
   stat:=public.wakppu_api_before_items(jsonb_build_object('action','status'));event:=stat->'admin_ball_event';
   if not (event_key='admin-always' and coalesce((stat->>'admin_ball_always')::boolean,false)) and
    (event is null or event='null'::jsonb or event->>'id'<>event_key or instant<(event->>'starts_at')::timestamptz or instant>=(event->>'ends_at')::timestamptz) then raise sqlstate 'PT409' using message='이벤트가 종료되었습니다.';end if;
   select coalesce(max(r.reward),1)*10 into base_reward from public.wakppu_ball_rewards r where s.unlocked_ball_ids ? r.ball_id;
   total_hits:=600;
   insert into public.wakppu_event_ball_progress(user_id,event_id) values(u,event_key) on conflict do nothing;
   select p.clicks into hits from public.wakppu_event_ball_progress p where p.user_id=u and p.event_id=event_key for update;
  else
   select clicks,reward into total_hits,base_reward from public.wakppu_item_balls where ball_id=ball;
   if total_hits is null or not s.unlocked_ball_ids ? ball then raise exception '왁뿌볼 오류';end if;
  end if;
  total_hits:=greatest(1,ceil(total_hits*(case when s.coating_expires_at>instant then 2 else 1 end)*difficulty));
  damage:=greatest(1,floor((public.wakppu_hammer_damage(s.hammer_owned,s.hammer_level)+addition)*damage_mult));
  hits:=least(total_hits,hits+damage);
  if hits=total_hits then
   stat:=public.wakppu_api_before_items(jsonb_build_object('action','status'));event:=stat->'gold_event';multiplier:=1;
   if event is not null and event<>'null'::jsonb and instant>=(event->>'starts_at')::timestamptz and instant<(event->>'ends_at')::timestamptz then multiplier:=(event->>'multiplier')::numeric;end if;
   earned:=floor(base_reward*power(2::numeric,s.rebirths)*honey*bonus*multiplier);s.gold:=s.gold+earned;
  end if;
  for it in select distinct value #>> '{}' as id from jsonb_each(winners) loop
   select * into d from public.wakppu_item_defs where item_id=it.id;
   if d.seconds=0 and (d.unit='hit' or hits=total_hits) then inv.effects:=jsonb_set(inv.effects,array[d.item_id,'remaining'],to_jsonb(greatest(0,(inv.effects->d.item_id->>'remaining')::bigint-1)));end if;
  end loop;
  if event_key is not null then update public.wakppu_event_ball_progress p set clicks=case when hits=total_hits then 0 else hits end where p.user_id=u and p.event_id=event_key;
  else s.item_current_clicks:=case when hits=total_hits then 0 else hits end;end if;
 end if;
 if a<>'items' then
  s.item_revision:=s.item_revision+1;
  update public.game_states set gold=s.gold,item_revision=s.item_revision,item_current_clicks=s.item_current_clicks where user_id=u;
  update public.wakppu_items set inventory=inv.inventory,effects=inv.effects,pity=inv.pity,total=inv.total where user_id=u;
 end if;
 result:=jsonb_build_object('inventory',inv.inventory,'effects',inv.effects,'pity',inv.pity,'total',inv.total,'revision',s.item_revision,'gold',s.gold::text,'results',results);
 if a='item_hit' then result:=result||jsonb_build_object('clicks',hits,'required_clicks',total_hits,'reward',earned::text);end if;
 if a<>'items' then insert into public.wakppu_item_requests values(u,(b->>'request_id')::uuid,a,result);end if;
 return result;
end $api$;
revoke all on function public.wakppu_api(jsonb) from public,anon;
grant execute on function public.wakppu_api(jsonb) to authenticated;
commit;
