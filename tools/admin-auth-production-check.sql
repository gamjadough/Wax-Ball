-- Read-only validation after importing a password-based game administrator.
-- SQL RPC tests do not exercise GoTrue's Auth row scanner. Missing timestamps
-- can break /auth/v1/token even when direct SQL role checks succeed.
do $check$
begin
 if not exists(select 1 from public.players where role='admin') then
  raise exception 'Administrator account is missing';
 end if;
 if exists(select 1 from public.players p join auth.users u on u.id=p.user_id
  where p.role='admin' and (u.created_at is null or u.updated_at is null
   or u.is_anonymous or u.email_confirmed_at is null or coalesce(u.encrypted_password,'')='')) then
  raise exception 'Imported administrator Auth metadata is incomplete';
 end if;
 if exists(select 1 from public.players p join auth.users u on u.id=p.user_id
  where p.role='admin' and not exists(select 1 from auth.identities i
   where i.user_id=u.id and i.provider='email' and i.created_at is not null and i.updated_at is not null)) then
  raise exception 'Imported email identity is incomplete';
 end if;
end $check$;
select true as administrator_auth_metadata_complete;
