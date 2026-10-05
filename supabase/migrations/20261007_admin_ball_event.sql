-- Apply after whitehole and custom gold events. No production application until local review.
begin;
alter table public.server_settings add column if not exists admin_ball_event jsonb;
create table if not exists public.wakppu_ball_rewards(ball_id text primary key,reward numeric not null check(reward>0));
-- Generated from balls-data.js by tools/sync-event-ball-catalog.mjs.
insert into public.wakppu_ball_rewards values
('yellow',1),('green',10),('strawberry',30),('apple',50),('chocolate',100),('donut',250),('rainbow',400),('water',1000),('emerald',1500),('diamond',2000),('planet',10000),('sun',500000),('blackhole',5000000),('whitehole',15000000)
on conflict(ball_id) do update set reward=excluded.reward;
create table if not exists public.wakppu_event_ball_progress(
 user_id uuid references public.players(user_id) on delete cascade,
 event_id text not null,clicks integer not null default 0 check(clicks between 0 and 599),
 request_id text,response jsonb,primary key(user_id,event_id)
);
alter table public.wakppu_ball_rewards enable row level security;
alter table public.wakppu_event_ball_progress enable row level security;
revoke all on public.wakppu_ball_rewards,public.wakppu_event_ball_progress from public,anon,authenticated;
do $$begin
 if to_regprocedure('public.wakppu_api_before_admin_ball(jsonb)') is null then
  alter function public.wakppu_api(jsonb) rename to wakppu_api_before_admin_ball;
 end if;
end$$;
revoke all on function public.wakppu_api_before_admin_ball(jsonb) from public,anon,authenticated;
create or replace function public.wakppu_api(b jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare a text:=b->>'action'; u uuid:=auth.uid(); role_name text; result jsonb; settings server_settings;
 e jsonb; previous jsonb; instant timestamptz; duration integer; delay integer;
 s game_states; p wakppu_event_ball_progress; hits integer; damage integer; reward numeric:=0; best numeric; multiplier integer:=1;
begin
 if a='admin_ball_event' then
  if u is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.'; end if;
  select role into role_name from players where user_id=u;
  if role_name is distinct from 'admin' or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise sqlstate 'PT403' using message='관리자 권한이 필요합니다.'; end if;
  perform public.wakppu_api_before_admin_ball(jsonb_build_object('action','bootstrap'));
  if coalesce(b->>'mode','') not in ('start','stop') then raise sqlstate 'PT400' using message='이벤트 작업을 선택하세요.'; end if;
  select * into settings from server_settings where id=true for update;instant:=clock_timestamp();previous:=settings.admin_ball_event;
  if b->>'mode'='start' then
   if settings.maintenance or (previous->>'ends_at')::timestamptz>instant then raise sqlstate 'PT409' using message='점검 또는 기존 이벤트를 종료해주세요.'; end if;
   if coalesce(b->>'duration_seconds','300')!~'^[0-9]{1,5}$' or coalesce(b->>'delay_seconds','0')!~'^[0-9]{1,5}$' then raise sqlstate 'PT400' using message='시간은 정수로 입력하세요.'; end if;
   duration:=coalesce((b->>'duration_seconds')::integer,300);delay:=coalesce((b->>'delay_seconds')::integer,0);
   if duration not between 1 and 86400 or delay not between 0 and 86400 then raise sqlstate 'PT400' using message='시간 범위를 확인해주세요.'; end if;
   e:=jsonb_build_object('id',gen_random_uuid(),'starts_at',instant+make_interval(secs=>delay),'ends_at',instant+make_interval(secs=>delay+duration));
  end if;
  update server_settings set admin_ball_event=e where id=true;
  -- Old progress is no longer reachable after a new event and does not need to accumulate.
  delete from wakppu_event_ball_progress;
  insert into admin_audit_logs(admin_user_id,action,reason,details) values(u,'ADMIN_BALL_EVENT_'||upper(b->>'mode'),'관리자 왁뿌볼 이벤트',jsonb_build_object('before',previous,'after',e));
  return jsonb_build_object('ok',true,'admin_ball_event',e,'server_time',instant);
 elsif a='event_ball_hit' then
  -- Reuse account, moderation and maintenance enforcement from the existing API.
  perform public.wakppu_api_before_admin_ball(jsonb_build_object('action','bootstrap'));
  select * into settings from server_settings where id=true for share;instant:=clock_timestamp();e:=settings.admin_ball_event;
  if settings.maintenance or e is null or e->>'id' is distinct from b->>'event_id' or instant<(e->>'starts_at')::timestamptz or instant>=(e->>'ends_at')::timestamptz then raise sqlstate 'PT409' using message='관리자 볼 이벤트가 종료되었거나 아직 시작되지 않았습니다.'; end if;
  if coalesce(b->>'request_id','')!~'^[a-f0-9-]{36}$' then raise sqlstate 'PT400' using message='잘못된 타격 요청입니다.'; end if;
  select * into s from game_states where user_id=u for update;
  insert into wakppu_event_ball_progress(user_id,event_id) values(u,e->>'id') on conflict do nothing;
  select * into p from wakppu_event_ball_progress where user_id=u and event_id=e->>'id' for update;
  if p.request_id=b->>'request_id' then return p.response; end if;
  damage:=public.wakppu_hammer_damage(s.hammer_owned,s.hammer_level);
  hits:=least(600,p.clicks+damage);
  if hits=600 then
   select coalesce(max(c.reward),1) into best from wakppu_ball_rewards c where s.unlocked_ball_ids ? c.ball_id;
   if settings.gold_event is not null and instant>=(settings.gold_event->>'starts_at')::timestamptz and instant<(settings.gold_event->>'ends_at')::timestamptz then multiplier:=(settings.gold_event->>'multiplier')::integer; end if;
   reward:=trunc(best*10*power(2::numeric,s.rebirths)*(case when s.honey_expires_at>instant then 2 else 1 end)*multiplier);
   update game_states set gold=gold+reward,updated_at=instant where user_id=u returning * into s;
  end if;
  perform public.wakppu_api_before_admin_ball(jsonb_build_object('action','mark_first_play'));
  result:=jsonb_build_object('clicks',hits,'reward',reward::text,'gold',trunc(s.gold)::text);
  update wakppu_event_ball_progress set clicks=case when hits=600 then 0 else hits end,request_id=b->>'request_id',response=result where user_id=u and event_id=e->>'id';
  return result;
 end if;
 result:=public.wakppu_api_before_admin_ball(b);
 if a='status' then
  select * into settings from server_settings where id=true;
  return result||jsonb_build_object('admin_ball_event',case when settings.maintenance then null else settings.admin_ball_event end);
 end if;
 return result;
end$$;
revoke all on function public.wakppu_api(jsonb) from public;
grant execute on function public.wakppu_api(jsonb) to anon,authenticated;
commit;
