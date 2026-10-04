-- 기존 플레이어 진행도는 건드리지 않고, 계정 동기화에 필요한 칼럼만 추가합니다.
alter table public.game_states add column if not exists hammer_owned boolean not null default false;
alter table public.game_states add column if not exists hammer_level integer not null default 0;
alter table public.game_states add column if not exists progress_imported_at timestamptz;
create index if not exists game_states_rankings_idx on public.game_states (rebirths desc, gold desc);
