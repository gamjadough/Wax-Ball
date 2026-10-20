# Jack-o-lantern skin workshop (local review only)

Three cosmetic candidates for the existing Halloween Jack-o-lantern:

| Skin | Proposed rank / candy price | Main visual difference |
| --- | --- | --- |
| 푸른 도깨비불 | Rare / 50 | Internal blue flames, orbiting wisps, rising fire fragments |
| 유령의 잭오랜턴 | Hero / 100 | Floating spirit inside the gourd, escaping ghost on destruction |
| 월식의 잭오랜턴 | Legendary / 200 | Red crescent moon, rotating ritual seal, contraction and eclipse ring |

These are proposals, not purchasable inventory entries. This patch does not load the candidate assets in the production game, grant ownership, spend candy, add server APIs or alter rewards. Existing 100 required cracks and 1.5B base Gold are retained. Workshop hits add 10 solely for faster visual review.

## Visual revision

The preview now imports live `style.css` and `skins.css` instead of a separate workshop theme. It uses the existing round buttons, yellow primary action, dark inventory sheet, purple selected skin tab and inventory card layout. Desktop shows play and inventory side by side; phones stack them with a reachable jump link and normal document scrolling.

`pumpkin-skin-art.js` renders the same spherical wax silhouette and common specular highlights as existing skins. Layered shaded pumpkin lobes, wax flecks, inset carved edges and cavity gradients replace flat sticker-like motifs. Animated energy is clipped to the actual carved eyes/mouth. Wisp has teal wax and pale internal soul flames; ghost has pearlescent ivory/lavender wax, flowing wax veils and drifting inner mist; eclipse has dark burgundy wax, metallic lunar engraving and ember-lit carvings. Hits squash the ball briefly; reduced motion disables that feedback. The shared preview renderer is used for both inventory thumbnails and the playable ball.

Start `tools/local-server.mjs` with `WAKPPU_LOCAL_PORT=4182`, then open `http://127.0.0.1:4182/local-pumpkin-skins/`. The standalone workshop requires no login or backend connection. Only the selected candidate is persisted under a separate localStorage key; no player save is read or written. BGM and random scare images are disabled here. Audio reuses existing licensed Kenney CC0 pumpkin/eternity files; see the corresponding sound-directory license files. No third-party art is used.

The preview supports touch/keyboard, portrait/landscape, volume/mute, reduced motion and cancellation during resets, skin changes and page hiding. Reduced motion creates no particles. Final cracks remain visible before destruction. Callback deadlines match the existing pumpkin but only update preview status, never player currency.

## Live crack parity and tier effects

`preview-cracks.js` mirrors the live `game.js` jagged main/branch generator, three-layer crack drawing, progress intervals and increasing widths. It uses the live `.crack` transitions (160ms growth / 200ms width), and the same `instant` final-stage class. Progress shortcuts no longer regenerate the crack layout. `preview-cracks.test.mjs` compares the function bodies and tests identical geometry/growth/widths over 40 seeded configurations. The preview adapter does not change production gameplay code.

Tier cosmetics never invent a second crack: hero/legendary light copies the exact main crack path and current dash offset. Rare has fine blue sparks at actual growing tips and a modest fire-fragment break. Hero adds subtle violet seam mist and an escaping spirit. Legendary adds a stronger, late-stage gold/ember seam, contraction, an eclipsed moon and an expanding lunar ring. Cosmetic strength does not change damage, reward or lifecycle deadlines. Motion-reduced mode disables seam pulses, crack transitions, squash and particle effects.

Destruction node budgets (phone / desktop): rare 6 / 10, hero 9 / 15, legendary 12 / 20, including signature effects. Crack light is capped at the ten main cracks (one extra path for hero, two for legendary); ordinary branch paths and their widths are untouched. No fullscreen flash, blur or external image decode is added.

Checks: `node --test tools/pumpkin-skins.test.mjs tools/preview-cracks.test.mjs tools/skin-motion.test.mjs`; with a server running, run `tools/pumpkin-skins-browser-test.py` using Python with Playwright and Edge available. Screenshots go to ignored `tools/test-results/pumpkin-skins/`.

Before a future production release: confirm artwork/prices, implement server-validated candy exchange and persistent ownership/equipment (including established administrator access rules), connect inventory UI and live effects, test economy/auth/migrations, and version all changed live script/CSS references. The current small ART hook alone does not activate these skins.
