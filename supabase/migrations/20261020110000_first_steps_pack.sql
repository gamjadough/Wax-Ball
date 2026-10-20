begin;
insert into public.wakppu_purchase_products values('first_steps_pack','첫걸음 성장팩',1100,
 '계정당 1회 · 3,000G + 고급 꿀병 2개(개당 Gold ×1.5·10분), 재생 촉진제 3개(개당 재등장 대기 약 33% 감소·2분), 가벼운 왁스 깃털 2개(개당 파괴 모션 ×1.25·5분) · 아이템은 인벤토리에 지급, 직접 사용 · 사용 후 로그아웃 중에도 시간 경과') on conflict(id) do update set name=excluded.name,amount=excluded.amount,description=excluded.description;
create table if not exists public.wakppu_first_steps_grants(
 user_id uuid primary key references public.players(user_id),order_id uuid not null unique references public.wakppu_purchase_orders(id),
 gold numeric not null default 3000 check(gold=3000),items jsonb not null default '{"rare_honey":2,"rare_crack_booster":3,"common_wax_feather":2}',
 revision bigint not null,granted_at timestamptz not null default clock_timestamp(),reclaimed_at timestamptz);
alter table public.wakppu_first_steps_grants enable row level security;
revoke all on public.wakppu_first_steps_grants from public,anon,authenticated;
create or replace function public.wakppu_first_steps_refundable(u uuid) returns boolean language sql stable set search_path=public,pg_temp as $$
 select exists(select 1 from public.wakppu_first_steps_grants r join public.game_states g using(user_id) join public.wakppu_items i using(user_id)
 where r.user_id=u and r.reclaimed_at is null and g.gold>=r.gold
 and not exists(select 1 from jsonb_each_text(r.items) x where coalesce((i.inventory->>x.key)::bigint,0)<x.value::bigint));
$$;
revoke all on function public.wakppu_first_steps_refundable(uuid) from public,anon,authenticated;
create or replace function public.wakppu_first_steps_delivery() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare who uuid;balance numeric;rev bigint;stock jsonb;contents jsonb:='{"rare_honey":2,"rare_crack_booster":3,"common_wax_feather":2}';x record;receipt public.wakppu_first_steps_grants;delta integer;
begin
 if (case when tg_op='INSERT' then new.product_id else old.product_id end)<>'first_steps_pack' then
  if tg_op='INSERT' then return new;else return old;end if;
 end if;
 who:=case when tg_op='INSERT' then new.user_id else old.user_id end;
 select gold,item_revision into balance,rev from public.game_states where user_id=who for update;
 if not found then raise sqlstate 'PT404' using message='게임 계정이 없습니다.';end if;
 insert into public.wakppu_items(user_id) values(who) on conflict do nothing;
 select inventory into stock from public.wakppu_items where user_id=who for update;
 if tg_op='INSERT' then
  if exists(select 1 from public.wakppu_first_steps_grants where user_id=who) then raise sqlstate 'PT409' using message='첫걸음 성장팩은 계정당 한 번만 구매할 수 있습니다.';end if;
  if not exists(select 1 from public.wakppu_purchase_orders where id=new.order_id and user_id=who and product_id='first_steps_pack' and status='approved') then raise sqlstate 'PT409';end if;
  delta:=1;
 else
  select * into receipt from public.wakppu_first_steps_grants where user_id=who and order_id=old.order_id for update;
  if not found or receipt.reclaimed_at is not null then raise sqlstate 'PT409';end if;
  if not public.wakppu_first_steps_refundable(who) then raise sqlstate 'PT409' using message='지급한 골드 또는 아이템이 부족하여 자동 회수할 수 없습니다. 사용 내역을 확인하세요.';end if;
  delta:=-1;
 end if;
 for x in select key,value from jsonb_each_text(contents) loop
  stock:=jsonb_set(stock,array[x.key],to_jsonb(coalesce((stock->>x.key)::bigint,0)+delta*x.value::bigint));
 end loop;
 update public.wakppu_items set inventory=stock where user_id=who;
 update public.game_states set gold=gold+delta*3000,item_revision=item_revision+1 where user_id=who returning item_revision into rev;
 if tg_op='INSERT' then
  insert into public.wakppu_first_steps_grants(user_id,order_id,revision) values(who,new.order_id,rev);return new;
 else
  update public.wakppu_first_steps_grants set reclaimed_at=clock_timestamp(),revision=rev where user_id=who;return old;
 end if;
end $$;
revoke all on function public.wakppu_first_steps_delivery() from public,anon,authenticated;
drop trigger if exists wakppu_first_steps_delivery on public.wakppu_purchase_entitlements;
create trigger wakppu_first_steps_delivery before insert or delete on public.wakppu_purchase_entitlements for each row execute function public.wakppu_first_steps_delivery();
do $patch$
declare f record;body text;updated text;matched integer:=0;
begin
 body:=pg_get_functiondef('public.wakppu_purchase_snapshot(uuid)'::regprocedure);
 if position('''starter_grant''' in body)=0 then
  updated:=replace(body,'''eligible'',coalesce(ready,false)',
   '''starter_grant'',(select to_jsonb(r) from public.wakppu_first_steps_grants r where user_id=u),''eligible'',coalesce(ready,false)');
  if updated=body then raise exception 'Expected purchase snapshot';end if;execute updated;
 end if;
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'wakppu_api%' and p.prosrc like '%insert into public.wakppu_purchase_entitlements%' loop
  body:=pg_get_functiondef(f.oid);updated:=body;
  if position('starter_once_guard' in body)=0 then
   updated:=replace(updated,'if b?''amount''',
    '-- starter_once_guard: retain the one-time limit even after refund.
  if p.id=''first_steps_pack'' and exists(select 1 from public.wakppu_first_steps_grants where user_id=u) then raise sqlstate ''PT409'' using message=''첫걸음 성장팩은 계정당 한 번만 구매할 수 있습니다.'';end if;
  if b?''amount''');
   updated:=replace(updated,'ord.*,pl.nickname from','ord.*,pl.nickname,case when ord.product_id=''first_steps_pack'' then public.wakppu_first_steps_refundable(ord.user_id) else null end as starter_refundable from');
   if updated=body or position('starter_refundable' in updated)=0 or position('starter_once_guard' in updated)=0 then raise exception 'Expected purchase wrapper';end if;
   execute updated;
  end if;
  matched:=matched+1;
 end loop;
 if matched<>1 then raise exception 'Expected one purchase wrapper, found %',matched;end if;
end $patch$;
commit;
