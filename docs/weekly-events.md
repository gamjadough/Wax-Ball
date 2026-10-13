# Friday recurring events (Asia/Seoul)

| Start every Friday | Admin ball | Gold multiplier |
| --- | --- | --- |
| 07:00 | 600 seconds | x10, 600 seconds |
| 21:00 | 900 seconds | x100, 600 seconds |

- `20261020_weekly_events.sql` creates disabled presets. Enable with the authenticated administrator API `admin_weekly_events`, mode `enable`; mode `disable` stops only weekly windows and presets. `list` is read-only.
- The admin panel contains **매주 금요일 반복 이벤트** with enable/disable controls and KST dates.
- A protected server helper prepares the current/next window. Exact timestamps are used by all existing reward APIs; timestamps never shift to the time of login or cron execution.
- pg_cron refreshes windows every minute even with nobody online. Every game API also refreshes before handling a request. SQL helpers and schedule tables cannot be called or edited by players.
- Gold ends at 21:10; admin ball remains through 21:15. Intervals are start-inclusive, end-exclusive. New occurrences get distinct stable IDs, and duplicate refresh/hit requests do not repeat rewards.
- Manual active/scheduled events take precedence. Future weekly placeholders can be replaced by a manual event; ongoing weekly events still require explicit stop. After a manual event ends, a still-active weekly window resumes for only its remaining duration.
- Canceling/stopping one weekly occurrence skips only that occurrence/type, not all following weeks. Disable recurring schedules to stop the weekly series.
- Maintenance keeps existing security behavior and does not extend event duration. Missing an entire interval never pays retrospective rewards.
- Existing game states, inventory and outer API behavior are preserved. Migration replay does not re-enable disabled schedules, remove manual events or duplicate cron jobs.

Validation: `node --test tools/weekly-events-sql.test.mjs tools/weekly-events.test.mjs`; `python tools/weekly-events-browser.py`; full existing test suite. PostgreSQL fixture tests permissions, minute boundaries, year rollover, skip, manual precedence, idempotence, cron registration and real x100 rewards/retry.
