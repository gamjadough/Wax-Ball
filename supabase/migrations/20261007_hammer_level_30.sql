-- Extend only hammer validation and damage; preserve all active API wrappers.
begin;
alter table public.game_states drop constraint if exists game_states_hammer_level_check;
alter table public.game_states add constraint game_states_hammer_level_check check(hammer_level between 0 and 30);
create or replace function public.wakppu_hammer_damage(owned boolean,level integer) returns integer
language plpgsql immutable set search_path=public,pg_temp as $$
declare damage integer; i integer;
begin
 if not coalesce(owned,false) or level is null or level not between 1 and 30 then return 1; end if;
 if level<=10 then return (array[3,5,8,12,18,27,40,60,90,135])[level]; end if;
 damage:=135;
 for i in 11..level loop damage:=ceil(damage::numeric*1.5)::integer; end loop;
 return damage;
end $$;
revoke all on function public.wakppu_hammer_damage(boolean,integer) from public,anon,authenticated;
do $migration$
declare source text; updated text; candidate record;
 old_validation text:='coalesce((b->>''hammer_level'')::integer,0) not between 0 and 10';
 new_validation text:='coalesce((b->>''hammer_level'')::integer,0) not between 0 and 30';
 old_damage text:='case when s.hammer_owned and s.hammer_level between 1 and 10 then (array[3,5,8,12,18,27,40,60,90,135])[s.hammer_level] else 1 end';
begin
 if to_regprocedure('public.wakppu_api_before_events(jsonb)') is null then raise exception 'Existing base API is required'; end if;
 select pg_get_functiondef('public.wakppu_api_before_events(jsonb)'::regprocedure) into source;
 updated:=replace(source,old_validation,new_validation);
 if updated=source and strpos(source,new_validation)=0 then raise exception 'Unexpected hammer validation; upgrade aborted'; end if;
 if updated<>source then execute updated; end if;
 for candidate in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname like 'wakppu_api%' and p.prokind='f' loop
  select pg_get_functiondef(candidate.oid) into source;
  updated:=replace(source,old_damage,'public.wakppu_hammer_damage(s.hammer_owned,s.hammer_level)');
  if updated<>source then execute updated; end if;
 end loop;
end $migration$;
commit;
