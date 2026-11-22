# 2026-11-22: client work reduction and recorded material sounds

Same local static-server/no-store setup, Edge headless touch emulation 390×844, signed out, menus closed, 4.2-second idle observation:

| Observation | Before | After |
| --- | ---: | ---: |
| Initial audio media objects | 20 | 5 |
| Skin thumbnail construction calls while idle | 20 | 0 |
| Body DOM mutation records | 347 | 45 |
| Resource encoded body size | 2,060,314 bytes | 954,863 bytes |
| Audio objects after six material selections | 32 | 17 |

These are local observations, not physical-phone benchmarks or production transfer guarantees. Browser cache and server compression affect downloads. Runtime work, memory residency and hidden UI were reduced without removing player content.

Changes:
- Preload one media element per asset; grow additional voices only on actual overlap, retaining ready-only playback and recovery.
- Stop constructing hidden skin thumbnails. Check the inventory signature before generating SVG; render immediately on menu opening.
- Stop refreshing hidden item/potion grids. Keep active-effect badge expiry updates.
- Avoid rewriting identical event text/attributes and identical local save payloads. Remote save scheduling remains unconditional so accepted click progress is preserved.
- Drop preload helpers for unequipped/unselected skin sets and five obsolete fake-material source assets.

Recorded replacements: chocolate = actual isolated final dark-chocolate snap by Finnssound (CC0); donut = actual baguette crumbling by robotortoise (CC BY 4.0), a pastry substitute, not a donut recording; water = actual ice impacts by davilca (CC0). Trimming, mono resampling, 95 Hz high-pass, gain/fades and resampling peak control; no substitute wood/carpet/slime or synthetic impact layers. Sources and edits are in sounds/materials/CREDITS.txt, reachable from Settings.

Validation: 34 related Node tests; tools/performance-browser.py (390×844, 844×390, 1200×900); material-sounds-browser.py; items-browser.py; game-connection-browser.py; real-SQL fixture skin equip/unequip at three sizes; yellow-sound-browser.py; sound-recovery-browser.py. Performance script uses tools/local-server.mjs on loopback port 4199. No production users are used for mutable QA. Maintenance settings are not changed.
