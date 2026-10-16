begin;
alter table public.game_states add column if not exists hammer_selected_level integer;
alter table public.game_states drop constraint if exists game_states_hammer_selected_level_check;
alter table public.game_states add constraint game_states_hammer_selected_level_check
 check(hammer_selected_level is null or (hammer_owned and hammer_selected_level between 1 and hammer_level));
-- Use the selected level in every existing authoritative damage path.
do $patch$
declare f record; body text; patched integer:=0;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname like 'wakppu_api%' and p.prokind='f' loop
  body:=pg_get_functiondef(f.oid);
  if position('public.wakppu_hammer_damage(s.hammer_owned,s.hammer_level)' in body)>0 then
   body:=replace(body,'public.wakppu_hammer_damage(s.hammer_owned,s.hammer_level)',
    'public.wakppu_hammer_damage(s.hammer_owned,least(s.hammer_level,coalesce(s.hammer_selected_level,s.hammer_level)))');
   execute body;
  end if;
  if position('coalesce(s.hammer_selected_level,s.hammer_level)' in body)>0 then patched:=patched+1;end if;
 end loop;
 if patched<3 then raise exception 'Expected ordinary, limited and event hammer damage APIs, found %',patched;end if;
end $patch$;
do $wrap$ begin
 if to_regprocedure('public.wakppu_api_before_hammer_selection(jsonb)') is null then
  alter function public.wakppu_api(jsonb) rename to wakppu_api_before_hammer_selection;
 end if;
end $wrap$;
revoke all on function public.wakppu_api_before_hammer_selection(jsonb) from public,anon,authenticated;
create or replace function public.wakppu_api(b jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $api$
declare result jsonb; s public.game_states%rowtype; cached jsonb; cached_action text; chosen integer;
begin
 if b->>'action'='hammer_select' then
  -- Reuse all existing account, ban, sleep and maintenance validation.
  perform public.wakppu_api_before_hammer_selection('{"action":"bootstrap"}'::jsonb);
  select * into s from public.game_states where user_id=auth.uid() for update;
  if coalesce(b->>'request_id','') !~ '^[a-f0-9-]{36}$' then raise exception '잘못된 요청 ID';end if;
  select response,action into cached,cached_action from public.wakppu_item_requests where user_id=auth.uid() and request_id=(b->>'request_id')::uuid;
  if found then
   if cached_action<>'hammer_select' then raise exception '요청 ID 충돌';end if;
   return cached;
  end if;
  if coalesce((b->>'item_revision')::bigint,-1)<>s.item_revision then raise sqlstate 'PT409' using message='상태를 다시 불러옵니다.';end if;
  if not s.hammer_owned or not b ? 'level' then raise exception '구매한 망치 레벨 안에서 선택해주세요.';end if;
  if b->'level'<>'null'::jsonb then
   if jsonb_typeof(b->'level')<>'number' or b->>'level' !~ '^[1-9][0-9]*$' then raise exception '올바른 망치 레벨을 선택해주세요.';end if;
   chosen:=(b->>'level')::integer;
   if chosen not between 1 and s.hammer_level then raise exception '구매한 망치 레벨 안에서 선택해주세요.';end if;
  end if;
  update public.game_states set hammer_selected_level=chosen,item_revision=item_revision+1 where user_id=auth.uid();
  result:=public.wakppu_api_before_hammer_selection('{"action":"items"}'::jsonb)||jsonb_build_object('hammer_selected_level',chosen);
  insert into public.wakppu_item_requests values(auth.uid(),(b->>'request_id')::uuid,'hammer_select',result);
  return result;
 end if;
 result:=public.wakppu_api_before_hammer_selection(b);
 if result ? 'inventory' then
  select hammer_selected_level into chosen from public.game_states where user_id=auth.uid();
  result:=result||jsonb_build_object('hammer_selected_level',chosen);
 end if;
 return result;
end $api$;
revoke all on function public.wakppu_api(jsonb) from public;
grant execute on function public.wakppu_api(jsonb) to anon,authenticated;
commit;
