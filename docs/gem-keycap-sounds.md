# Gem-grade keycap audio — 2026-11-23

Emerald (29 hits) and diamond (32 hits), grade 보석, now use real individual mechanical-key presses by StavSounds from the Mechanical Keyboards pack on Freesound. All five source pages license the recordings CC0. Four tactile keys supply early/tap/mid/late; one clicky key supplies final. See tools/audio-sources/keycap/source.json and in-game settings linked sounds/materials/CREDITS.txt for each URL/hash and edits. Original yellow/special/skin/custom audio still takes precedence. Other grade WAVs are unchanged.

No wax overlay, synthetic impact, pitch shift or time stretch. Preserve short down/up keystrokes; trim low-level silence with 3 ms pre-roll and 20 ms tail, mono 22050 Hz PCM16, 1/12 ms fades and staged level normalization guarded against 48 kHz resampling peaks. Final always resolves to keycap/final.wav. Five shared files add 42,694 bytes; all ordinary sound WAVs total 421,956 bytes. Selected-ball loading, voice/cache bounds and mute remain unchanged. No gameplay/economy changes.

Source example: https://freesound.org/people/StavSounds/sounds/766625/ ; CC0 https://creativecommons.org/publicdomain/zero/1.0/ . Rebuild through tools/build-material-sounds.py --ffmpeg PATH; input/output checksums are in sources.json.

Validation: 16 Node audio/regression checks passed. Edge touch emulation at 320x640, 844x390 and 1200x900 covered 23 selected-ball hits, all 25 WAV decodes/stages, full emerald/diamond and earlier grade breaks, final preemption, bounded cache/voices, mute, rewards and save/reload. Earlier-grade WAVs have no diff. No physical-phone or auditory monitoring was performed.
