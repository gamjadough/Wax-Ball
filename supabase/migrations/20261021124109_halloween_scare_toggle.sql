begin;
alter table public.wakppu_limited_players add column if not exists scare_optout_owned boolean not null default false;
update public.wakppu_limited_players set scare_optout_owned=true where scare_disabled and not scare_optout_owned;
do $patch$ declare f record;body text;updated text;matched integer:=0;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosrc like '%a not in (''pumpkin_skins'',%' loop
  body:=pg_get_functiondef(f.oid);updated:=body;
  if position('pumpkin_scare_disable_equip' in body)=0 then
   updated:=replace(updated,'''pumpkin_scare_disable_buy'')','''pumpkin_scare_disable_buy'',''pumpkin_scare_disable_equip'')');
   updated:=replace(updated,'select * into cached from public.wakppu_skin_requests',
    'if a=''pumpkin_scare_disable_equip'' then fp:=fp||jsonb_build_object(''enabled'',b->''enabled'');end if;
  select * into cached from public.wakppu_skin_requests');
   updated:=replace(updated,'if l.scare_disabled then','if l.scare_optout_owned then');
   updated:=replace(updated,'l.tokens:=l.tokens-100;l.scare_disabled:=true;','l.tokens:=l.tokens-100;l.scare_disabled:=true;l.scare_optout_owned:=true;');
   updated:=replace(updated,'set tokens=l.tokens,scare_disabled=true','set tokens=l.tokens,scare_disabled=true,scare_optout_owned=true');
   updated:=replace(updated,'elsif a=''pumpkin_skin_exchange'' then','elsif a=''pumpkin_scare_disable_equip'' then
    if not l.scare_optout_owned then raise sqlstate ''PT403'' using message=''구매한 점프스케어 해제 상품만 장착할 수 있습니다.'';end if;
    if jsonb_typeof(b->''enabled'') is distinct from ''boolean'' then raise sqlstate ''PT400'';end if;
    l.scare_disabled:=(b->>''enabled'')::boolean;
    update public.wakppu_limited_players set scare_disabled=l.scare_disabled where user_id=u;
   elsif a=''pumpkin_skin_exchange'' then');
   updated:=replace(updated,'''scare_disabled'',l.scare_disabled','''scare_optout_owned'',l.scare_optout_owned,''scare_disabled'',l.scare_disabled');
   if updated=body or position('l.scare_disabled:=(b->>''enabled'')' in updated)=0 then raise exception 'Expected scare optout handler';end if;execute updated;
  end if;matched:=matched+1;
 end loop;
 if matched<>1 then raise exception 'Expected one pumpkin purchase handler';end if;
end $patch$;
commit;
