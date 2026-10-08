begin;
alter table public.server_settings add column if not exists background_mode text not null default 'auto' check (background_mode in ('auto','default','halloween'));
do $$ begin
  if to_regprocedure('public.wakppu_api_before_background(jsonb)') is null then
    alter function public.wakppu_api(jsonb) rename to wakppu_api_before_background;
  end if;
end $$;
create or replace function public.wakppu_api(b jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); role_name text; previous text; selected text; result jsonb;
begin
  if b->>'action'='admin_background' then
    if actor is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.'; end if;
    select role into role_name from players where user_id=actor;
    if role_name is distinct from 'admin' or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
      raise sqlstate 'PT403' using message='관리자 권한이 필요합니다.';
    end if;
    perform public.wakppu_api_before_background('{"action":"bootstrap"}'::jsonb);
    selected:=b->>'mode';
    if selected is null or selected not in ('auto','default','halloween') then
      raise sqlstate 'PT400' using message='배경 설정을 선택하세요.';
    end if;
    select background_mode into previous from server_settings where id=true for update;
    update server_settings set background_mode=selected where id=true;
    insert into admin_audit_logs(admin_user_id,action,reason,details)
      values(actor,'ADMIN_BACKGROUND','전체 배경 변경',jsonb_build_object('before',previous,'after',selected));
    return jsonb_build_object('ok',true,'background_mode',selected,'server_time',clock_timestamp());
  end if;
  result:=public.wakppu_api_before_background(b);
  if b->>'action'='status' then
    return result||jsonb_build_object('background_mode',(select background_mode from server_settings where id=true),'server_time',clock_timestamp());
  end if;
  return result;
end $$;
revoke all on function public.wakppu_api_before_background(jsonb) from public,anon,authenticated;
revoke all on function public.wakppu_api(jsonb) from public;
grant execute on function public.wakppu_api(jsonb) to anon,authenticated;
commit;
