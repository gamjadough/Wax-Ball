-- Existing and future buyers use their live entitlements; never duplicate a purchase.
begin;
insert into public.wakppu_profile_card_defs(card_id,name,rarity,free,image) values
 ('supporter_glow','따뜻한 응원','후원자 전용',false,'images/profile-cards/supporter-glow.webp'),
 ('premium_celestial','찬란한 성좌','프리미엄 전용',false,'images/profile-cards/premium-celestial.webp');
update public.wakppu_purchase_products set description='후원자 칭호·전용 테두리 + 영구 파괴 골드 보너스 5% · 전용 프로필 카드 「따뜻한 응원」 포함 · 인벤토리 → 프로필에서 장착 · 기존 구매자도 적용 · 1G 미만 누적' where id='supporter_pack';
update public.wakppu_purchase_products set description='영구 파괴 골드 +30% · 금빛 랭킹 디자인·전용 칭호·프로필 배지 · 전용 프로필 카드 「찬란한 성좌」와 후원자 카드 「따뜻한 응원」 포함 · 기존 구매자도 적용 · 응원팩 보유 시 8,900원 업그레이드 · +5%와 합산하지 않음' where id='premium_supporter_pack';

create function public.wakppu_profile_card_available(u uuid,c text) returns boolean
language sql stable set search_path=public,pg_temp as $owned$
 select exists(select 1 from public.wakppu_profile_card_defs d where d.card_id=c and (
  d.free or
  case when u=auth.uid() then public.wakppu_admin_content_access() else
   exists(select 1 from public.players p join auth.users a on a.id=p.user_id where p.user_id=u and p.role='admin' and not coalesce(a.is_anonymous,false)) end or
  (c not in ('supporter_glow','premium_celestial') and exists(select 1 from public.wakppu_profile_card_grants g where g.user_id=u and g.card_id=c)) or
  (c='supporter_glow' and exists(select 1 from public.wakppu_purchase_entitlements e where e.user_id=u and e.product_id in ('supporter_pack','premium_supporter_pack'))) or
  (c='premium_celestial' and exists(select 1 from public.wakppu_purchase_entitlements e where e.user_id=u and e.product_id='premium_supporter_pack'))
 ));
$owned$;
revoke all on function public.wakppu_profile_card_available(uuid,text) from public,anon,authenticated;

-- Preserve the existing gates, profile whitelist, champion award and title wrappers.
do $patch$
declare f record;body text;patched text;matched integer:=0;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosrc like '%into catalog,owned from wakppu_profile_card_defs%' loop
  body:=replace(pg_get_functiondef(f.oid),chr(13),'');
  patched:=replace(body,'free or admin_access or exists(select 1 from public.wakppu_profile_card_grants cg where cg.user_id=actor and cg.card_id=wakppu_profile_card_defs.card_id)',
   'public.wakppu_profile_card_available(actor,card_id)');
  if patched=body then raise exception 'Unexpected profile ownership implementation';end if;
  body:=patched;
  patched:=replace(body,'where user_id=actor;'||chr(10)||'  if not found then selected:=''wax_beginning'';end if;',
   'where user_id=actor;'||chr(10)||'  if not found then selected:=''wax_beginning'';end if;'||chr(10)||'  if selected is not null and not public.wakppu_profile_card_available(actor,selected) then selected:=''wax_beginning'';end if;');
  if patched=body then raise exception 'Unexpected self selection implementation';end if;
  body:=patched;
  patched:=replace(body,'where user_id=target;'||chr(10)||' if not found then selected:=''wax_beginning'';end if;',
   'where user_id=target;'||chr(10)||' if not found then selected:=''wax_beginning'';end if;'||chr(10)||' if selected is not null and not public.wakppu_profile_card_available(target,selected) then selected:=''wax_beginning'';end if;');
  if patched=body then raise exception 'Unexpected public selection implementation';end if;
  execute patched;matched:=matched+1;
 end loop;
 if matched<>1 then raise exception 'Expected one profile implementation, found %',matched;end if;
end $patch$;

-- Refund/revoke is reflected immediately, including public profiles. Keep valid lower-tier access.
create function public.wakppu_supporter_card_cleanup() returns trigger
language plpgsql set search_path=public,pg_temp as $cleanup$
begin
 if old.product_id in ('supporter_pack','premium_supporter_pack') then
  update public.wakppu_profile_cards set equipped='wax_beginning'
  where user_id=old.user_id and equipped in ('supporter_glow','premium_celestial')
   and not public.wakppu_profile_card_available(user_id,equipped);
 end if;
 return null;
end $cleanup$;
revoke all on function public.wakppu_supporter_card_cleanup() from public,anon,authenticated;
create trigger wakppu_supporter_card_cleanup after delete or update on public.wakppu_purchase_entitlements
 for each row execute function public.wakppu_supporter_card_cleanup();
commit;
