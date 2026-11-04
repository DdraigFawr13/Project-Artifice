# Asset sources and licences

Every file in `assets/` is listed here with where it came from and its licence (SAFE-05).

## Images

- `wide.png` (400 × 800): AI-generated placeholder, not final art (D-003). Source: the wide-shot concept embedded in `mockups/forge.html` (OpenArt, Nano Banana 2, made for this project 2026-11-04; round 8 of the forge mock-up). Edited locally on 2026-11-04 with `tools/art/deblade.py` (the hot blade and its tang painted out with the anvil face's colour) and `tools/art/pad.py` (scaled to 360 px wide, centred on `--night-0` with a 16 px fade). No credits spent on the edit.
- `close.png` (400 × 800): AI-generated placeholder, not final art (D-003). Source: the close-up anvil concept embedded in `mockups/forge.html` (OpenArt, Nano Banana 2, made for this project 2026-11-04; round 8 of the forge mock-up). Edited locally on 2026-11-04 with `tools/art/deblade_close.py` (the hot knife and its sparks painted out, the knife's warm cast on the anvil cooled, then scaled to 360 px wide and centred on `--night-0` with a 16 px fade). No credits spent on the edit (Morgan chose the free edit, 2026-11-04).

## Fonts

- `fonts/PixelifySans-Variable.ttf`: Pixelify Sans, © 2021 The Pixelify Sans Project Authors. SIL Open Font License 1.1 (`fonts/OFL-PixelifySans.txt`). From `google/fonts`, `ofl/pixelifysans/`, commit 66285aa, 2026-11-04.
- `fonts/PressStart2P-Regular.ttf`: Press Start 2P, © 2012 The Press Start 2P Project Authors, Reserved Font Name "Press Start 2P". SIL Open Font License 1.1 (`fonts/OFL-PressStart2P.txt`). From `google/fonts`, `ofl/pressstart2p/`, commit 66285aa, 2026-11-04.

## Sounds

All CC0 (D-005). Downloaded and converted on 2026-11-04 with ffmpeg (mono Ogg Vorbis); no other edits.

- `sfx/fire.ogg`: "Fireplace Sound loop" by PagDev, CC0 1.0. https://opengameart.org/content/fireplace-sound-loop (file `fire.wav`, 29 s; source SHA-256 85ca0cc6…f59e330). Quality 2.
- `sfx/bellows.ogg`: "wind whoosh loop" by SketchMan3, CC0 1.0. https://opengameart.org/content/wind-whoosh-loop (file `wind woosh loop.ogg`, 6 s; source SHA-256 0cfdbd3f…2191dac). Quality 3. Used as the bellows' air.
- `sfx/hammer.ogg`: "Blacksmith's Hammer" by VishwaJai, CC0 1.0. https://opengameart.org/content/blacksmiths-hammer (file `blacksmithhammer.wav`, 0.5 s; source SHA-256 a26c2e96…5ec7ae2). Quality 3. Downloaded and converted on 2026-11-04.
- The forge hum is not a file: it is a Web Audio oscillator made in `src/game/Forge.ts`.
