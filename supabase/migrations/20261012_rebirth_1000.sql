-- Preserve player data and newer API wrappers; widen only numeric limits.
begin;
alter table public.game_states drop constraint if exists game_states_rebirths_check;
alter table public.game_states add constraint game_states_rebirths_check check (rebirths between 0 and 1000);
alter table public.game_states drop constraint if exists game_states_gold_check;
alter table public.game_states add constraint game_states_gold_check
 check (gold>=0 and gold=trunc(gold) and gold<power(10::numeric,4096));
do $migration$
declare source text; updated text;
begin
 source:=pg_get_functiondef('public.wakppu_api_before_events(jsonb)'::regprocedure);
 if position('not between 0 and 1000' in source)=0 then
  updated:=replace(source,'not between 0 and 500','not between 0 and 1000');
  if updated=source then raise exception 'Unexpected rebirth validation'; end if;
  source:=updated;
  updated:=replace(source,'else 500 end','else 1000 end');
  if updated=source then raise exception 'Unexpected admin rebirth validation'; end if;
  source:=updated;
  updated:=replace(source,'>1000)', '>4096)');
  if updated=source then raise exception 'Unexpected Gold length validation'; end if;
  source:=updated;
  updated:=replace(source,'power(10::numeric,1000)', 'power(10::numeric,4096)');
  if updated=source then raise exception 'Unexpected admin Gold limit'; end if;
  execute updated;
 end if;
end $migration$;
commit;
