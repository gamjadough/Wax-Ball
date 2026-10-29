begin;
create table public.wakppu_gem_ball_defs(
 ball_id text primary key,name text not null,price numeric not null check(price>=0 and price=trunc(price)),
 clicks bigint not null check(clicks>0),gem_reward numeric not null check(gem_reward>0 and gem_reward=trunc(gem_reward)));
insert into public.wakppu_gem_ball_defs values('blue-crystal-wax','푸른 수정 왁뿌볼',5000,100,5);
create table public.wakppu_gem_ball_players(
 user_id uuid primary key references public.players(user_id) on delete cascade,
 owned jsonb not null default '[]',selected text references public.wakppu_gem_ball_defs(ball_id),clicks bigint not null default 0 check(clicks>=0));
create table public.wakppu_gem_ball_requests(
 user_id uuid references public.players(user_id) on delete cascade,request_id uuid,fingerprint jsonb not null,response jsonb not null,primary key(user_id,request_id));
alter table public.wakppu_gem_ball_defs enable row level security;
alter table public.wakppu_gem_ball_players enable row level security;
alter table public.wakppu_gem_ball_requests enable row level security;
revoke all on public.wakppu_gem_ball_defs,public.wakppu_gem_ball_players,public.wakppu_gem_ball_requests from public,anon,authenticated;
insert into public.wakppu_blue_gem_exclusions select ball_id from public.wakppu_gem_ball_defs on conflict do nothing;
create function public.wakppu_gem_ball_snapshot(u uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $s$
declare p public.wakppu_gem_ball_players%rowtype;access boolean;
begin
 if u is null or u is distinct from auth.uid() then raise sqlstate 'PT403';end if;
 access:=public.wakppu_admin_content_access();select * into p from public.wakppu_gem_ball_players where user_id=u;
 return jsonb_build_object('owned',coalesce(p.owned,'[]'),'selected',case when access or p.owned ? p.selected then p.selected end,
  'clicks',coalesce(p.clicks,0),'admin_access',access,
  'catalog',(select jsonb_agg(jsonb_build_object('id',ball_id,'name',name,'price',price::text,'clicks',clicks,'gem_reward',gem_reward::text) order by ball_id) from public.wakppu_gem_ball_defs));
end $s$;
revoke all on function public.wakppu_gem_ball_snapshot(uuid) from public,anon,authenticated;
-- Existing item_hit, input-guard and ember-auto wrappers continue to authorize transport.
create function public.wakppu_gem_ball_hit(b jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $hit$
declare u uuid:=auth.uid();s public.game_states%rowtype;p public.wakppu_gem_ball_players%rowtype;d public.wakppu_gem_ball_defs%rowtype;
 inv public.wakppu_items%rowtype;r jsonb;cached jsonb;kind text;rid uuid;hits bigint;winners jsonb;it record;ms bigint:=floor(extract(epoch from clock_timestamp())*1000);
begin
 if u is null then raise sqlstate 'PT401';end if;
 perform public.wakppu_api_before_gem_balls('{"action":"bootstrap"}');
 if b ?| array['user_id','target_user_id','gem_reward','gold','damage'] or coalesce(b->>'request_id','') !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then raise sqlstate 'PT400';end if;
 rid:=(b->>'request_id')::uuid;
 select * into s from public.game_states where user_id=u for update;
 select response,action into cached,kind from public.wakppu_item_requests where user_id=u and request_id=rid;
 if found then if kind<>'item_hit' then raise sqlstate 'PT409';end if;return cached;end if;
 if (b->>'item_revision')::bigint is distinct from s.item_revision then raise sqlstate 'PT409';end if;
 select * into p from public.wakppu_gem_ball_players where user_id=u for update;
 select * into d from public.wakppu_gem_ball_defs where ball_id=p.selected;
 if not found or not (coalesce(p.owned ? p.selected,false) or public.wakppu_admin_content_access()) then raise sqlstate 'PT403' using message='보유한 푸른젬 볼을 선택해주세요.';end if;
 insert into public.wakppu_items(user_id) values(u) on conflict do nothing;
 select * into inv from public.wakppu_items where user_id=u for update;
 hits:=least(d.clicks,p.clicks+public.wakppu_hammer_damage(s.hammer_owned,least(s.hammer_level,coalesce(s.hammer_selected_level,s.hammer_level))));
 winners:=public.wakppu_item_winners(inv.effects,ms);
 -- Consume only effects that actually influence this zero-Gold ball.
 for it in select distinct value->>'id' as id from jsonb_each(winners) where key in ('animation','respawn','damage','add','difficulty') loop
  if exists(select 1 from public.wakppu_item_defs where item_id=it.id and seconds=0 and (unit='hit' or hits=d.clicks)) then
   inv.effects:=jsonb_set(inv.effects,array[it.id,'remaining'],to_jsonb(greatest(0,coalesce((inv.effects->it.id->>'remaining')::bigint,0)-1)));
  end if;
 end loop;
 if hits=d.clicks then
  insert into public.wakppu_blue_gems(user_id) values(u) on conflict do nothing;
  update public.wakppu_blue_gems set balance=balance+d.gem_reward,revision=revision+1 where user_id=u;
 end if;
 update public.wakppu_gem_ball_players set clicks=case when hits=d.clicks then 0 else hits end where user_id=u;
 update public.wakppu_items set effects=inv.effects where user_id=u;
 update public.game_states set item_revision=item_revision+1 where user_id=u;
 r:=public.wakppu_api_before_gem_balls('{"action":"items"}')||jsonb_build_object('reward','0','broken',hits=d.clicks,'clicks',hits,'required_clicks',d.clicks,
  'gem_reward',case when hits=d.clicks then d.gem_reward::text else '0' end,'gem_balls',public.wakppu_gem_ball_snapshot(u),'blue_gems',public.wakppu_blue_gem_snapshot(u));
 insert into public.wakppu_item_requests(user_id,request_id,action,response) values(u,rid,'item_hit',r);
 return r;
end $hit$;
revoke all on function public.wakppu_gem_ball_hit(jsonb) from public,anon,authenticated;
-- Divert only inside the item implementation; guards and automatic-attack cooldown stay outside.
do $patch$
declare f record;body text;changed text;count_found integer:=0;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
  and p.prosrc like '%base_reward numeric%' and p.prosrc like '%s.item_current_clicks%' and p.prosrc like '%a=''item_hit''%' loop
  body:=pg_get_functiondef(f.oid);
  changed:=regexp_replace(body,'\mbegin\M',$inject$begin
 if a='item_hit' and coalesce(b->>'event_id','')='' and exists(select 1 from public.wakppu_gem_ball_players gp where gp.user_id=u and gp.selected is not null and (gp.owned ? gp.selected or public.wakppu_admin_content_access())) then
  return public.wakppu_gem_ball_hit(b);
 end if;$inject$,'i');
  if changed=body then raise exception 'Missing item entry';end if;execute changed;count_found:=count_found+1;
 end loop;
 if count_found<>1 then raise exception 'Expected one item handler, found %',count_found;end if;
end $patch$;
alter function public.wakppu_api(jsonb) rename to wakppu_api_before_gem_balls;
revoke all on function public.wakppu_api_before_gem_balls(jsonb) from public,anon,authenticated;
create function public.wakppu_api(b jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $api$
declare u uuid:=auth.uid();a text:=b->>'action';r jsonb;p public.wakppu_gem_ball_players%rowtype;d public.wakppu_gem_ball_defs%rowtype;s public.game_states%rowtype;
 rid uuid;cached public.wakppu_gem_ball_requests%rowtype;old_rebirth integer;old_ball text;fp jsonb:=b-'request_id';
begin
 if a in ('gem_balls','gem_ball_buy','gem_ball_select') then
  if u is null then raise sqlstate 'PT401';end if;
  perform public.wakppu_api_before_gem_balls('{"action":"bootstrap"}');
  if b ?| array['user_id','target_user_id','price','gem_reward','owned','gold','clicks'] then raise sqlstate 'PT403';end if;
  if a='gem_balls' then return public.wakppu_gem_ball_snapshot(u);end if;
  if coalesce(b->>'request_id','') !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then raise sqlstate 'PT400';end if;
  rid:=(b->>'request_id')::uuid;
  select * into s from public.game_states where user_id=u for update;
  select * into cached from public.wakppu_gem_ball_requests where user_id=u and request_id=rid;
  if found then if cached.fingerprint<>fp then raise sqlstate 'PT409';end if;return cached.response;end if;
  if (b->>'item_revision')::bigint is distinct from s.item_revision then raise sqlstate 'PT409';end if;
  insert into public.wakppu_gem_ball_players(user_id) values(u) on conflict do nothing;
  select * into p from public.wakppu_gem_ball_players where user_id=u for update;
  if a='gem_ball_buy' or b->>'ball_id' is not null then
   select * into d from public.wakppu_gem_ball_defs where ball_id=b->>'ball_id';
   if not found then raise sqlstate 'PT400';end if;
  end if;
  if a='gem_ball_buy' then
   if p.owned ? d.ball_id then raise sqlstate 'PT409' using message='이미 해금한 볼입니다.';end if;
   if public.wakppu_admin_content_access() then raise sqlstate 'PT409' using message='관리자는 구매 없이 선택할 수 있습니다.';end if;
   insert into public.wakppu_blue_gems(user_id) values(u) on conflict do nothing;
   perform 1 from public.wakppu_blue_gems where user_id=u for update;
   if (select balance<d.price from public.wakppu_blue_gems where user_id=u) then raise sqlstate 'PT400' using message='푸른젬이 부족합니다.';end if;
   update public.wakppu_blue_gems set balance=balance-d.price,revision=revision+1 where user_id=u;
   update public.wakppu_gem_ball_players set owned=owned||to_jsonb(d.ball_id) where user_id=u;
  else
   if not b ? 'ball_id' or jsonb_typeof(b->'ball_id') not in ('string','null') then raise sqlstate 'PT400';end if;
   if b->>'ball_id' is not null and not (p.owned ? d.ball_id or public.wakppu_admin_content_access()) then raise sqlstate 'PT403';end if;
   if b->>'ball_id' is not null then
    r:=public.wakppu_api_before_gem_balls('{"action":"limited"}');
    if r->>'selected' is not null then
     perform public.wakppu_api_before_gem_balls(jsonb_build_object('action','limited_select','ball_id',null,'request_id',gen_random_uuid(),'item_revision',s.item_revision));
    end if;
   end if;
   update public.wakppu_gem_ball_players set selected=b->>'ball_id',clicks=0 where user_id=u;
  end if;
  update public.game_states set item_revision=item_revision+1 where user_id=u;
  r:=public.wakppu_api_before_gem_balls('{"action":"items"}')||jsonb_build_object('gem_balls',public.wakppu_gem_ball_snapshot(u),'blue_gems',public.wakppu_blue_gem_snapshot(u),'limited',public.wakppu_api_before_gem_balls('{"action":"limited"}'));
  insert into public.wakppu_gem_ball_requests values(u,rid,fp,r);return r;
 end if;
 select rebirths,selected_ball_id into old_rebirth,old_ball from public.game_states where user_id=u;
 r:=public.wakppu_api_before_gem_balls(b);
 if u is not null and (a='limited_select' and b->>'ball_id' is not null or a='save_progress' and b->>'selected_ball_id' is distinct from old_ball) then
  update public.wakppu_gem_ball_players set selected=null,clicks=0 where user_id=u;
 end if;
 if exists(select 1 from public.game_states where user_id=u and rebirths>old_rebirth) then update public.wakppu_gem_ball_players set clicks=0 where user_id=u;end if;
 if u is not null and (a in ('bootstrap','items','item_hit','limited_hit','ember_auto_hit','save_progress','limited_select') or a like 'auto_rebirth_%') then
  r:=r||jsonb_build_object('gem_balls',public.wakppu_gem_ball_snapshot(u));
 end if;
 return r;
end $api$;
revoke all on function public.wakppu_api(jsonb) from public;
grant execute on function public.wakppu_api(jsonb) to anon,authenticated;
commit;
