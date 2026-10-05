-- Keep the event and guest-lifecycle wrappers intact while extending the base game API.
begin;

alter table public.game_states alter column gold type numeric using gold::numeric;
create or replace function public.wakppu_state_json(s public.game_states) returns jsonb
language sql immutable as $$ select to_jsonb(s)||jsonb_build_object('gold',s.gold::text) $$;
revoke all on function public.wakppu_state_json(public.game_states) from public;

-- The function below is the base beneath the gold-event and guest-lifecycle wrappers.
create or replace function public.wakppu_api_before_events(b jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 a text:=b->>'action'; u uuid:=auth.uid(); r text; s game_states; player_row players; t uuid; before_data jsonb; result jsonb;
 settings server_settings; ids jsonb; amount numeric; val numeric; mode text:=b->>'mode'; balls text[]:=array['yellow','green','strawberry','apple','chocolate','donut','rainbow','water','emerald','diamond','planet','sun','blackhole']; idx integer; m moderation_cases; blocked boolean; ban_hours integer; ban_reason text;
begin
 select * into settings from server_settings where id=true;
 select role into r from players where user_id=u;
 if coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then r:='player'; end if;
 select * into m from moderation_cases where user_id=u;
 blocked:=coalesce(m.status='banned' or (m.status='suspended' and (m.suspended_until is null or m.suspended_until>now())),false);
 if a='status' then return jsonb_build_object('role',coalesce(r,'player'),'maintenance',settings.maintenance,'message',settings.message,'announcement',settings.announcement,'moderation',coalesce(to_jsonb(m),'{}'::jsonb)||jsonb_build_object('blocked',blocked),'admin_revision',(select admin_revision from game_states where user_id=u)); end if;
 if u is null or r is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.'; end if;
 if left(a,6)='admin_' and r<>'admin' then raise sqlstate 'PT403' using message='관리자 권한이 필요합니다.'; end if;
 if settings.maintenance and r<>'admin' then raise sqlstate 'PT503' using message='현재 패치 중입니다.'; end if;
 if blocked then raise sqlstate 'PT403' using message='이 계정은 이용이 제한되었습니다.'; end if;
 if a='bootstrap' then
  select * into s from game_states where user_id=u; select * into player_row from players where user_id=u;
  return jsonb_build_object('player',to_jsonb(player_row),'state',wakppu_state_json(s),'moderation',(select to_jsonb(mc) from moderation_cases mc where user_id=u));
 elsif a='rankings' then
  return (select coalesce(jsonb_agg(x),'[]'::jsonb) from (select p.nickname,g.gold::text as gold,g.rebirths from game_states g join players p using(user_id) where not p.ranking_hidden and not exists(select 1 from moderation_cases mc where mc.user_id=p.user_id and (mc.status='banned' or (mc.status='suspended' and (mc.suspended_until is null or mc.suspended_until>now())))) order by g.rebirths desc,g.gold desc,g.user_id limit 100) x);
 elsif a='set_nickname' then
  if length(trim(b->>'nickname')) not between 2 and 16 then raise exception '닉네임은 2~16자입니다.'; end if;
  update players set nickname=trim(b->>'nickname'),updated_at=now() where user_id=u;
  return jsonb_build_object('ok',true);
 elsif a='save_progress' then
  select * into s from game_states where user_id=u for update;
  if s.admin_revision<>coalesce((b->>'admin_revision')::integer,0) then raise sqlstate 'PT409' using message='관리자가 변경한 진행도를 다시 불러옵니다.'; end if;
  if exists(select 1 from moderation_cases where user_id=u and (status='banned' or (status='suspended' and (suspended_until is null or suspended_until>now())))) then raise sqlstate 'PT403' using message='정지된 계정입니다.'; end if;
  if coalesce(b->>'gold','') !~ '^[0-9]{1,100}$' then raise exception '올바른 Gold 값이 필요합니다.'; end if;
  amount:=(b->>'gold')::numeric;
  if (b->>'rebirths')::integer not between 0 and 100 or coalesce((b->>'hammer_level')::integer,0) not between 0 and 10 then raise exception '저장 범위를 초과했습니다.'; end if;
  if jsonb_typeof(b->'unlocked_ball_ids')<>'array' or exists(select 1 from jsonb_array_elements_text(b->'unlocked_ball_ids') x where not x=any(balls)) or not (b->>'selected_ball_id')=any(balls) then raise exception '잘못된 왁뿌볼입니다.'; end if;
  if b ? 'discovered_ball_ids' and (jsonb_typeof(b->'discovered_ball_ids')<>'array' or exists(select 1 from jsonb_array_elements_text(b->'discovered_ball_ids') x where not x=any(balls))) then raise exception '잘못된 도감입니다.'; end if;
  update game_states set discovered_ball_ids=(select coalesce(jsonb_agg(distinct x),'[]'::jsonb) from jsonb_array_elements(discovered_ball_ids||coalesce(b->'discovered_ball_ids','[]'::jsonb)) x),gold=amount,rebirths=(b->>'rebirths')::smallint,unlocked_ball_ids=b->'unlocked_ball_ids',selected_ball_id=b->>'selected_ball_id',hammer_owned=coalesce((b->>'hammer_owned')::boolean,false),hammer_level=coalesce((b->>'hammer_level')::integer,1),honey_expires_at=(b->>'honey_expires_at')::timestamptz,progress_imported_at=coalesce(progress_imported_at,now()),updated_at=now() where user_id=u;
  return jsonb_build_object('ok',true);
 elsif a='admin_search' then
  return (select coalesce(jsonb_agg(x),'[]'::jsonb) from (select p.user_id as id,p.nickname,p.ranking_hidden,wakppu_state_json(g) as state,to_jsonb(mc) as moderation from players p join game_states g using(user_id) left join moderation_cases mc using(user_id) where strpos(lower(p.nickname),lower(coalesce(b->>'query','')))>0 or strpos(p.user_id::text,coalesce(b->>'query',''))>0 order by p.nickname limit 50) x);
 elsif a='admin_logs' then
  return (select coalesce(jsonb_agg(x),'[]'::jsonb) from (select * from admin_audit_logs order by created_at desc,id desc limit 100) x);
 elsif a='admin_test' then
  if not (b->>'ball_id')=any(balls) then raise exception '잘못된 왁뿌볼입니다.'; end if;
  return jsonb_build_object('ball_id',b->>'ball_id','authorized',true);
 elsif a in ('admin_maintenance','admin_announcement') then
  select to_jsonb(z) into before_data from server_settings z where id=true for update;
  if a='admin_maintenance' then update server_settings set maintenance=(b->>'enabled')::boolean,message=coalesce(left(b->>'message',500),message) where id=true;
  elsif b->'clear'='true'::jsonb then update server_settings set announcement=null where id=true;
  else
   if coalesce(length(trim(b->>'message')),0) not between 1 and 500 then raise exception '공지는 1~500자입니다.'; end if;
   update server_settings set announcement=jsonb_build_object('message',b->>'message','author',u,'created_at',now()) where id=true;
  end if;
  select to_jsonb(z) into result from server_settings z where id=true;
 else
  if a not in ('admin_gold','admin_rebirths','admin_unban','admin_unlock','admin_discovery','admin_ban','admin_ranking_visibility') then raise exception '지원하지 않는 작업입니다.'; end if;
  t:=(b->>'user_id')::uuid;
  select * into s from game_states where user_id=t for update;
  if not found then raise exception '플레이어가 없습니다.'; end if;
  before_data:=wakppu_state_json(s)||jsonb_build_object('ranking_hidden',(select ranking_hidden from players where user_id=t),'moderation',(select to_jsonb(mc) from moderation_cases mc where user_id=t));
  if a in ('admin_gold','admin_rebirths') then
   if coalesce(b->>'value','') !~ '^[0-9]{1,100}$' or mode not in ('add','subtract','set') then raise exception '올바른 정수와 변경 방식을 선택하세요.'; end if;
   amount:=(b->>'value')::numeric; val:=case when a='admin_gold' then s.gold else s.rebirths end;
   val:=case mode when 'add' then val+amount when 'subtract' then greatest(0,val-amount) else amount end;
   if val>(case when a='admin_gold' then 9999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999::numeric else 100 end) then raise exception '변경 범위를 초과했습니다.'; end if;
   if a='admin_gold' then update game_states set gold=val where user_id=t; else update game_states set rebirths=val::smallint where user_id=t; end if;
  elsif a='admin_ranking_visibility' then
   if jsonb_typeof(b->'hidden') is distinct from 'boolean' or length(coalesce(b->>'reason',''))>500 then raise exception '올바른 랭킹 숨김 여부와 사유가 필요합니다.'; end if;
   update players set ranking_hidden=(b->>'hidden')::boolean,updated_at=now() where user_id=t;
  elsif a='admin_ban' then
   if exists(select 1 from players where user_id=t and role='admin') then raise exception '관리자 계정은 밴할 수 없습니다.'; end if;
   ban_reason:=trim(coalesce(b->>'reason',''));
   if length(ban_reason) not between 1 and 500 or coalesce(mode,'') not in ('temporary','permanent') then raise exception '밴 종류와 1~500자 사유가 필요합니다.'; end if;
   if mode='temporary' then
    if coalesce(b->>'duration_hours','') !~ '^[0-9]{1,4}$' then raise exception '밴 기간은 1~8760시간입니다.'; end if;
    ban_hours:=(b->>'duration_hours')::integer; if ban_hours not between 1 and 8760 then raise exception '밴 기간은 1~8760시간입니다.'; end if;
   end if;
   insert into moderation_cases(user_id,status,suspended_until,last_reason,updated_at) values(t,case when mode='permanent' then 'banned' else 'suspended' end,case when mode='temporary' then now()+make_interval(hours=>ban_hours) else null end,ban_reason,now()) on conflict(user_id) do update set status=excluded.status,suspended_until=excluded.suspended_until,last_reason=excluded.last_reason,updated_at=now();
  elsif a='admin_unban' then
   insert into moderation_cases(user_id,status,suspicion_score,strikes,suspended_until,last_reason,updated_at) values(t,'active',0,0,null,'관리자 밴 해제',now()) on conflict(user_id) do update set status='active',suspicion_score=0,strikes=0,suspended_until=null,last_reason='관리자 밴 해제',updated_at=now();
  else
   idx:=array_position(balls,b->>'ball_id');
   if mode not in ('one','all','reset_one','reset_all') or (mode in ('one','reset_one') and idx is null) then raise exception '잘못된 도감 작업입니다.'; end if;
   ids:=case when mode='all' then to_jsonb(balls) when a='admin_unlock' then to_jsonb(balls[1:idx]) else jsonb_build_array(b->>'ball_id') end;
   if a='admin_unlock' then
    if mode not in ('one','all') then raise exception '잘못된 해금 작업입니다.'; end if;
    update game_states set unlocked_ball_ids=(select jsonb_agg(distinct x) from jsonb_array_elements(unlocked_ball_ids||ids) x),discovered_ball_ids=(select jsonb_agg(distinct x) from jsonb_array_elements(discovered_ball_ids||ids) x) where user_id=t;
   elsif mode='reset_all' then update game_states set discovered_ball_ids='[]' where user_id=t;
   elsif mode='reset_one' then update game_states set discovered_ball_ids=discovered_ball_ids-(b->>'ball_id') where user_id=t;
   else update game_states set discovered_ball_ids=(select jsonb_agg(distinct x) from jsonb_array_elements(discovered_ball_ids||ids) x) where user_id=t;
   end if;
  end if;
  update game_states set admin_revision=admin_revision+1,updated_at=now() where user_id=t;
  select jsonb_build_object('id',p.user_id,'nickname',p.nickname,'ranking_hidden',p.ranking_hidden,'state',wakppu_state_json(g),'moderation',to_jsonb(mc)) into result from players p join game_states g using(user_id) left join moderation_cases mc using(user_id) where p.user_id=t;
 end if;
 insert into admin_audit_logs(admin_user_id,target_user_id,action,reason,details) values(u,t,upper(a),coalesce(nullif(trim(b->>'reason'),''),'관리자 패널'),jsonb_build_object('before',before_data,'after',result));
 return case when t is null then jsonb_build_object('ok',true) else jsonb_build_object('target',result) end;
exception when unique_violation then raise sqlstate 'PT409' using message='이미 사용 중인 닉네임입니다.';
end
$$;
revoke all on function public.wakppu_api_before_events(jsonb) from public,anon,authenticated;

-- Guest lifecycle compares the persisted Gold value to identify real play.  It must
-- use numeric too, otherwise a large valid Gold value would overflow before save.
create or replace function public.wakppu_api(b jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); result jsonb; filter_name text:=coalesce(b->>'filter','unplayed'); page_number integer; query_text text:=coalesce(b->>'query',''); previous_state game_states;
begin
 if b->>'action' in ('mark_first_play','save_progress') and actor is not null then
  perform 1 from auth.users where id=actor for update;
  perform 1 from guest_lifecycle where user_id=actor for update;
  if b->>'action'='save_progress' then select * into previous_state from game_states where user_id=actor; end if;
 end if;
 if b->>'action' in ('mark_first_play','admin_guest_accounts') then
  result:=wakppu_api_before_guest_lifecycle(jsonb_build_object('action',case when b->>'action'='mark_first_play' then 'bootstrap' else 'admin_search' end,'query',''));
  if b->>'action'='mark_first_play' then update guest_lifecycle set first_play_at=coalesce(first_play_at,now()) where user_id=actor; return jsonb_build_object('ok',true); end if;
  if filter_name not in ('all','unplayed','hidden','due','protected') or length(query_text)>100 or coalesce(b->>'page','0') !~ '^[0-9]{1,6}$' then raise exception '잘못된 조회 조건입니다.'; end if;
  page_number:=coalesce(b->>'page','0')::integer;
  with matches as (select * from wakppu_guest_accounts() g where (strpos(lower(g.nickname),lower(query_text))>0 or strpos(g.id::text,query_text)>0) and (filter_name='all' or (filter_name='unplayed' and g.eligible) or (filter_name='hidden' and g.eligible and g.hide_at<=now()) or (filter_name='due' and g.eligible and g.delete_at<=now()) or (filter_name='protected' and not g.eligible))), rows as (select * from matches order by created_at,id limit 50 offset page_number*50)
  select jsonb_build_object('total',(select count(*) from matches),'page',page_number,'rows',coalesce((select jsonb_agg(to_jsonb(rows)||jsonb_build_object('ranking_excluded',eligible and hide_at<=now(),'delete_due',eligible and delete_at<=now()) order by created_at,id) from rows),'[]'::jsonb),'server_time',now(),'cleanup_enabled',wakppu_guest_cleanup_enabled()) into result;
  return result;
 end if;
 if b->>'action'='rankings' then
  perform wakppu_api_before_guest_lifecycle(jsonb_build_object('action','bootstrap'));
  return (select coalesce(jsonb_agg(x),'[]'::jsonb) from (select p.nickname,g.gold::text as gold,g.rebirths from game_states g join players p using(user_id) where not p.ranking_hidden and not exists(select 1 from moderation_cases m where m.user_id=p.user_id and (m.status='banned' or (m.status='suspended' and (m.suspended_until is null or m.suspended_until>now())))) and not exists(select 1 from wakppu_guest_accounts() c where c.id=p.user_id and c.eligible and c.hide_at<=now()) order by g.rebirths desc,g.gold desc,g.user_id limit 100) x);
 end if;
 result:=wakppu_api_before_guest_lifecycle(b);
 if b->>'action'='save_progress' and (b->'play_occurred'='true'::jsonb or (coalesce((b->>'current_clicks')::integer,0)>0) or (coalesce((b->>'rebirths')::integer,0)>0) or (previous_state.progress_imported_at is null and (b->>'gold')::numeric>0) or (previous_state.progress_imported_at is not null and previous_state.gold<>(b->>'gold')::numeric)) then update guest_lifecycle set first_play_at=coalesce(first_play_at,now()) where user_id=actor; end if;
 return result;
end $$;
revoke all on function public.wakppu_api(jsonb) from public;
grant execute on function public.wakppu_api(jsonb) to anon,authenticated;
commit;
