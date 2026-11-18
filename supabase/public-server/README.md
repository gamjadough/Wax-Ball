# Public server

- Project: `uczyjfbcytvzxnlmzyhp` (`wax-ball-public`, saeson organization)
- Entry: https://gamjadough.github.io/Wax-Ball/wakppuball-public/
- Friends project and entry remain `obkukmtuibymynvlunll` and `/wakppuball/`.

This is a fresh schema/catalog baseline, not an upgrade migration for the friends
database. **Never run these files on the friends project.** No users, passwords,
progress, orders, entitlements, announcements or bank details are copied.

On a fresh project, apply the baseline and `public-policy.sql` together in one
transaction/migration, then `services.sql`. The deployed baseline migration
includes both baseline and policy. All tables use RLS; only `wakppu_api` is exposed
to browser roles. Image commit/garbage collection are service-only. Catalogs for
Halloween skins, potions and profile cards are empty; seasonal compatibility
tables/functions remain private for the existing gameplay wrappers. Public RPC
rejects seasonal actions for players and administrators. Seasonal dates and
effects stay disabled.

Anonymous sign-in and email confirmation are enabled. Site URL and redirect URL
are the public entry above. Payments are disabled and bank fields are blank by
the owner's choice. Administrators may configure payments later through the game.
Game accounts are independent: create a new account on the public entry before
assigning its verified account the administrator role. No first-user auto-admin
or client-supplied role claims are accepted.

Custom SMTP is not configured yet. Supabase's default mail service only delivers
to organization members; general players can use quick start now, but public
email signup/linking requires a separately configured mail provider. Do not turn
off email confirmation to work around this restriction.

Deploy `../functions/custom-ball-image/{index.ts,handler.mjs,image.mjs}` to this
project. The public function uses `verify_jwt=false` so current asymmetric Auth
JWTs and publishable keys work; `handler.mjs` validates `auth.getUser()` before
every user operation. The public health action exposes only readiness/version,
not account or file data. Storage bucket `wakppu-custom` is private.

Scheduled jobs: unused quick-start cleanup every 5 minutes, recurring event
refresh every minute, monthly ranking settlement every minute. Played accounts,
email-linked accounts and administrators are protected by the existing cleanup
rules. Friday 07:00 / 21:30 and Tuesday 21:30 events use Korean time.

The public entry shares media and ordinary game scripts through an HTML base URL.
It loads a separate server config, save key and neutral seasonal adapters, with
no seasonal effects, listeners or resource preloads. Auth session keys are
automatically distinct because Supabase project refs differ.

After changing the friends HTML or shared scripts, run `node tools/build-public-site.mjs`
and include the regenerated public HTML. Asset hashes prevent stale shared code.
Test with `node --test tools/public-server.test.mjs` (PGlite dependency required),
`tools/public-server-browser.py` on a local static server, and the transaction-only
`tools/public-server-production-check.sql` against the public database.
