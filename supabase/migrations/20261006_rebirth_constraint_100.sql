-- API validation and the table constraint must agree on the 100-rebirth limit.
begin;
alter table public.game_states drop constraint if exists game_states_rebirths_check;
alter table public.game_states add constraint game_states_rebirths_check
 check (rebirths between 0 and 100);
commit;
