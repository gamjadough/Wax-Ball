-- Lv.0 means bare hands. Purchased hammer level remains unchanged.
begin;
alter table public.game_states drop constraint if exists game_states_hammer_selected_level_check;
alter table public.game_states add constraint game_states_hammer_selected_level_check
 check(hammer_selected_level is null or (hammer_owned and hammer_selected_level between 0 and hammer_level));
do $patch$
declare f record; body text; patched integer:=0;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname like 'wakppu_api%' and p.prokind='f' loop
  body:=pg_get_functiondef(f.oid);
  if position('if b->>''action''=''hammer_select'' then' in body)=0 then continue;end if;
  body:=replace(body,'b->>''level'' !~ ''^[1-9][0-9]*$''','b->>''level'' !~ ''^(0|[1-9][0-9]*)$''');
  body:=replace(body,'chosen not between 1 and s.hammer_level','chosen not between 0 and s.hammer_level');
  if position('chosen not between 0 and s.hammer_level' in body)=0 or position('^(0|[1-9][0-9]*)$' in body)=0 then raise exception 'Unexpected hammer selection API';end if;
  execute body;patched:=patched+1;
 end loop;
 if patched<>1 then raise exception 'Expected one hammer selection API, found %',patched;end if;
end $patch$;
commit;
