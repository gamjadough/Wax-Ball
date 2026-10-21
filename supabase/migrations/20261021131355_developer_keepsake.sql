begin;
create table if not exists public.wakppu_developer_keepsakes(
 user_id uuid primary key references public.players(user_id) on delete cascade,granted_by uuid not null references public.players(user_id),
 request_id uuid not null,reason text not null check(length(reason) between 3 and 200),granted_at timestamptz not null default clock_timestamp(),unique(granted_by,request_id));
alter table public.wakppu_developer_keepsakes enable row level security;
revoke all on public.wakppu_developer_keepsakes from public,anon,authenticated;
-- Permanent gifts must survive guest cleanup without inventing a play record.
do $life$ declare name text;body text;updated text;
begin
 foreach name in array array['public.wakppu_guest_accounts()','public.wakppu_cleanup_unplayed_guests()'] loop
  if to_regprocedure(name) is null then continue;end if;body:=pg_get_functiondef(to_regprocedure(name));
  if position('developer_keepsake_lifecycle_guard' in body)>0 then continue;end if;
  updated:=replace(body,'and not exists(select 1 from admin_audit_logs a where a.admin_user_id=l.user_id)',
   'and not exists(select 1 from admin_audit_logs a where a.admin_user_id=l.user_id) and not exists(select 1 from public.wakppu_developer_keepsakes k where k.user_id=l.user_id) /* developer_keepsake_lifecycle_guard */');
  updated:=replace(updated,'and not exists(select 1 from admin_audit_logs a where a.admin_user_id=u.id)',
   'and not exists(select 1 from admin_audit_logs a where a.admin_user_id=u.id) and not exists(select 1 from public.wakppu_developer_keepsakes k where k.user_id=u.id) /* developer_keepsake_lifecycle_guard */');
  updated:=replace(updated,'case when p.role=''admin'' then ''관리자'' when',
   'case when p.role=''admin'' then ''관리자'' when exists(select 1 from public.wakppu_developer_keepsakes k where k.user_id=l.user_id) then ''개발자 소장품 지급 이력'' when');
  if updated=body or position('developer_keepsake_lifecycle_guard' in updated)=0 then raise exception 'Expected lifecycle function';end if;execute updated;
 end loop;
end $life$;
do $wrap$ begin
 if to_regprocedure('public.wakppu_api_before_developer_keepsake(jsonb)') is null then alter function public.wakppu_api(jsonb) rename to wakppu_api_before_developer_keepsake;end if;
end $wrap$;
revoke all on function public.wakppu_api_before_developer_keepsake(jsonb) from public,anon,authenticated;
create or replace function public.wakppu_api(b jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $api$
declare a text:=b->>'action';u uuid:=auth.uid();t uuid;rid uuid;why text;result jsonb;rev bigint;prior public.wakppu_developer_keepsakes;
begin
 if a in ('admin_keepsake_status','admin_keepsake_grant') then
  if u is null then raise sqlstate 'PT401';end if;
  perform public.wakppu_api_before_developer_keepsake('{"action":"bootstrap"}');
  if not exists(select 1 from public.players p join auth.users au on au.id=p.user_id where p.user_id=u and p.role='admin' and not coalesce(au.is_anonymous,true)) then raise sqlstate 'PT403' using message='개발자 권한이 필요합니다.';end if;
  t:=(b->>'user_id')::uuid;if t is null or not exists(select 1 from public.players where user_id=t) then raise sqlstate 'PT404' using message='대상 계정을 확인하세요.';end if;
  perform pg_advisory_xact_lock(hashtextextended(t::text,19));
  if a='admin_keepsake_grant' then
   why:=trim(coalesce(b->>'reason',''));rid:=(b->>'request_id')::uuid;
   if rid is null or length(why)<3 or length(why)>200 or b->>'item_id' is distinct from 'developer_piercing_fragment' then raise sqlstate 'PT400';end if;
   select * into prior from public.wakppu_developer_keepsakes where granted_by=u and request_id=rid;
   if found and prior.user_id<>t then raise sqlstate 'PT409' using message='같은 요청을 다른 계정에 사용할 수 없습니다.';end if;
   if not exists(select 1 from public.wakppu_developer_keepsakes where user_id=t) then
    insert into public.wakppu_developer_keepsakes(user_id,granted_by,request_id,reason) values(t,u,rid,why);
    insert into public.admin_audit_logs(admin_user_id,target_user_id,action,reason,details) values(u,t,a,why,jsonb_build_object('item_id','developer_piercing_fragment','permanent',true));
   end if;
  end if;
  return jsonb_build_object('user_id',t,'owned',exists(select 1 from public.wakppu_developer_keepsakes where user_id=t),'granted_at',(select granted_at from public.wakppu_developer_keepsakes where user_id=t));
 end if;
 if a='item_use' and b->>'item_id'='developer_piercing_fragment' then
  if u is null then raise sqlstate 'PT401';end if;
  perform public.wakppu_api_before_developer_keepsake('{"action":"bootstrap"}');
  select item_revision into rev from public.game_states where user_id=u for update;
  if not exists(select 1 from public.wakppu_developer_keepsakes where user_id=u) then raise sqlstate 'PT403' using message='지급받은 소장품만 사용할 수 있습니다.';end if;
  if coalesce(b->>'request_id','')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise sqlstate 'PT400';end if;
  if coalesce((b->>'item_revision')::bigint,-1)<>rev then raise sqlstate 'PT409';end if;
  -- A cosmetic use is a pure read: no stock consumption, effects or reward/revision changes.
  result:=public.wakppu_api_before_developer_keepsake('{"action":"items"}');
 else result:=public.wakppu_api_before_developer_keepsake(b);end if;
 if jsonb_typeof(result)='object' and (result?'inventory' or (a='item_use' and b->>'item_id'='developer_piercing_fragment')) and exists(select 1 from public.wakppu_developer_keepsakes where user_id=u) then
  result:=jsonb_set(result,'{inventory}',coalesce(result->'inventory','{}')||'{"developer_piercing_fragment":1}'::jsonb);
 end if;
 return result;
end $api$;
revoke all on function public.wakppu_api(jsonb) from public,anon;
grant execute on function public.wakppu_api(jsonb) to anon,authenticated;
commit;
