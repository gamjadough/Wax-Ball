-- Local review first. Update only core validation, preserving all newer wrappers.
begin;
alter table public.game_states drop constraint if exists game_states_rebirths_check;
alter table public.game_states add constraint game_states_rebirths_check check (rebirths between 0 and 500);
alter table public.game_states drop constraint if exists game_states_gold_check;
alter table public.game_states add constraint game_states_gold_check
 check (gold>=0 and gold=trunc(gold) and gold<power(10::numeric,1000));
do $migration$
declare source text; updated text;
begin
 source:=pg_get_functiondef('public.wakppu_api_before_events(jsonb)'::regprocedure);
 if position('length(coalesce(b->>''gold'',''''))>1000' in source)=0 then
  -- PostgreSQL bounds regex repetition at 255. Validate digits and length separately.
  updated:=replace(source,'coalesce(b->>''gold'','''') !~ ''^[0-9]{1,100}$''',
   '(coalesce(b->>''gold'','''') !~ ''^[0-9]+$'' or length(coalesce(b->>''gold'',''''))>1000)');
  if updated=source then raise exception 'Unexpected Gold validation; migration aborted'; end if;
  source:=updated;
  updated:=replace(source,'coalesce(b->>''value'','''') !~ ''^[0-9]{1,100}$''',
   '(coalesce(b->>''value'','''') !~ ''^[0-9]+$'' or length(coalesce(b->>''value'',''''))>1000)');
  if updated=source then raise exception 'Unexpected administrator Gold validation; migration aborted'; end if;
  source:=updated;
  updated:=replace(source,'not between 0 and 100','not between 0 and 500');
  if updated=source then raise exception 'Unexpected rebirth validation; migration aborted'; end if;
  source:=updated;
  updated:=regexp_replace(source,
   'val>\(case when a=''admin_gold'' then .+? else 100 end\)',
   'val>(case when a=''admin_gold'' then power(10::numeric,1000)-1 else 500 end)');
  if updated=source then raise exception 'Unexpected administrator limits; migration aborted'; end if;
  execute updated;
 end if;
end $migration$;
commit;
