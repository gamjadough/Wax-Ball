begin;
create function public.wakppu_friend_account_played() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select auth.uid() is not null and exists(select 1 from auth.users u join public.players p on p.user_id=u.id where u.id=auth.uid() and (
 exists(select 1 from public.guest_lifecycle l where l.user_id=u.id and l.first_play_at is not null)
 or exists(select 1 from public.game_states g where g.user_id=u.id and (g.gold>0 or g.rebirths>0 or g.current_clicks>0 or g.item_current_clicks>0))
 or exists(select 1 from public.wakppu_monthly_clicks c where c.user_id=u.id and c.clicks>0)));
$$;
revoke all on function public.wakppu_friend_account_played() from public,anon,authenticated;
create or replace function public.wakppu_friend_gate_allowed() returns boolean language sql stable security definer set search_path=public,extensions,pg_temp as $$
 select public.wakppu_friend_account_played() or exists(select 1 from public.wakppu_friend_gate_config c where c.id and not c.enabled)
 or exists(select 1 from public.wakppu_friend_gate_sessions s where s.expires_at>statement_timestamp()
 and s.token_hash=encode(extensions.digest(coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-wakppu-access',''),'sha256'),'hex'))
$$;
create or replace function public.wakppu_friend_access(b jsonb) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare c public.wakppu_friend_gate_config;headers jsonb:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;key text;t text;attempt public.wakppu_friend_gate_attempts;
begin
 select * into c from public.wakppu_friend_gate_config where id;
 if b->>'mode'='check' then
  if public.wakppu_friend_gate_allowed() and not public.wakppu_friend_account_played() then
   update public.wakppu_friend_gate_sessions set expires_at=clock_timestamp()+interval '365 days'
   where token_hash=encode(extensions.digest(coalesce(headers->>'x-wakppu-access',''),'sha256'),'hex');
   return jsonb_build_object('allowed',true);
  end if;
  if public.wakppu_friend_account_played() then
   t:=encode(extensions.gen_random_bytes(32),'hex');
   insert into public.wakppu_friend_gate_sessions values(encode(extensions.digest(t,'sha256'),'hex'),clock_timestamp()+interval '365 days');
   return jsonb_build_object('allowed',true,'token',t);
  end if;
  return jsonb_build_object('allowed',false);
 end if;
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
 insert into public.wakppu_friend_gate_sessions values(encode(extensions.digest(t,'sha256'),'hex'),clock_timestamp()+interval '365 days');
 delete from public.wakppu_friend_gate_sessions where expires_at<=clock_timestamp();
 delete from public.wakppu_friend_gate_attempts where started_at<clock_timestamp()-interval '1 day';
 return jsonb_build_object('allowed',true,'token',t);
end$$;
commit;
