# Original pumpkin skin sound design

Twelve deterministic, sample-free Foley sounds generated for this project by
`tools/build-pumpkin-skin-sounds.py` (Python standard library only).

No eternity skin sound files, third-party recordings, music, human voice samples, or bell
samples are used. These assets are original project material, not repackaged
external recordings. No third-party audio attribution is required.

- Wisp (character revision): bright, high-passed ignition crackle, irregular
  spark pops and a short fading sizzle; no shared low gourd impact.
- Ghost (character revision): soft-onset drifting hollow vowel, breath and
  three short whisper echoes; no struck-shell burst. A synthetic spectral
  voice, not a human recording.
- Eclipse: low hollow wax/gourd impact, dry rind splits, air intake, then a
  short low-frequency body rupture at 430ms of the final sound.

Format: mono PCM16 WAV, 24 kHz; peaks limited to 0.56 before the in-game
volume control. Longest file is 1.30 seconds. No loops or background music.

Regenerate only the revised two sets with `--only wisp ghost`. Eclipse files
are preserved byte-for-byte; their approved hashes are pinned in the audio
regression test. Loudness bounds, zero-crossing contrast and transient/tail
contrast are tested in addition to file uniqueness.
