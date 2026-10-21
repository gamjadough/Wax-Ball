-- Explicit self-discard only. Preserve financial/audit history, not playable accounts.
begin;
alter table public.wakppu_purchase_orders alter column user_id drop not null;
alter table public.wakppu_purchase_orders add column if not exists deleted_user_id uuid;
do $fk$ declare r record;begin
 for r in select conrelid::regclass as tab,conname,pg_get_constraintdef(oid) as def from pg_constraint
 where contype='f' and confrelid='public.players'::regclass
 and ((conrelid='public.wakppu_purchase_orders'::regclass and conkey=array[(select attnum from pg_attribute where attrelid='public.wakppu_purchase_orders'::regclass and attname='user_id')]::smallint[])
 or (conrelid='public.admin_audit_logs'::regclass and conkey=array[(select attnum from pg_attribute where attrelid='public.admin_audit_logs'::regclass and attname='target_user_id')]::smallint[])) loop
  if position('ON DELETE SET NULL' in r.def)=0 then
   execute format('alter table %s drop constraint %I',r.tab,r.conname);
   execute format('alter table %s add constraint %I %s ON DELETE SET NULL',r.tab,r.conname,r.def);
  end if;
 end loop;
end $fk$;
do $wrap$ begin
 if to_regprocedure('public.wakppu_api_before_guest_exit(jsonb)') is null then alter function public.wakppu_api(jsonb) rename to wakppu_api_before_guest_exit;end if;
end $wrap$;
revoke all on function public.wakppu_api_before_guest_exit(jsonb) from public,anon,authenticated;
create or replace function public.wakppu_api(b jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $api$
declare u uuid:=auth.uid();anonymous boolean;a text:=b->>'action';sid text:=auth.jwt()->>'session_id';begin
 if a='guest_discard' then
  if u is null then raise sqlstate 'PT401' using message='로그인이 필요합니다.';end if;
  if b->>'confirmation' is distinct from 'DELETE_GUEST' or b->>'expected_user_id' is distinct from u::text or b?'user_id' or b?'target_user_id' then
   raise sqlstate 'PT409' using message='본인 빠른 시작 계정의 삭제를 다시 확인해주세요.';
  end if;
  select is_anonymous into anonymous from auth.users where id=u for update;
  -- Safe retry after a lost success response. Never recreate a deleted account.
  if not found then return jsonb_build_object('deleted',true,'user_id',u);end if;
  if anonymous is distinct from true or exists(select 1 from public.players where user_id=u and role='admin') then raise sqlstate 'PT403' using message='빠른 시작 계정만 삭제할 수 있습니다. 이메일 계정은 삭제하지 않습니다.';end if;
  if sid is null or not exists(select 1 from auth.sessions where id=sid::uuid and user_id=u) then raise sqlstate 'PT401' using message='로그인이 만료됐습니다. 계정 삭제를 다시 확인해주세요.';end if;
  -- Lock the progress row before removing owned progress/entitlements.
  perform 1 from public.game_states where user_id=u for update;
  update public.wakppu_purchase_orders set deleted_user_id=u where user_id=u;
  update public.admin_audit_logs set details=coalesce(details,'{}')||jsonb_build_object('deleted_target_user_id',u) where target_user_id=u;
  delete from public.wakppu_purchase_entitlements where user_id=u;
  delete from public.wakppu_purchase_cosmetics where user_id=u;
  delete from public.wakppu_first_steps_grants where user_id=u;
  -- Auth sessions/identities and all FK-cascaded gameplay rows are removed atomically.
  delete from auth.users where id=u;
  return jsonb_build_object('deleted',true,'user_id',u);
 end if;
 -- JWTs can remain cryptographically valid after deletion; deny every stale-token API.
 if u is not null and not exists(select 1 from auth.users where id=u) then raise sqlstate 'PT401' using message='삭제되었거나 만료된 계정입니다. 다시 로그인해주세요.';end if;
 return public.wakppu_api_before_guest_exit(b);
end $api$;
revoke all on function public.wakppu_api(jsonb) from public,anon,authenticated;
grant execute on function public.wakppu_api(jsonb) to anon,authenticated;
commit;
