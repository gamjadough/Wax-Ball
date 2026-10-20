# Jack-o-lantern skin workshop (local review only)

Three cosmetic candidates for the existing Halloween Jack-o-lantern:

| Skin | Proposed rank / candy price | Main visual difference |
| --- | --- | --- |
| 푸른 도깨비불 | Rare / 50 | Internal blue flames, orbiting wisps, rising fire fragments |
| 유령의 잭오랜턴 | Hero / 100 | Floating spirit inside the gourd, escaping ghost on destruction |
| 월식의 잭오랜턴 | Legendary / 200 | Red crescent moon, rotating ritual seal, contraction and eclipse ring |

These are proposals, not purchasable inventory entries. This patch does not load the candidate assets in the production game, grant ownership, spend candy, add server APIs or alter rewards. Existing 100 required cracks and 1.5B base Gold are retained. Workshop hits add 10 solely for faster visual review.

Start `tools/local-server.mjs` with `WAKPPU_LOCAL_PORT=4182`, then open `http://127.0.0.1:4182/local-pumpkin-skins/`. The standalone workshop requires no login or backend connection. Only the selected candidate is persisted under a separate localStorage key; no player save is read or written. BGM and random scare images are disabled here. Audio reuses existing licensed Kenney CC0 pumpkin/eternity files; see the corresponding sound-directory license files. No third-party art is used.

The preview supports touch/keyboard, portrait/landscape, volume/mute, reduced motion and cancellation during resets, skin changes and page hiding. Mobile effects use at most eight fragments plus one signature effect; reduced motion creates no particles. Final cracks remain visible before destruction. Callback deadlines match the existing pumpkin but only update preview status, never player currency.

Checks: `node --test tools/pumpkin-skins.test.mjs`; with a server running, run `tools/pumpkin-skins-browser-test.py` using Python with Playwright and Edge available. Screenshots go to ignored `tools/test-results/pumpkin-skins/`.

Before a future production release: confirm artwork/prices, implement server-validated candy exchange and persistent ownership/equipment (including established administrator access rules), connect inventory UI and live effects, test economy/auth/migrations, and version all changed live script/CSS references. The current small ART hook alone does not activate these skins.
