begin;
alter table public.wakppu_limited_players add column if not exists scare_disabled boolean not null default false;
do $patch$ declare f record;body text;updated text;matched integer:=0;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosrc like '%a not in (''pumpkin_skins'',%' loop
  body:=pg_get_functiondef(f.oid);updated:=body;
  if position('pumpkin_scare_disable_buy' in body)=0 then
   updated:=replace(updated,'''pumpkin_skins'',''pumpkin_skin_exchange'',''pumpkin_skin_equip''','''pumpkin_skins'',''pumpkin_skin_exchange'',''pumpkin_skin_equip'',''pumpkin_scare_disable_buy''');
   updated:=replace(updated,'if a=''pumpkin_skin_exchange'' then','if a=''pumpkin_scare_disable_buy'' then
    if not active then raise sqlstate ''PT409'' using message=''할로윈 이벤트 기간이 아닙니다.'';end if;
    if l.scare_disabled then raise sqlstate ''PT409'' using message=''이미 영구 해제를 구매했습니다.'';end if;
    if l.tokens<100 then raise sqlstate ''PT409'' using message=''할로윈 사탕이 부족합니다.'';end if;
    l.tokens:=l.tokens-100;l.scare_disabled:=true;
    update public.wakppu_limited_players set tokens=l.tokens,scare_disabled=true where user_id=u;
   elsif a=''pumpkin_skin_exchange'' then');
   updated:=replace(updated,'jsonb_build_object(''catalog'',catalog','jsonb_build_object(''scare_disabled'',l.scare_disabled,''scare_disable_cost'',''100'',''catalog'',catalog');
   if updated=body or position('l.scare_disabled:=true' in updated)=0 then raise exception 'Expected pumpkin skin purchase handler';end if;execute updated;
  end if;matched:=matched+1;
 end loop;
 if matched<>1 then raise exception 'Expected one pumpkin purchase handler';end if;
end $patch$;
commit;
