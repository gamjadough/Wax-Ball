# Foley revision 4 — 2026-11-22

The user identified the previous comparison audio itself as the problem. Replace the three recorded sources, not the playback routing. Other 20 existing material recipes and all dedicated original/skin audio stay unchanged.

## Web references

- Chocolate snapping/breaking: https://www.youtube.com/watch?v=S-eSqRS1uW8
- Ice field-recording workflow: https://www.youtube.com/watch?v=Cf3yZ94y_g0
- Bread crust breaking/tearing: https://www.youtube.com/watch?v=LKqqOgXTFU8

Search metadata, descriptions and recording provenance were reviewed. This environment did not provide auditory monitoring of YouTube or generated audio; do not describe this as a listening test. YouTube soundtracks were not downloaded or reused.

## Changes

Use distinct recorded chocolate fracture excerpts instead of four versions of one last snap. Replace ice hit with a wooden log with Nox_Sound's natural ice sequence. Replace baguette crumbling with bread cutting/ripping excerpts for pastry foley. The donut source is a substitute, not a real donut recording. Attribution and edits are in the in-game linked CREDITS.txt. Archive hashes are reproducible.

Keep unshifted source pitch and short one-click clips. Adjust excerpt lengths per material and stage. Preserve resampled true-peak protection, selected-ball preload, bounded material cache and active voices. Total deployed PCM remains below 2.2 MB; input recordings are build-only, never preloaded by the game.

Automated audio checks establish format, non-silence, peak limits, routing and lifecycle behavior, not subjective realism. New comparison order: chocolate / donut / water, four stages each.

## Validation

16 Node audio/regression checks passed. Edge touch emulation at 320x640, 844x390 and 1200x900 passed all 23 selected-ball hits, all 92 real WAV decodes/stages, full break sequence, material cache/voice limits, final preemption, mute, reward and reload preservation. No physical-device or subjective listening test was performed.
