-- Server-only entitlement check. The remainder is hundredths of one Gold.
begin;
alter table public.game_states add column if not exists supporter_gold_remainder smallint not null default 0 check(supporter_gold_remainder between 0 and 99);
update public.wakppu_purchase_products set description='후원자 칭호·전용 테두리 + 영구 파괴 골드 보너스 5% · 기존 배율 계산 후 적용 · 1G 미만 누적' where id='supporter_pack';
create or replace function public.wakppu_supporter_reward(u uuid,base numeric) returns numeric
language plpgsql set search_path=public,pg_temp as $$
declare carry integer;parts numeric;extra numeric;
begin
 if u is null or u is distinct from auth.uid() then raise sqlstate 'PT403';end if;
 if base<0 or base<>trunc(base) then raise sqlstate 'PT400';end if;
 if base=0 or not exists(select 1 from public.wakppu_purchase_entitlements where user_id=u and product_id='supporter_pack') then return base;end if;
 select supporter_gold_remainder into carry from public.game_states where user_id=u for update;
 if not found then raise sqlstate 'PT404';end if;
 parts:=base*5+carry;extra:=floor(parts/100);
 update public.game_states set supporter_gold_remainder=mod(parts,100)::integer where user_id=u;
 return base+extra;
end $$;
revoke all on function public.wakppu_supporter_reward(uuid,numeric) from public,anon,authenticated;
commit;
