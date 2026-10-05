-- Track only accounts created after installation. Existing accounts are never backfilled.
begin;
create table if not exists public.guest_lifecycle (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null,
 first_play_at timestamptz
);
alter table public.guest_lifecycle enable row level security;
revoke all on public.guest_lifecycle from public,anon,authenticated;
create index if not exists guest_lifecycle_unplayed_idx on public.guest_lifecycle(created_at) where first_play_at is null;
create or replace function public.wakppu_track_new_guest() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.is_anonymous then
  insert into guest_lifecycle(user_id,created_at) values(new.id,coalesce(new.created_at,now())) on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function public.wakppu_track_new_guest() from public,anon,authenticated;
drop trigger if exists wakppu_track_new_guest on auth.users;
create trigger wakppu_track_new_guest after insert on auth.users for each row execute function public.wakppu_track_new_guest();

create or replace function public.wakppu_guest_accounts()
returns table(id uuid,nickname text,created_at timestamptz,first_play_at timestamptz,eligible boolean,exemption text,hide_at timestamptz,delete_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 select l.user_id,p.nickname,l.created_at,l.first_play_at,
  l.first_play_at is null and coalesce(u.is_anonymous,false) and coalesce(u.email,'')='' and coalesce(u.raw_user_meta_data->>'wakppu_email_link_pending','false')<>'true' and p.role<>'admin' and not exists(select 1 from admin_audit_logs a where a.admin_user_id=l.user_id),
  case when p.role='admin' then '관리자' when l.first_play_at is not null then '플레이 기록 있음'
   when not coalesce(u.is_anonymous,false) or coalesce(u.email,'')<>'' or coalesce(u.raw_user_meta_data->>'wakppu_email_link_pending','false')='true' then '이메일 연결'
   when exists(select 1 from admin_audit_logs a where a.admin_user_id=l.user_id) then '관리자 작업 기록 있음' else null end,
  l.created_at+interval '30 minutes',l.created_at+interval '3 days'
 from guest_lifecycle l join auth.users u on u.id=l.user_id join players p on p.user_id=l.user_id
$$;
revoke all on function public.wakppu_guest_accounts() from public,anon,authenticated;

create or replace function public.wakppu_guest_cleanup_enabled() returns boolean
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare enabled boolean:=false;
begin
 if to_regclass('cron.job') is not null then
  execute 'select exists(select 1 from cron.job where jobname=''wakppu-unplayed-guest-cleanup'' and active)' into enabled;
 end if;
 return enabled;
end $$;
revoke all on function public.wakppu_guest_cleanup_enabled() from public,anon,authenticated;

do $$ begin
 if to_regprocedure('public.wakppu_api_before_guest_lifecycle(jsonb)') is null then
  alter function public.wakppu_api(jsonb) rename to wakppu_api_before_guest_lifecycle;
 end if;
end $$;
revoke all on function public.wakppu_api_before_guest_lifecycle(jsonb) from public,anon,authenticated;
create or replace function public.wakppu_api(b jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); result jsonb; filter_name text:=coalesce(b->>'filter','unplayed'); page_number integer; query_text text:=coalesce(b->>'query',''); previous_state game_states;
begin
 if b->>'action' in ('mark_first_play','save_progress') and actor is not null then
  -- Same lock order as cleanup; serializes play/email updates with deletion.
  perform 1 from auth.users where id=actor for update;
  perform 1 from guest_lifecycle where user_id=actor for update;
  if b->>'action'='save_progress' then select * into previous_state from game_states where user_id=actor; end if;
 end if;
 if b->>'action' in ('mark_first_play','admin_guest_accounts') then
  -- Reuse existing login, anonymous-admin, maintenance and ban checks.
  result:=wakppu_api_before_guest_lifecycle(jsonb_build_object('action',case when b->>'action'='mark_first_play' then 'bootstrap' else 'admin_search' end,'query',''));
  if b->>'action'='mark_first_play' then
   update guest_lifecycle set first_play_at=coalesce(first_play_at,now()) where user_id=actor;
   return jsonb_build_object('ok',true);
  end if;
  if filter_name not in ('all','unplayed','hidden','due','protected') or length(query_text)>100 or coalesce(b->>'page','0') !~ '^[0-9]{1,6}$' then raise exception '잘못된 조회 조건입니다.'; end if;
  page_number:=coalesce(b->>'page','0')::integer;
  with matches as (
   select * from wakppu_guest_accounts() g where
    (strpos(lower(g.nickname),lower(query_text))>0 or strpos(g.id::text,query_text)>0) and
    (filter_name='all' or (filter_name='unplayed' and g.eligible) or (filter_name='hidden' and g.eligible and g.hide_at<=now()) or (filter_name='due' and g.eligible and g.delete_at<=now()) or (filter_name='protected' and not g.eligible))
  ), rows as (select * from matches order by created_at,id limit 50 offset page_number*50)
  select jsonb_build_object('total',(select count(*) from matches),'page',page_number,'rows',coalesce((select jsonb_agg(to_jsonb(rows)||jsonb_build_object('ranking_excluded',eligible and hide_at<=now(),'delete_due',eligible and delete_at<=now()) order by created_at,id) from rows),'[]'::jsonb),'server_time',now(),'cleanup_enabled',wakppu_guest_cleanup_enabled()) into result;
  return result;
 end if;
 if b->>'action'='rankings' then
  perform wakppu_api_before_guest_lifecycle(jsonb_build_object('action','bootstrap'));
  return (select coalesce(jsonb_agg(x),'[]'::jsonb) from (
   select p.nickname,g.gold::text as gold,g.rebirths from game_states g join players p using(user_id)
   where not p.ranking_hidden and not exists(select 1 from moderation_cases m where m.user_id=p.user_id and (m.status='banned' or (m.status='suspended' and (m.suspended_until is null or m.suspended_until>now()))))
    and not exists(select 1 from wakppu_guest_accounts() c where c.id=p.user_id and c.eligible and c.hide_at<=now())
   order by g.rebirths desc,g.gold desc,g.user_id limit 100) x);
 end if;
 result:=wakppu_api_before_guest_lifecycle(b);
 if b->>'action'='save_progress' and (b->'play_occurred'='true'::jsonb or (coalesce((b->>'current_clicks')::integer,0)>0) or (coalesce((b->>'rebirths')::integer,0)>0)
  or (previous_state.progress_imported_at is null and (b->>'gold')::numeric>0)
  or (previous_state.progress_imported_at is not null and previous_state.gold<>(b->>'gold')::bigint)) then
  update guest_lifecycle set first_play_at=coalesce(first_play_at,now()) where user_id=actor;
 end if;
 return result;
end $$;
revoke all on function public.wakppu_api(jsonb) from public;
grant execute on function public.wakppu_api(jsonb) to anon,authenticated;

-- Callable only by the database job owner, never by a browser or admin RPC.
create or replace function public.wakppu_cleanup_unplayed_guests() returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare candidate record; removed integer:=0;
begin
 for candidate in
  select u.id from auth.users u join guest_lifecycle l on l.user_id=u.id join players p on p.user_id=u.id
  where l.first_play_at is null and l.created_at<=now()-interval '3 days' and u.is_anonymous and coalesce(u.email,'')=''
   and coalesce(u.raw_user_meta_data->>'wakppu_email_link_pending','false')<>'true' and p.role<>'admin'
   and not exists(select 1 from admin_audit_logs a where a.admin_user_id=u.id)
  order by l.created_at limit 100 for update of u,l,p skip locked
 loop
  -- Preserve audit history while releasing the target FK; never delete audit records.
  update admin_audit_logs set target_user_id=null,details=coalesce(details,'{}'::jsonb)||jsonb_build_object('deleted_target_user_id',candidate.id) where target_user_id=candidate.id;
  delete from auth.users where id=candidate.id;
  removed:=removed+1;
 end loop;
 return removed;
end $$;
revoke all on function public.wakppu_cleanup_unplayed_guests() from public,anon,authenticated;
commit;
