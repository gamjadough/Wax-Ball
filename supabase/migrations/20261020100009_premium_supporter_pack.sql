-- Bank verification stays manual. Price and upgrade eligibility are server-owned.
begin;
insert into public.wakppu_purchase_products values('premium_supporter_pack','프리미엄 후원팩',10000,
 '영구 파괴 골드 +30% · 금빛 랭킹 디자인·전용 칭호·프로필 배지 · 기존 응원팩 보유 시 8,900원 업그레이드 · 응원팩 +5%와 합산하지 않음') on conflict(id) do update set name=excluded.name,amount=excluded.amount,description=excluded.description;
update public.wakppu_purchase_products set amount=500 where id='starlight_skin';
alter table public.wakppu_purchase_orders add column if not exists supporter_upgrade_order_id uuid references public.wakppu_purchase_orders(id);
create index if not exists wakppu_upgrade_source_idx on public.wakppu_purchase_orders(supporter_upgrade_order_id) where supporter_upgrade_order_id is not null;
alter table public.wakppu_purchase_cosmetics add column if not exists title_visible boolean not null default true;
create or replace function public.wakppu_supporter_percent(u uuid) returns integer language sql stable set search_path=public,pg_temp as $$
 select coalesce(max(case product_id when 'premium_supporter_pack' then 30 when 'supporter_pack' then 5 end),0) from public.wakppu_purchase_entitlements where user_id=u and product_id in ('supporter_pack','premium_supporter_pack');
$$;
revoke all on function public.wakppu_supporter_percent(uuid) from public,anon,authenticated;
create or replace function public.wakppu_supporter_reward(u uuid,base numeric) returns numeric
language plpgsql set search_path=public,pg_temp as $$
declare carry integer;parts numeric;extra numeric;bonus integer;
begin
 if u is null or u is distinct from auth.uid() then raise sqlstate 'PT403';end if;
 if base<0 or base<>trunc(base) then raise sqlstate 'PT400';end if;
 bonus:=public.wakppu_supporter_percent(u);if base=0 or bonus=0 then return base;end if;
 select supporter_gold_remainder into carry from public.game_states where user_id=u for update;
 if not found then raise sqlstate 'PT404';end if;
 parts:=base*bonus+carry;extra:=floor(parts/100);
 update public.game_states set supporter_gold_remainder=mod(parts,100)::integer where user_id=u;
 return base+extra;
end $$;
revoke all on function public.wakppu_supporter_reward(uuid,numeric) from public,anon,authenticated;
do $patch$
declare f record;body text;updated text;matched integer:=0;
begin
 body:=pg_get_functiondef('public.wakppu_purchase_snapshot(uuid)'::regprocedure);
 if position('''supporter_percent''' in body)=0 then
  updated:=replace(body,'''eligible'',coalesce(ready,false)',
   '''title_visible'',coalesce((select title_visible from public.wakppu_purchase_cosmetics where user_id=u),true),''supporter_percent'',public.wakppu_supporter_percent(u),''eligible'',coalesce(ready,false)');
  updated:=replace(updated,'to_jsonb(p) order by amount',
   'to_jsonb(p)||jsonb_build_object(''regular_amount'',p.amount,''amount'',case when p.id=''premium_supporter_pack'' and exists(select 1 from public.wakppu_purchase_entitlements where user_id=u and product_id=''supporter_pack'') then 8900 else p.amount end) order by amount');
  if updated=body or position('regular_amount' in updated)=0 then raise exception 'Expected purchase catalog';end if;execute updated;
 end if;
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosrc like '%insert into public.wakppu_purchase_entitlements%' loop
  body:=pg_get_functiondef(f.oid);updated:=body;
  if position('premium_upgrade_guard' in body)=0 then
   updated:=replace(updated,'''purchase_equip'',''admin_purchase_config''','''purchase_equip'',''purchase_title'',''admin_purchase_config''');
   updated:=replace(updated,'if b?''amount''',
    '-- premium_upgrade_guard: server-priced discount with an immutable source order.
  if p.id=''premium_supporter_pack'' and exists(select 1 from public.wakppu_purchase_entitlements where user_id=u and product_id=''supporter_pack'') then p.amount:=8900;end if;
  if p.id=''supporter_pack'' and exists(select 1 from public.wakppu_purchase_entitlements where user_id=u and product_id=''premium_supporter_pack'') then raise sqlstate ''PT409'' using message=''프리미엄 후원팩에 응원팩 혜택이 포함되어 있습니다.'';end if;
  if b?''amount''');
   updated:=replace(updated,'amount,depositor,bank) values(u,rid,p.id,p.name,p.amount,trim(b->>''depositor''),to_jsonb(c)-''id''-''revision''-''enabled'')',
    'amount,depositor,bank,supporter_upgrade_order_id) values(u,rid,p.id,p.name,p.amount,trim(b->>''depositor''),to_jsonb(c)-''id''-''revision''-''enabled'',case when p.id=''premium_supporter_pack'' and p.amount=8900 then (select order_id from public.wakppu_purchase_entitlements where user_id=u and product_id=''supporter_pack'') else null end)');
   updated:=replace(updated,'if a=''purchase_equip'' then',
    'if a=''purchase_title'' then
  perform pg_advisory_xact_lock(hashtextextended(u::text,19));
  if jsonb_typeof(b->''visible'') is distinct from ''boolean'' then raise sqlstate ''PT400'';end if;
  if public.wakppu_supporter_percent(u)<>30 then raise sqlstate ''PT403'';end if;
  insert into public.wakppu_purchase_cosmetics(user_id,title_visible) values(u,(b->>''visible'')::boolean) on conflict(user_id) do update set title_visible=excluded.title_visible;
  return public.wakppu_purchase_snapshot(u);
 end if;
 if a=''purchase_equip'' then');
   updated:=replace(updated,'insert into public.wakppu_purchase_cosmetics values','insert into public.wakppu_purchase_cosmetics(user_id,equipped) values');
   updated:=replace(updated,'update public.wakppu_purchase_orders set status=''approved''',
    'if o.product_id=''premium_supporter_pack'' and o.amount=8900 and not exists(select 1 from public.wakppu_purchase_entitlements where user_id=o.user_id and product_id=''supporter_pack'' and order_id=o.supporter_upgrade_order_id) then raise sqlstate ''PT409'' using message=''업그레이드 대상 응원팩 보유 상태가 변경되었습니다. 지급 전 주문을 확인하세요.'';end if;
  if o.product_id=''supporter_pack'' and exists(select 1 from public.wakppu_purchase_entitlements where user_id=o.user_id and product_id=''premium_supporter_pack'') then raise sqlstate ''PT409'' using message=''이미 프리미엄 혜택을 보유하고 있습니다. 입금 내역을 확인하세요.'';end if;
  update public.wakppu_purchase_orders set status=''approved''');
   updated:=replace(updated,'update public.wakppu_purchase_orders set status=''refunded''',
    'if exists(select 1 from public.wakppu_purchase_entitlements e join public.wakppu_purchase_orders q on q.id=e.order_id where e.user_id=o.user_id and e.product_id=''premium_supporter_pack'' and q.supporter_upgrade_order_id=o.id) then raise sqlstate ''PT409'' using message=''이 응원팩으로 업그레이드한 프리미엄 후원팩을 먼저 환불 처리하세요.'';end if;
  update public.wakppu_purchase_orders set status=''refunded''');
   updated:=replace(updated,'jsonb_agg(to_jsonb(t) order by created_at desc)',
    'jsonb_agg(to_jsonb(t)||jsonb_build_object(''supporter_refund_blocked'',exists(select 1 from public.wakppu_purchase_entitlements e join public.wakppu_purchase_orders q on q.id=e.order_id where e.product_id=''premium_supporter_pack'' and q.supporter_upgrade_order_id=t.id)) order by created_at desc)');
   updated:=replace(updated,'and e.product_id=''supporter_pack'')) order by ord)',
    'and e.product_id in (''supporter_pack'',''premium_supporter_pack'')),''premium_supporter'',exists(select 1 from public.players pl join public.wakppu_purchase_entitlements e on e.user_id=pl.user_id where pl.nickname=row->>''nickname'' and e.product_id=''premium_supporter_pack''),''supporter_title_visible'',coalesce((select pc.title_visible from public.players pl join public.wakppu_purchase_cosmetics pc on pc.user_id=pl.user_id where pl.nickname=row->>''nickname''),true)) order by ord)');
   if updated=body or position('supporter_upgrade_order_id) values' in updated)=0 or position('premium_supporter'',exists' in updated)=0 or position('supporter_refund_blocked' in updated)=0 then raise exception 'Expected purchase wrapper';end if;
   execute updated;
  end if;
  matched:=matched+1;
 end loop;
 if matched<>1 then raise exception 'Expected one purchase wrapper, found %',matched;end if;
end $patch$;
commit;
