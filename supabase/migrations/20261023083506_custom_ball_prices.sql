-- New orders only: never rewrite stored receipts, entitlements or cosmetic profiles.
begin;
update public.wakppu_purchase_products set amount=9900 where id='custom_ball_single';
update public.wakppu_purchase_products set amount=29000,description='보유한 모든 볼·추후 해금 볼에 적용 · 볼별 저장·전체 공통 적용 · 단일 상품 보유 시 차액 19,100원' where id='custom_ball_all';
do $patch$
declare f record;body text;updated text;matched integer:=0;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosrc like '%custom_upgrade_order_id%' and p.prosrc like '%price:=p.amount%' and p.prosrc like '%if a=''purchase_catalog''%' loop
  body:=pg_get_functiondef(f.oid);updated:=body;
  if position('price:=20000;' in body)>0 and position('"amount":20000' in body)>0 then
   updated:=replace(updated,'price:=20000;','price:=19100;');
   updated:=replace(updated,'"amount":20000','"amount":19100');
   execute updated;
  elsif position('price:=19100;' in body)=0 or position('"amount":19100' in body)=0 then
   raise exception 'Unexpected custom price wrapper; refusing partial patch';
  end if;
  matched:=matched+1;
 end loop;
 if matched<>1 then raise exception 'Expected one custom price wrapper, found %',matched;end if;
 if (select count(*) from public.wakppu_purchase_products where (id='custom_ball_single' and amount=9900) or (id='custom_ball_all' and amount=29000))<>2 then raise exception 'Custom product price update failed';end if;
end $patch$;
commit;
