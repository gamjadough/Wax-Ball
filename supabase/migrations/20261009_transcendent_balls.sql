-- Local-reviewed expansion. Apply only when releasing the new tiers.
begin;
do $migration$
declare source text; updated text;
begin
 select pg_get_functiondef('public.wakppu_api_before_events(jsonb)'::regprocedure) into source;
 if strpos(source,'''eternity''')=0 then
  updated:=replace(source,'''blackhole'',''whitehole'']','''blackhole'',''whitehole'',''starlight'',''hellfire'',''heaven-cloud'',''hell-ember'',''heaven-gem'',''hell-core'',''judgment'',''heaven-earth'',''soul'',''eternity'']');
  if updated=source then raise exception 'Unexpected ball allowlist'; end if;
  execute updated;
 end if;
end $migration$;
insert into public.wakppu_ball_rewards(ball_id,reward) values
('starlight',20000000),('hellfire',30000000),('heaven-cloud',45000000),('hell-ember',70000000),('heaven-gem',100000000),('hell-core',150000000),('judgment',250000000),('heaven-earth',400000000),('soul',600000000),('eternity',1000000000)
on conflict(ball_id) do update set reward=excluded.reward;
commit;
