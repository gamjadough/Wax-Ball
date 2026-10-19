# Friday recurring events (Asia/Seoul)

| Start every Friday | Admin ball | Gold multiplier |
| --- | --- | --- |
| 07:00 | 600 seconds | x10, 600 seconds |
| 21:30 | 900 seconds | x100, 600 seconds |

- `20261020_weekly_events.sql` creates disabled presets. Enable with the authenticated administrator API `admin_weekly_events`, mode `enable`; mode `disable` stops only weekly windows and presets. `list` is read-only.
- The admin panel contains **매주 금요일 반복 이벤트** with enable/disable controls and KST dates.
- A protected server helper prepares the current/next window. Exact timestamps are used by all existing reward APIs; timestamps never shift to the time of login or cron execution.
- pg_cron refreshes windows every minute even with nobody online. Every game API also refreshes before handling a request. SQL helpers and schedule tables cannot be called or edited by players.
- Gold ends at 21:40; admin ball remains through 21:45. Intervals are start-inclusive, end-exclusive. New occurrences get distinct stable IDs, and duplicate refresh/hit requests do not repeat rewards.
- Manual active/scheduled events take precedence. Future weekly placeholders can be replaced by a manual event; ongoing weekly events still require explicit stop. After a manual event ends, a still-active weekly window resumes for only its remaining duration.
- Canceling/stopping one weekly occurrence skips only that occurrence/type, not all following weeks. Disable recurring schedules to stop the weekly series.
- Maintenance keeps existing security behavior and does not extend event duration. Missing an entire interval never pays retrospective rewards.
- Existing game states, inventory and outer API behavior are preserved. Migration replay does not re-enable disabled schedules, remove manual events or duplicate cron jobs.

Validation: `node --test tools/weekly-events-sql.test.mjs tools/weekly-events.test.mjs`; `python tools/weekly-events-browser.py`; full existing test suite. PostgreSQL fixture tests permissions, minute boundaries, year rollover, skip, manual precedence, idempotence, cron registration and real x100 rewards/retry.

## Evening time change (2026-10-19)

The evening preset moves to **21:30 KST**. Apply `supabase/migrations/20261019081000_friday_evening_2130.sql` to an existing database, then verify the `friday-evening` row and current/next candidates. This patch preserves enabled status, durations, multipliers, skipped dates and manual event slots. The morning preset remains 07:00.

The patch intentionally handles a missing weekly table because legacy creation migrations are named with later dates; fresh installations seed 21:30 in `20261020_weekly_events.sql`.
