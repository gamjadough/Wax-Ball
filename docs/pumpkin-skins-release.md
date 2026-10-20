# Halloween Jack-o-lantern skins

Production integration of the previously reviewed workshop artwork/audio.

* Shop → 아이템 구매 → 잭오랜턴 전용 스킨: wisp 50, ghost 100, eclipse 200 candy.
* Inventory → 스킨: equip/unequip purchased cosmetics for the Jack-o-lantern.
* Base Jack-o-lantern (100 candy, in the limited collection) must be unlocked to equip.
* Exchange only during the server's Halloween period; ownership/equipment survive rebirth, refresh and event end.
* Skins change artwork, hit/break sound and motion, not required hits, reward or candy odds.
* Existing pumpkin 30% candy drops, normal-ball 10%, eternity draws/shards/pity and existing saves stay unchanged.

## Server and data

`20261020124508_pumpkin_skin_exchange.sql` adds a private RLS candy catalog.
It reuses `wakppu_skins.owned/equipped/revision` (with a distinct ball key) and
the existing per-user skin request cache. No bulk player updates or resets.
Only the server catalog determines the candy cost. Shared bootstrap guards
preserve maintenance, bans, sleep hours and real account-role verification.
Locks follow game state → limited state → skin state; revision checks and
fingerprinted request IDs prevent concurrent/replayed charges. Retries return
a fresh authorized snapshot without applying a transaction again.

Verified non-anonymous administrators have virtual free access, even after
the event. No free permanent ownership is written; revoking the role immediately
removes virtual access, including retried equipment requests. Ordinary paid
ownership is not removed. Clients cannot choose another user ID or supply a price.

Apply the migration through Supabase, then run the transactional synthetic-user
smoke test `tools/pumpkin-skin-production-check.sql`. It rolls back all test data
and does not alter real users or global settings. A Git push alone is not a DB deploy.

## Rendering and audio

Live gameplay uses its original crack generator, not the workshop mirror. Skin
accents follow those exact growing paths; the ordinary hit squash is not doubled.
Each shop/inventory SVG has distinct IDs. Phone particle budgets, cancellation,
mute and both OS/game reduced-motion settings remain supported. Eclipse's four
approved audio hashes and blood-moon motion are unchanged. Wisp ignition crackle
and ghost breath use independent original synthesis, documented with the assets.

## Checks

* Full `tools/*.test.mjs` Node suite, including PGlite SQL and local service tests.
* `tools/pumpkin-skin-live-browser.py`: actual shop, all three exchanges/equips,
  partial/last hits, exact-once rewards, cleanup, unique SVG IDs, reload, rebirth,
  expired-event equip and administrator access. Edge emulation: desktop, touch
  320/390px portrait, 844px landscape and reduced motion. No physical device claim.
* Existing `tools/limited-browser.py`: base pumpkin behavior preserved.
* `tools/pumpkin-audio-browser-test.py`: 12 real audio decodes and staged playback,
  reset and mute, on desktop/phone portrait/landscape.
* Confirm production HTML/JS/CSS and WAV hashes after GitHub Pages completes.
