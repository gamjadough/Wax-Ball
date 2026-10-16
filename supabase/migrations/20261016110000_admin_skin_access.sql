-- Virtual catalog access only: never grant permanent ownership or shards to administrators.
begin;
do $patch$
declare body text;
begin
 body:=pg_get_functiondef('public.wakppu_api(jsonb)'::regprocedure);
 if position('admin_skin_catalog' in body)=0 then
  if position('cached public.wakppu_skin_requests%rowtype' in body)=0 then raise exception 'Expected skins API wrapper';end if;
  body:=replace(body,'prior jsonb;result jsonb;','access boolean;admin_skin_catalog jsonb;prior jsonb;result jsonb;');
  body:=replace(body,'select * into g from public.game_states where user_id=u for update;',
   'access:=public.wakppu_admin_content_access();select * into g from public.game_states where user_id=u for update;');
  body:=replace(body,'if not found or not(s.owned?d.skin_id) then',
   'if not found or (not access and not(s.owned?d.skin_id)) then');
  body:=replace(body,'if not(g.unlocked_ball_ids?''eternity'') then',
   'if not access and not(g.unlocked_ball_ids?''eternity'') then');
  body:=replace(body,'''can_equip'',g.unlocked_ball_ids?''eternity''',
   '''can_equip'',access or g.unlocked_ball_ids?''eternity''');
  body:=replace(body,'return cached.response;',
   'return cached.response||jsonb_build_object(''owned'',s.owned||case when access then (select coalesce(jsonb_object_agg(skin_id,true),''{}'') from public.wakppu_skin_defs) else ''{}''::jsonb end,''can_equip'',access or g.unlocked_ball_ids?''eternity'');');
  body:=replace(body,'if a in (''skin_draw'',''skin_exchange'') then result:=',
   'if access then select coalesce(jsonb_object_agg(skin_id,true),''{}'') into admin_skin_catalog from public.wakppu_skin_defs;result:=result||jsonb_build_object(''owned'',s.owned||admin_skin_catalog,''admin_content_access'',true);end if;
 if a in (''skin_draw'',''skin_exchange'') then result:=');
  execute body;
 end if;
end $patch$;
commit;
