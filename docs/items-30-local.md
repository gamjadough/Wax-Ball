# 30-item draws and interactive wax-ball reveals

## Local preview

Run `node tools/local-server.mjs` from this checkout. The default URL is
`http://127.0.0.1:4173/?preview=items`; `WAKPPU_LOCAL_PORT` can select another port.
The server uses isolated in-memory sample players, not Supabase or production data.

The items preview signs into the local sample player automatically and grants
100Qi Gold, three copies of all 30 items, and a pity counter of 98.
Use the sample-reset button to restore those values. The free five-rarity preview
demonstrates each reveal without charging Gold or granting extra items.

## Behavior

- Inventory uses three columns and nine kinds per page, including on mobile.
  Empty slots keep the final page aligned. Rarity filters and ascending/descending
  rarity sorting reset to the first page; items within a rarity keep catalog order.
- Inventory cards show the icon, name, rank and owned count. Selecting a card opens
  its description and use action; Back or Escape returns to the same page and card.
  Using the final copy returns to the list and preserves the active effect.
- Base rank weights: common 7000, rare 2200, hero 600, legendary 190,
  transcendent 10, out of 10000. Within-rank selection is uniform.
- Existing 1/3/5-pull prices and the 100-pull transcendent pity remain unchanged.
  The 0.1% transcendent rate excludes pity; the long-run rate with pity is about 1.05%.
- Server draws debit Gold and grant all items atomically before presentation.
  Interactive reveals are not a second transaction or another random roll.
- Common through transcendent reveals take 2/3/4/5/6 touches. Cracks leak the
  corresponding rank color; wax fragments disperse on the final touch.
- Current-ball skip and remaining-reveals skip only affect presentation.
- Closing the window pauses interaction. The queue is stored per account in
  localStorage and restored on reload. Disabling storage can lose presentation,
  but cannot undo inventory already granted by the server.
- Feather and haste increase ordinary ball-break playback speed, not draw-reveal
  speed. Multipliers 1.25 and 1.5 shorten playback to 80% and about 67%.
- Haste compares damage and animation independently; a stronger damage buff
  does not prevent using its animation benefit. Same-channel strongest-effect
  selection, rebirth effect reset, and inventory retention are unchanged.

## Validation

Run `node --test tools/items.test.mjs tools/items-sql.test.mjs`,
`node tools/sync-items-data.mjs --check`, `python tools/items-browser.py`, and
`python tools/items-reveal-browser.py`. Browser tests use native Python Playwright,
Edge Chromium, isolated local servers, and desktop/mobile touch emulation.
SQL tests require the existing PGlite test dependency.

Run `python tools/items-grid-browser.py` for 320px/390px/1200px inventory layout,
all 30 kinds across four pages, both sort directions, filters, detail use,
last-copy consumption, empty states, page clamping and keyboard focus.

## Deployment order

The release incorporates the latest Halloween collection/scenery from main.
Production item counts and weights were verified as 10/10/7/2/1 and
7000/2200/600/190/10 respectively before the client release.
When releasing again, apply `supabase/migrations/20261015_items_30.sql` before deploying
the matching client. It only upserts item definitions and rank weights, preserving
player inventory, active effects, request history, and existing API/schedule wrappers.
The SQL file is generated from the same client catalog by `tools/sync-items-data.mjs`.
Do not publish the new client against the old 16-item server configuration.
