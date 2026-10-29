-- Match the existing champion card's rendered artwork; future and existing awards.
begin;
do $art$
declare body text;changed text;
begin
 body:=pg_get_functiondef('public.wakppu_monthly_settle()'::regprocedure);
 changed:=replace(replace(replace(body,'monthly-gold.svg','monthly-gold.webp'),'monthly-silver.svg','monthly-silver.webp'),'monthly-bronze.svg','monthly-bronze.webp');
 if changed=body then raise exception 'Expected monthly artwork references';end if;
 execute changed;
end $art$;
update public.wakppu_profile_card_defs set image=replace(image,'.svg','.webp')
 where card_id ~ '^monthly_[0-9]{6}_(gold|silver|bronze)$' and image in ('images/profile-cards/monthly-gold.svg','images/profile-cards/monthly-silver.svg','images/profile-cards/monthly-bronze.svg');
commit;
