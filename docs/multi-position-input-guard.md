# Multi-position input guard

Adds sequential multi-point patterns to the existing input guard. It detects
game input behavior, not installed applications. Randomized human-like automation
and clients that suppress telemetry cannot be identified perfectly by a website.
Server hit-rate limits still apply independently of client reports.

## Signals and safeguards

* Existing sustained 10+ CPS / nearly identical interval signal remains.
* Up to 16 bounded coordinate clusters, radius 35/1000 of the SVG box, tolerate
  touch rounding and squash jitter. Sequential periods 3–12 are inspected.
* A cycle requires at least 3 frequently-used clusters, 100 valid comparison pairs,
  8 full periods, 92% location repetition, 85% same-phase interval agreement within
  6ms, and cycle-duration variation at most 12%. A coordinate sequence alone is
  insufficient. Pauses over 250ms split comparisons so respawn gaps do not distort
  active speed or become evidence by themselves.
* Normally at least 120 samples, 6 seconds elapsed and 4 seconds of active intervals
  are needed for cycle/overspeed analysis. Extreme 60+ CPS can be observed from
  120 samples over at least 2 seconds. Evidence is bounded to 30 seconds.
* Near-simultaneous batches (35%+ intervals within 8ms across 3+ clusters) are not
  treated as sequential macro evidence; this protects multi-finger batches.
* Sustained active 25+ CPS or extreme speed, without machine-like repetition, can
  trigger a temporary rate cap but never raises suspension score by speed alone.

## Enforcement

Accepted server hits corroborate every report (8+ recent hits and at least 10
seconds since the last report/first observed server hit). Client-only claims never
cause restrictions. Both cycle evidence and overspeed first get a 30-second cap:
12 accepted requests/second replenishment, burst capacity 24. Normal capacity
remains 40/second with burst 80. Rejected requests cannot grant gameplay rewards.

Only three consecutive, independent, corroborated machine-pattern reports and
100 accumulated suspicion points trigger the existing 2-minute suspension. No
permanent ban is added. Genuine signed-in administrators are exempt from automatic
restrictions. Existing admin unban clears the rate cap as well as suspicion state.
Replay IDs never add evidence, extend limits or charge/reward twice.

## Transport, privacy and compatibility

The client ring buffer retains the newest 2,048 samples in order, with O(1)
insertion and no per-touch analysis. Reports remain every 15 seconds; retry uses
the same immutable pending request. Background/account changes reset collection
and notices. Older clients' 512-sample reports remain valid.

Only aggregate cycle/speed metrics are logged. Per-touch coordinates are not added
to persistent tables. New state is one nullable timestamp on the existing private
RLS guard table; the metrics function remains non-executable to client roles.
The migration locates and patches only the existing guard wrapper, preserving newer
guest deletion, economy and keepsake wrappers. No progress or real moderation rows
are reset by deployment. This also follows the Supabase least-privilege guidance.

## Validation and deployment

Run `node --test tools/*.test.mjs` with expanded test paths on Windows. Tests cover
JS/Postgres parity, 3/7/8/12-point variable timing cycles, respawn pauses, seeded
human-like touches, simultaneous batches, soft-limit-only overspeed, reward safety,
expiry, retries, repeated migration install, admin authorization and unban.
`tools/input-guard-browser.py` uses native Playwright/Edge touch emulation for
320/390 portrait, 844 landscape and desktop: real reports, warning, restrictions,
admin record visibility/clearing, 44px controls, scrolling and JS errors.
These are emulations, not physical-device tests.

Apply `20261022081610_multi_position_input_guard.sql` after local verification, then
run `tools/multi-position-input-production-check.sql`. Only new synthetic users are
used; every server-side test write rolls back. Push the integrated remote main and
verify Pages assets separately from database deployment.
