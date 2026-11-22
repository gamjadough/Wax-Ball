-- Friends project only. The password is configured separately, never in Git.
begin;
create table public.wakppu_friend_gate_config(id boolean primary key default true check(id),enabled boolean not null default false,password_hash text);
insert into public.wakppu_friend_gate_config(id) values(true);
create table public.wakppu_friend_gate_sessions(token_hash text primary key,expires_at timestamptz not null);
create index wakppu_friend_gate_expiry on public.wakppu_friend_gate_sessions(expires_at);
create table public.wakppu_friend_gate_attempts(client_hash text primary key,started_at timestamptz not null,failures integer not null default 0);
alter table public.wakppu_friend_gate_config enable row level security;
alter table public.wakppu_friend_gate_sessions enable row level security;
alter table public.wakppu_friend_gate_attempts enable row level security;
revoke all on public.wakppu_friend_gate_config,public.wakppu_friend_gate_sessions,public.wakppu_friend_gate_attempts from public,anon,authenticated;
create or replace function public.wakppu_friend_gate_allowed() returns boolean language sql stable security definer set search_path=public,extensions,pg_temp as $$
 select exists(select 1 from public.wakppu_friend_gate_config c where c.id and not c.enabled)
 or exists(select 1 from public.wakppu_friend_gate_sessions s where s.expires_at>statement_timestamp()
 and s.token_hash=encode(extensions.digest(coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-wakppu-access',''),'sha256'),'hex'))
$$;
create or replace function public.wakppu_friend_access(b jsonb) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare c public.wakppu_friend_gate_config;headers jsonb:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;key text;t text;attempt public.wakppu_friend_gate_attempts;
begin
 select * into c from public.wakppu_friend_gate_config where id;
 if b->>'mode'='check' then return jsonb_build_object('allowed',public.wakppu_friend_gate_allowed());end if;
 if b->>'mode' is distinct from 'unlock' then raise sqlstate 'PT400';end if;
 if not c.enabled then return '{"allowed":true}'::jsonb;end if;
 key:=encode(extensions.digest(coalesce(headers->>'x-forwarded-for',headers->>'x-real-ip','unknown'),'sha256'),'hex');
 insert into public.wakppu_friend_gate_attempts(client_hash,started_at) values(key,clock_timestamp()) on conflict do nothing;
 select * into attempt from public.wakppu_friend_gate_attempts where client_hash=key for update;
 if attempt.started_at<clock_timestamp()-interval '1 minute' then
  update public.wakppu_friend_gate_attempts set started_at=clock_timestamp(),failures=0 where client_hash=key;attempt.failures:=0;
 end if;
 if attempt.failures>=8 then return jsonb_build_object('allowed',false,'error','입력 횟수가 많습니다. 1분 후 다시 시도해주세요.');end if;
 if coalesce(length(b->>'password'),0) not between 1 and 200 or c.password_hash is null or extensions.crypt(b->>'password',c.password_hash) is distinct from c.password_hash then
  update public.wakppu_friend_gate_attempts set failures=failures+1 where client_hash=key;
  return '{"allowed":false,"error":"암호가 맞지 않습니다."}'::jsonb;
 end if;
 t:=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.wakppu_friend_gate_sessions values(encode(extensions.digest(t,'sha256'),'hex'),clock_timestamp()+interval '6 hours');
 delete from public.wakppu_friend_gate_sessions where expires_at<=clock_timestamp();
 delete from public.wakppu_friend_gate_attempts where started_at<clock_timestamp()-interval '1 day';
 return jsonb_build_object('allowed',true,'token',t);
end$$;
alter function public.wakppu_api(jsonb) rename to wakppu_api_before_friend_gate;
create function public.wakppu_api(b jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.wakppu_friend_gate_allowed() then raise sqlstate 'PT403' using message='친구 서버 입장 암호를 입력해주세요.',hint='FRIEND_GATE_REQUIRED';end if;
 return public.wakppu_api_before_friend_gate(b);
end$$;
revoke all on function public.wakppu_api_before_friend_gate(jsonb) from public,anon,authenticated;
revoke all on function public.wakppu_friend_gate_allowed(),public.wakppu_friend_access(jsonb),public.wakppu_api(jsonb) from public,anon,authenticated;
grant execute on function public.wakppu_friend_gate_allowed(),public.wakppu_friend_access(jsonb),public.wakppu_api(jsonb) to anon,authenticated,service_role;
create policy wakppu_friend_profile_gate on public.players as restrictive for all to anon,authenticated using(public.wakppu_friend_gate_allowed()) with check(public.wakppu_friend_gate_allowed());
create policy wakppu_friend_progress_gate on public.game_states as restrictive for all to anon,authenticated using(public.wakppu_friend_gate_allowed()) with check(public.wakppu_friend_gate_allowed());
commit;
