begin;
alter table public.wakppu_halloween_cosmetics add column ember_last_hit_at timestamptz;
create table public.wakppu_ember_hit_requests(
 user_id uuid not null references public.players(user_id) on delete cascade,
 request_id uuid not null,fingerprint jsonb not null,response jsonb not null,
 created_at timestamptz not null default clock_timestamp(),primary key(user_id,request_id)
);
alter table public.wakppu_ember_hit_requests enable row level security;
revoke all on public.wakppu_ember_hit_requests from public,anon,authenticated;

-- Replace the old animation trait and keep ghost/bat values intact.
do $patch$
declare f record;body text;changed text;traits integer:=0;guards integer:=0;
begin
 for f in select p.oid,p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and ((p.prosrc like '%pet_timing%' and p.prosrc like '%animation%case when pet=%') or p.prosrc like '%g.hits||array[instant]%') loop
  body:=pg_get_functiondef(f.oid);
  if f.prosrc like '%pet_timing%' and f.prosrc like '%animation%case when pet=%' then
   changed:=replace(body,'case when pet=''pumpkin_ember'' then 0.9 else 1 end','1');
   if changed=body then raise exception 'Unexpected pet timing handler';end if;
   execute changed;traits:=traits+1;
  end if;
  if f.prosrc like '%g.hits||array[instant]%' then
   changed:=replace(body,'g.hits||array[instant]',
    'g.hits||case when b->>''hit_source''=''ember_auto'' then ''{}''::timestamptz[] else array[instant] end');
   execute changed;guards:=guards+1;
  end if;
 end loop;
 if traits<>1 or guards<>1 then raise exception 'Expected one pet timing and input guard handler: %, %',traits,guards;end if;
end $patch$;

create or replace function public.wakppu_halloween_cosmetic_snapshot(u uuid) returns jsonb language sql stable set search_path=public,pg_temp as $$
 select public.wakppu_halloween_cosmetic_snapshot_before_pets(u)||jsonb_build_object('pet_version',2,'ember_interval_ms',1000,'catalog',jsonb_build_array(
 jsonb_build_object('id','little_ghost','name','길 잃은 꼬마 유령','kind','equip','weight',1,'effect','골드 +10%'),
 jsonb_build_object('id','pumpkin_ember','name','잭오랜턴의 불씨','kind','equip','weight',1,'effect','1초마다 자동 공격'),
 jsonb_build_object('id','bat_swarm','name','꼬마 박쥐','kind','equip','weight',1,'effect','재생성 대기 시간 10% 단축')));
$$;
revoke all on function public.wakppu_halloween_cosmetic_snapshot(uuid) from public,anon,authenticated;

alter function public.wakppu_api(jsonb) rename to wakppu_api_before_ember_auto;
revoke all on function public.wakppu_api_before_ember_auto(jsonb) from public,anon,authenticated;
create function public.wakppu_api(b jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $api$
declare u uuid:=auth.uid();rid uuid;target text:=b->>'hit_action';instant timestamptz;last_at timestamptz;cached public.wakppu_ember_hit_requests%rowtype;r jsonb;fp jsonb:=b-'request_id';
begin
 -- Only this validated action can mark a hit as an authorized pet attack.
 if b->>'action' is distinct from 'ember_auto_hit' then return public.wakppu_api_before_ember_auto(b-'hit_source');end if;
 perform public.wakppu_api_before_ember_auto('{"action":"bootstrap"}');
 if u is null then raise sqlstate 'PT401';end if;
 if target is null or target not in ('item_hit','limited_hit') or b ?| array['user_id','target_user_id'] or coalesce(b->>'request_id','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then raise sqlstate 'PT400';end if;
 rid:=(b->>'request_id')::uuid;
 -- Match the existing hit lock order; concurrent windows share the same cooldown.
 perform 1 from public.game_states where user_id=u for update;
 if public.wakppu_equipped_pet(u) is distinct from 'pumpkin_ember' then raise sqlstate 'PT403' using message='잭오랜턴 불씨를 장착해야 자동 공격할 수 있습니다.';end if;
 select * into cached from public.wakppu_ember_hit_requests where user_id=u and request_id=rid;
 if found then
  if cached.fingerprint<>fp then raise sqlstate 'PT409' using message='다른 자동 공격에 사용한 요청입니다.';end if;
  return cached.response;
 end if;
 instant:=clock_timestamp();select ember_last_hit_at into last_at from public.wakppu_halloween_cosmetics where user_id=u;
 if last_at is not null and instant<last_at+interval '1 second' then raise sqlstate 'PT429' using message='불씨는 1초마다 한 번 공격할 수 있습니다.';end if;
 r:=public.wakppu_api_before_ember_auto((b-'hit_action')||jsonb_build_object('action',target,'hit_source','ember_auto'));
 update public.wakppu_halloween_cosmetics set ember_last_hit_at=instant where user_id=u;
 insert into public.wakppu_ember_hit_requests(user_id,request_id,fingerprint,response) values(u,rid,fp,r);
 delete from public.wakppu_ember_hit_requests where user_id=u and request_id in
  (select request_id from public.wakppu_ember_hit_requests where user_id=u order by created_at desc,request_id desc offset 64);
 return r;
end $api$;
revoke all on function public.wakppu_api(jsonb) from public;
grant execute on function public.wakppu_api(jsonb) to anon,authenticated;
commit;
