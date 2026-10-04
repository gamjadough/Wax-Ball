begin;
alter table public.game_states add column if not exists admin_revision integer not null default 0;
create table if not exists public.server_settings (id boolean primary key default true check(id), maintenance boolean not null default false, message text not null default '', announcement jsonb);
insert into public.server_settings(id) values(true) on conflict do nothing;
alter table public.server_settings enable row level security;
revoke all on public.server_settings from anon, authenticated;
create or replace function public.wakppu_state_json(s public.game_states) returns jsonb language sql immutable as $$ select to_jsonb(s)||jsonb_build_object('gold',s.gold::text) $$;
revoke all on function public.wakppu_state_json(public.game_states) from public;
create or replace function public.wakppu_api(b jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 a text:=b->>'action'; u uuid:=auth.uid(); r text; s game_states; player_row players; t uuid; before_data jsonb; result jsonb;
 settings server_settings; ids jsonb; amount numeric; val numeric; mode text:=b->>'mode'; balls text[]:=array['yellow','green','strawberry','apple','chocolate','donut','rainbow','water','emerald','diamond','planet','sun','blackhole']; idx integer;
begin
 select * into settings from server_settings where id=true;
 select role into r from players where user_id=u;
 if coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then r:='player'; end if;
 if a='status' then return jsonb_build_object('role',coalesce(r,'player'),'maintenance',settings.maintenance,'message',settings.message,'announcement',settings.announcement,'admin_revision',(select admin_revision from game_states where user_id=u)); end if;
 if u is null or r is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.'; end if;
 if left(a,6)='admin_' and r<>'admin' then raise sqlstate 'PT403' using message='관리자 권한이 필요합니다.'; end if;
 if settings.maintenance and r<>'admin' then raise sqlstate 'PT503' using message='현재 패치 중입니다.'; end if;
 if a='bootstrap' then
 select * into s from game_states where user_id=u; select * into player_row from players where user_id=u;
 return jsonb_build_object('player',to_jsonb(player_row),'state',wakppu_state_json(s),'moderation',(select to_jsonb(m) from moderation_cases m where user_id=u));
 elsif a='rankings' then
 return (select coalesce(jsonb_agg(x),'[]'::jsonb) from (select p.nickname,g.gold::text as gold,g.rebirths from game_states g join players p using(user_id) order by g.rebirths desc,g.gold desc,g.user_id limit 100) x);
 elsif a='set_nickname' then
 if length(trim(b->>'nickname')) not between 2 and 16 then raise exception '닉네임은 2~16자입니다.'; end if;
 update players set nickname=trim(b->>'nickname'),updated_at=now() where user_id=u;
 return jsonb_build_object('ok',true);
 elsif a='save_progress' then
 select * into s from game_states where user_id=u for update;
 if s.admin_revision<>coalesce((b->>'admin_revision')::integer,0) then raise sqlstate 'PT409' using message='관리자가 변경한 진행도를 다시 불러옵니다.'; end if;
 if exists(select 1 from moderation_cases where user_id=u and (status='banned' or (status='suspended' and (suspended_until is null or suspended_until>now())))) then raise sqlstate 'PT403' using message='정지된 계정입니다.'; end if;
 if coalesce(b->>'gold','') !~ '^[0-9]{1,19}$' then raise exception '올바른 Gold 값이 필요합니다.'; end if;
 amount:=(b->>'gold')::numeric;
 if amount>9223372036854775807 or (b->>'rebirths')::integer not between 0 and 25 or coalesce((b->>'hammer_level')::integer,0) not between 0 and 10 then raise exception '저장 범위를 초과했습니다.'; end if;
 if jsonb_typeof(b->'unlocked_ball_ids')<>'array' or exists(select 1 from jsonb_array_elements_text(b->'unlocked_ball_ids') x where not x=any(balls)) or not (b->>'selected_ball_id')=any(balls) then raise exception '잘못된 왁뿌볼입니다.'; end if;
 if b ? 'discovered_ball_ids' and (jsonb_typeof(b->'discovered_ball_ids')<>'array' or exists(select 1 from jsonb_array_elements_text(b->'discovered_ball_ids') x where not x=any(balls))) then raise exception '잘못된 도감입니다.'; end if;
 update game_states set gold=amount::bigint,rebirths=(b->>'rebirths')::smallint,unlocked_ball_ids=b->'unlocked_ball_ids',discovered_ball_ids=(select coalesce(jsonb_agg(distinct x),'[]'::jsonb) from jsonb_array_elements(discovered_ball_ids||coalesce(b->'discovered_ball_ids','[]'::jsonb)) x),selected_ball_id=b->>'selected_ball_id',hammer_owned=coalesce((b->>'hammer_owned')::boolean,false),hammer_level=coalesce((b->>'hammer_level')::integer,1),honey_expires_at=(b->>'honey_expires_at')::timestamptz,progress_imported_at=coalesce(progress_imported_at,now()),updated_at=now() where user_id=u;
 return jsonb_build_object('ok',true);
 elsif a='admin_search' then
 return (select coalesce(jsonb_agg(x),'[]'::jsonb) from (select p.user_id as id,p.nickname,wakppu_state_json(g) as state,to_jsonb(m) as moderation from players p join game_states g using(user_id) left join moderation_cases m using(user_id) where strpos(lower(p.nickname),lower(coalesce(b->>'query','')))>0 or strpos(p.user_id::text,coalesce(b->>'query',''))>0 order by p.nickname limit 50) x);
 elsif a='admin_logs' then
 return (select coalesce(jsonb_agg(x),'[]'::jsonb) from (select * from admin_audit_logs order by created_at desc,id desc limit 100) x);
 elsif a='admin_test' then
 if not (b->>'ball_id')=any(balls) then raise exception '잘못된 왁뿌볼입니다.'; end if;
 return jsonb_build_object('ball_id',b->>'ball_id','authorized',true);
 elsif a in ('admin_maintenance','admin_announcement') then
 select to_jsonb(z) into before_data from server_settings z where id=true for update;
 if a='admin_maintenance' then update server_settings set maintenance=(b->>'enabled')::boolean,message=coalesce(left(b->>'message',500),message) where id=true;
 else
 if length(trim(b->>'message')) not between 1 and 500 then raise exception '공지는 1~500자입니다.'; end if;
 update server_settings set announcement=jsonb_build_object('message',b->>'message','author',u,'created_at',now()) where id=true;
 end if;
 select to_jsonb(z) into result from server_settings z where id=true;
 else
 if a not in ('admin_gold','admin_rebirths','admin_unban','admin_unlock','admin_discovery') then raise exception '지원하지 않는 작업입니다.'; end if;
 t:=(b->>'user_id')::uuid;
 select * into s from game_states where user_id=t for update;
 if not found then raise exception '플레이어가 없습니다.'; end if;
 before_data:=wakppu_state_json(s);
 if a in ('admin_gold','admin_rebirths') then
 if coalesce(b->>'value','') !~ '^[0-9]{1,19}$' or mode not in ('add','subtract','set') then raise exception '올바른 정수와 변경 방식을 선택하세요.'; end if;
 amount:=(b->>'value')::numeric; val:=case when a='admin_gold' then s.gold else s.rebirths end;
 val:=case mode when 'add' then val+amount when 'subtract' then greatest(0,val-amount) else amount end;
 if val>(case when a='admin_gold' then 9223372036854775807 else 25 end) then raise exception '변경 범위를 초과했습니다.'; end if;
 if a='admin_gold' then update game_states set gold=val::bigint where user_id=t; else update game_states set rebirths=val::smallint where user_id=t; end if;
 elsif a='admin_unban' then
 before_data:=before_data||jsonb_build_object('moderation',(select to_jsonb(m) from moderation_cases m where user_id=t));
 update moderation_cases set status='active',suspicion_score=0,strikes=0,suspended_until=null,last_reason='관리자 정지 해제',updated_at=now() where user_id=t;
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
 select jsonb_build_object('id',p.user_id,'nickname',p.nickname,'state',wakppu_state_json(g),'moderation',to_jsonb(m)) into result from players p join game_states g using(user_id) left join moderation_cases m using(user_id) where p.user_id=t;
 end if;
 insert into admin_audit_logs(admin_user_id,target_user_id,action,reason,details) values(u,t,upper(a),'관리자 패널',jsonb_build_object('before',before_data,'after',result));
 return case when t is null then jsonb_build_object('ok',true) else jsonb_build_object('target',result) end;
exception when unique_violation then raise sqlstate 'PT409' using message='이미 사용 중인 닉네임입니다.';
end $$;
revoke all on function public.wakppu_api(jsonb) from public;
grant execute on function public.wakppu_api(jsonb) to anon,authenticated;
commit;
