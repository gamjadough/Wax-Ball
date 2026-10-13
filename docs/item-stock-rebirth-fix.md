# Used-item stock after rebirth

Reproduction: start with 3 copies, use twice (server stock 1), rebirth, replay an earlier successful item-use request. The idempotent server correctly returns that request's original snapshot (stock 2) without changing current stock. Previously the browser accepted this old snapshot, restored stock 2 on screen, and rolled back item revision/Gold.

Fix:
- Reject item responses older than the current account's item revision.
- Invalidate in-flight inventory reads when rebirth clears active effects.
- Reject prior-run transactions, and prior-run effect snapshots, even at the same revision after rebirth.
- Stale hit responses must not apply Gold, hits or animations; restore current account state instead.
- Current inventory reads and genuinely new draw rewards remain allowed. Do not cap stock or erase items.
- Reset the response boundary for a different account.

No database migration or player-data correction is needed. The server already preserves consumed stock. Unused items, pity and total draws are retained; active effects still end at rebirth as before.

Validation: real PostgreSQL historic retry/current stock regression, isolated mobile/desktop sequence 3→2→1→rebirth→1→reload→1→use→0, equal-revision old effects/Gold, delayed reads, fresh stock increases and account switching; existing game tests.
