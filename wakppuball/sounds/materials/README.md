# Material foley v2

Kenney Impact/Sci-fi source assets are CC0; original per-object arrangements, bubbles, air and tonal details are also CC0. Source URLs, source/output hashes and individual recipes are in sources.json; original license files are included. Build inputs are archived under tools/audio-sources/materials.

There is no common wax/noise/impact bed. Each object uses a different dominant source and temporal construction. Water gurgles; donut compresses and crumbles; chocolate snaps in separate fragments; diamond shatters; blackhole sucks inward; cloud puffs; embers pop individually. No source or playback pitch shifting is used. Durations vary by material and stage. Existing yellow, admin, seasonal, blue crystal and skin audio is untouched.

Rebuild with tools/build-material-sounds.py --ffmpeg PATH (NumPy required). Output: 22,050 Hz, mono PCM16; peaks 0.46/0.49/0.52/0.59, <=1.05 seconds. Selected-ball preload and bounded cache/voice limits remain. The sound engine appends the revision query to avoid replaying cached v1 audio.
