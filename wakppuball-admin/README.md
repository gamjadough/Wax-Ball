# Administrator site

Open `/Wax-Ball/wakppuball-admin/` for the public server, or append
`?server=friends` for the friends server. Both use their own Supabase project,
sessions and player data. Switching the selector navigates to a fresh page and
clears drafts and selected targets. No backend administrator secret is shipped.

Existing server-side RPC authorization remains authoritative. Anonymous sessions
and ordinary accounts cannot open the workspace; role revocation locks it and
clears displayed private records. Moderator actions remain server audited.

The existing owner's email/password identity, game state, ordinary inventory,
skins, gems, paid entitlements and equipment were migrated to the public project
without changing the source account. Halloween selections were excluded, and paid
ownership was recreated as zero-cost admin grants without copying bank/order
records. Password verification
material was transferred in memory only, never added to this repository. Numeric
gold is serialized as a string to preserve values beyond JavaScript's range.
Old sessions and project signing secrets were not copied.

The page reuses the existing administrator event, moderation, grant, lifecycle,
input-record and purchase controls. `tools/build-admin-site.mjs` generates HTML
and the administrator-only purchase module from the shared source. It does not
load the gameplay loop, sound engine, seasonal media or a hidden game iframe.
Preview controls open an authorized test in the selected game.

When shared markup or controls change, run both:

```
node tools/build-admin-site.mjs
node tools/build-public-site.mjs
```

Validation:

- `node --test tools/admin-site.test.mjs tools/public-server.test.mjs`
- Start `node tools/admin-site-fixture.mjs`, then run
  `python tools/admin-site-browser.py`. This uses isolated in-memory PGlite
  databases, fake loopback-only authentication, and no production accounts.
- `WAKPPU_TEST_NODE_PACKAGE` points to a package with pinned PGlite installed;
  `WAKPPU_TEST_PYTHON_PATH` points to the existing Playwright test dependencies.
