begin;
alter table public.wakppu_gem_ball_defs add column unlock_order smallint not null default 1,
 add column requires_ball_id text references public.wakppu_gem_ball_defs(ball_id);
update public.wakppu_gem_ball_defs set unlock_order=1 where ball_id='blue-crystal-wax';
insert into public.wakppu_gem_ball_defs(ball_id,name,price,clicks,gem_reward,unlock_order,requires_ball_id) values
 ('deepsea-crystal-wax','심해 수정 왁뿌볼',25000,150,8,2,'blue-crystal-wax'),
 ('aurora-crystal-wax','오로라 수정 왁뿌볼',100000,200,12,3,'deepsea-crystal-wax'),
 ('stellar-crystal-core','별의 결정핵 왁뿌볼',500000,300,20,4,'aurora-crystal-wax');
insert into public.wakppu_blue_gem_exclusions select ball_id from public.wakppu_gem_ball_defs on conflict do nothing;
create or replace function public.wakppu_gem_ball_snapshot(u uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $s$
declare p public.wakppu_gem_ball_players%rowtype;access boolean;
begin
 if u is null or u is distinct from auth.uid() then raise sqlstate 'PT403';end if;
 access:=public.wakppu_admin_content_access();select * into p from public.wakppu_gem_ball_players where user_id=u;
 return jsonb_build_object('owned',coalesce(p.owned,'[]'),'selected',case when access or p.owned ? p.selected then p.selected end,
  'clicks',coalesce(p.clicks,0),'admin_access',access,
  'catalog',(select jsonb_agg(jsonb_build_object('id',ball_id,'name',name,'price',price::text,'clicks',clicks,'gem_reward',gem_reward::text,
    'unlock_order',unlock_order,'requires_ball_id',requires_ball_id) order by unlock_order,ball_id) from public.wakppu_gem_ball_defs));
end $s$;
revoke all on function public.wakppu_gem_ball_snapshot(uuid) from public,anon,authenticated;
-- Patch the existing guarded, transactional handler without adding an API wrapper.
do $patch$
declare f record;body text;anchor text:='if a=''gem_ball_buy'' then';patched integer:=0;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosrc like '%if a=''gem_ball_buy'' then%' and p.prosrc like '%wakppu_gem_ball_requests%' loop
  body:=pg_get_functiondef(f.oid);
  if position('d.requires_ball_id' in body)>0 then raise exception 'Gem catalog prerequisite already patched';end if;
  body:=replace(body,anchor,anchor||$guard$
   if d.requires_ball_id is not null and not (p.owned ? d.requires_ball_id) and not public.wakppu_admin_content_access() then
    raise sqlstate 'PT403' using message='이전 푸른젬 볼을 먼저 해금해주세요.';
   end if;$guard$);
  execute body;patched:=patched+1;
 end loop;
 if patched<>1 then raise exception 'Expected one gem transaction handler, found %',patched;end if;
end $patch$;
commit;
