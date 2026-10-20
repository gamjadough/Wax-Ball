# Pumpkin candy drop patch

During the configured Halloween event, a successfully destroyed Jack-o-lantern
has a server-authoritative 30% chance to award one candy. Ordinary balls keep
their existing 10% chance. Non-final hits and expired events never award candy.

Migration `20261020103329_pumpkin_candy_drop_30_percent.sql` patches only the
existing limited API implementation, preserving all outer wrappers and data.
The existing game-state/limited-player locks, request cache and transaction
control the award; no separate client-side roll or replayable grant API exists.
The internal RNG helper is not executable by public/anonymous/authenticated roles.
The limited response advertises both drop rates, and the collection UI explains
them. Script cache versions are bumped. No existing tokens or progress are reset.

`tools/limited.test.mjs` covers the 0.299999 / 0.3 boundary, non-final hits,
replayed requests, expiry, preserved Gold/ownership and migration reapplication
using both the local service and actual PGlite SQL. The original 10% normal-ball
tests are retained. The stale eternity-effect cache expectation is corrected to
the already-shipped shatter version; no eternity effect code is changed.
