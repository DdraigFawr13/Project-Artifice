# Forge prototype

- **Status:** Approved 2026-11-04
- **Planned in:** [design round 1](https://claude.ai/artifact/NA4KTBCDvhGa22LTUzwbDy), [review](https://claude.ai/artifact/4dzk1d8JqTw6gcPtE4p7kQ), art direction ([1](https://claude.ai/artifact/1MpZv8TsgQK6DXwHRtRnNT), [2](https://claude.ai/artifact/LMMZGoVFjiwkUbSt4yBYnH)), [forge mock-up](https://claude.ai/artifact/8MATSEHtmtMVsXEF7X8faQ), [final plan](https://claude.ai/artifact/Dp2hubybfACEV2c8WHrftx), all 2026-11-04. Answers: [planning-answers.md](../design/planning-answers.md). **Decisions:** D-001 to D-006.

## Problem

Morgan: "I just always have loved crafting and nothing has ever really scratched the itch of being a crafter properly." Other games make crafting easy and tier-based: "it didn't really have much by way of quality of the end product except like tiers but it was fairly easy to craft" (CONCEPT.md). The prototype tests whether hands-on smithing, graded by the player's own precision, is fun on its own.

## Goals

- Morgan plays 10 crafts on the Pixel and still wants to forge another, with no shop or caravans (D-005). Only Morgan's playtest notes count (GAME-06).
- Careful and sloppy play of the same item and alloy give grades at least 25 points apart, and every point lost shows its cause.
- Heat is readable without colour: each of the 6 heat bands is brighter than the one below and has a bigger glow (D-003).
- A craft takes about 1 minute (horseshoe), 2 (knife) or 3 (sword) for a practised player, judged by Morgan's playtest notes.
- Each slice lands a playable build on a private Vercel preview link (D-006).

## Non-goals

- No shop, commissions, pricing, rarity score, reputation, caravans, patterns, casting, own-item selling or other professions (D-005).
- No final art, no hand-made normal maps, no tutorial system, no settings screen, no accounts or cloud saves.
- No landscape layout and no public release.

## Journeys and checks

### J1 Open the game

- **Given** the playtest build
- **When** it opens at 443 × 816 CSS px with a device pixel ratio of 2.4375 (measured on Morgan's Pixel 10 Pro XL, 2026-11-04; was 414 × 921 at 3.25 from a spec sheet)
- **Then** a loading screen, then the item list (mock-up frame 1). The game is drawn at scale 3, with 359 × 663 game px visible. **Check:** `e2e/open.spec.ts` reads the scale and visible size from the debug API and asserts scale 3 and 359 × 663, sees 3 item rows, and saves a screenshot.

### J2 Heat

- **Given** a bar in the fire
- **When** the player holds the bellows for 4 s, then moves the bar to the anvil for 3 s
- **Then** heat rises while held and falls on the anvil, and the metal's colour, brightness and glow radius change continuously with its temperature, with sparks from `orange` up. **Check:** `src/engine/heat.test.ts` (rise and fall at the rates in Data); `src/data/heat-bands.test.ts` (luminance and glow radius strictly rise across the 6 band anchors, with relative luminance at least 0.04 higher at each anchor than the one below (measured on the listed colours: steps 0.048, 0.069, 0.144, 0.236, 0.383)); `e2e/heat.spec.ts` pins 6 temperatures (one per band anchor) through the debug API and checks, in a greyscale screenshot clipped to the metal's bounding box from `metalBox()`, that the mean brightness strictly rises.

### J3 Hammer

- **Given** the hot piece in the close-up anvil view
- **When** the player touches and lifts a finger
- **Then** the strike lands 40 game px above the touch point at the moment of lift and counts for the nearest unstruck target within 9 game px (24 until 2026-11-04, see S3); a spark, a sound and a mark answer at once, and the strike's points show live. **Check:** `src/engine/strike.test.ts` (nearest target; the distance penalty; wild, cold, hot and repeat strikes); `e2e/hammer.spec.ts` reads a target from the debug API, taps 40 game px below it, and sees that target marked struck and the strike count rise in `state()`.

### J4 Quench and grade

- **Given** a hammered piece
- **When** the player drags it to the tub and lets go
- **Then** the result screen shows the score, its tier, the material quality beside it, and one line per cause, with score = max(0, round(100 − sum of points lost)); or the ruin screen with floor(parts ÷ 2) parts returned as scrap. **Check:** `src/engine/grade.test.ts` (sum rule, rounding, floor at 0, every ruin rule, scrap); `src/engine/spread.test.ts` (a careful knife (every strike within 4 px and in band, quench at 830 °C) and a sloppy one (every strike 12 px off, quench at 980 °C), with the default alloy differ by 25 points or more); `e2e/craft.spec.ts` plays a scripted knife through the debug API's `send()` and asserts the score, tier and cause lines; `e2e/ruin.spec.ts` quenches at white heat and sees the ruin screen.

### J5 Full loop

- **Given** a fresh save
- **When** the player mixes a 3-ore alloy, crafts a knife, then reloads the page
- **Then** the knife's best and the scrap count show on the item list. **Check:** `src/engine/alloy.test.ts` (weighted means for 2- and 3-ore mixes; a 1-ore mix is refused); `e2e/loop.spec.ts` (mix, craft, reload, best shown). Save and determinism tests land earlier (S1, S3).

## Decisions

- Touch-first web game in portrait; TypeScript, Phaser 4, Vite; 412 px first target; text 14 px and taps 44 px minimum (D-004).
- Rules in a pure engine module with a seeded generator and a fixed step; screens show results only (D-004, GAME-01, GAME-02).
- Scope, steps, items, grading, ruin and scrap, saving, hints, reheating, drag-to-quench, no heat gauge, CC0 sound (D-005).
- Ember Night look, a painted glow from forge and metal for now (live lights when an artist's normal maps arrive), heat readable without colour, AI placeholders, hot metal drawn in code (D-003).
- Private Vercel preview link per slice (D-006). This overrides master rule CI-05's "branch previews off"; the override goes in AGENTS.md and `.ai-master.json`.

## Alternatives rejected

- **Godot or Unity:** cloud build sessions can't easily run or screenshot them (design round 1). Would fail when an agent must check a screen (VER-06).
- **PixiJS:** no maintained official 2D normal-map lighting (research 2026-11-04). Would fail when D-003's live light is built.
- **A heat gauge:** makes reading the metal trivial (mock-up check record). Would fail the "reading the metal" skill (planning-answers.md:11).
- **Material quality inside the craft score:** CONCEPT.md has rarity = material quality + craft grade, so the craft score shows only the player's work. Would double-count material when rarity arrives in the shop phase.
- **Live Phaser lights now:** with flat placeholder normal maps they give only the radial falloff a painted glow gives, at a speed cost on the phone. Morgan chose the painted glow for now (D-003, updated 2026-11-04).
- **Fitting the whole 360 px width (×3 on the Pixel):** leaves black bars about 66 physical px wide each side. Cropping to a 336 px safe zone at ×4 fills the screen (UI_STYLE.md Layout). D-003's "360 × 640" is updated in this change to say so. (Measured 2026-11-04: Morgan's phone is 1080 physical px wide, so the same scale rule gives ×3 there with 359 game px shown and no bars; the rule is unchanged.)
- **Heat colour in steps per band:** the player couldn't see a threshold in the middle of a band yet would be charged for it (critic re-check). Colour, brightness and glow change continuously with temperature instead.

## Risks

- Touch precision feels unfair → strike on lift, 40 game px above the thumb, tolerances in game px, fixed step; Morgan tunes by playtest notes.
- The painted glow is too flat → an additive glow sprite per light, scaled by brightness, with a flicker; live lights return with real normal maps.
- Alloy choice is trivial → ores trade quality against difficulty (Data). Morgan's S5 playtest note says whether choosing an alloy matters.
- The "Burning!" alert gives the heat away → it shows only in the `white` band, where the metal is being damaged, never as a reading of the working heat.
- Tuning needs many playtests → every number lives in `src/data/*.json`, so tuning never touches code (GAME-04).

## Design

### Layout

```
package.json        # vite, typescript, phaser 4 (exact pin), vitest, @playwright/test (pinned to the preinstalled version); Node 22
index.html
src/engine/         # pure TypeScript: no Phaser, no DOM, no Math.random, no Date
  rng.ts            # mulberry32(seed: number) → { next(): number in [0, 1) }
  craft.ts          # CraftState, Input, createCraft, step
  heat.ts strike.ts quench.ts grade.ts alloy.ts
src/data/           # items.json, ores.json, heat-bands.json, grading.json, hints.json
src/game/           # Phaser scenes: Boot, Choose, Alloy, Forge (wide and close views), Result (result and ruin)
src/save/save.ts
src/ui/             # DOM overlay panels from UI_STYLE tokens; debug.ts (shown with ?debug)
assets/             # images, sounds, fonts; assets/ATTRIBUTION.md lists every file's source and licence (SAFE-05)
e2e/                # Playwright at 443 × 816, deviceScaleFactor 2.4375 (the J1 size), against `vite preview`
docs/playtests/TEMPLATE.md
```

Scripts: `npm run check` runs `tsc --noEmit` and `vitest run`; `npm run e2e` runs Playwright against `vite preview`. CI runs both, plus the drift check, on ready PRs and `main` pushes (CI-06).

### Scale and screen

- Scale `s` = max(1, min(floor(physical width ÷ 336), floor(physical height ÷ 640))), where physical size = CSS size × device pixel ratio, so the safe zone always fits. The visible area is (physical width ÷ s) × (physical height ÷ s) game px, rounded down. On the Pixel (1344 × 2992 physical px, reported, not checked) that is ×4 and 336 × 748 game px.
- Gameplay stays inside a centred 336 × 640 safe zone. Backgrounds are 400 × 800 game px, so any visible area up to that size is covered. Wider or taller screens show the background colour `--night-0`.
- Panels and text are DOM overlays over the canvas's bottom area, laid out in CSS px, so text stays sharp at 14 px and up.
- During a craft: `touch-action: none` and `overscroll-behavior: none` on the game area.

### Engine

- `AlloyMix` is `{[oreId]: parts}` with 2 or 3 ores (D-005), each at least 1 part, summing to the item's parts.
- `createCraft(seed: number, itemId: ItemId, alloy: AlloyMix): CraftState`. The seed moves each target by a whole number of game px, up to ±3, so no two crafts are the same, and seeds the sparks. Heat and grading use no randomness. The game takes the seed from the clock at craft start; the debug API can set it.
- `step(state: CraftState, input: Input): CraftState` advances one fixed step of 16 ms. The game runs as many steps as real time needs (an accumulator), so 90 Hz and 120 Hz screens play the same. `Input` is `{bellows: boolean}`, `{grab: true}`, `{drop: "fire" | "anvil" | "tub"}`, `{strike: {x: number, y: number}}` in close-view game px, or `{none: true}`. `CraftState.location` is `fire`, `anvil`, `held` or `done`. Dropping in the tub is the quench, at that step's temperature.
- Each input is logged with its step number in `state.log`, so a craft replays from seed plus log (GAME-01).
- The screen converts touches. In the wide view, touching the piece sends `{grab}` and releasing it over the fire, anvil or tub sends `{drop}`; anywhere else it returns to where it was. While `held` it cools at the alloy's cool rate. Dropping on the anvil opens the close view. In the close view a lift sends `{strike}` 40 game px above the touch; "Back to the fire" sends `{grab}` then `{drop: "fire"}`, and "Quench" sends `{grab}` and returns to the wide view with the piece held.
- `grade(state): {score, tier, materialQuality, lines: {cause: CauseId, points}[]} | {ruined: true, ruin: "black-strikes" | "white-quench", scrapParts}`. `CauseId` is one of `off-centre`, `wild-strike`, `cold-strike`, `hot-strike`, `repeat-strike`, `missed-target`, `out-of-band`, `burning`, `quench-hot`, `quench-cold`. Per-second and per-°C penalties accrue every step in fractions; each line is rounded to a whole number for display, and the score is max(0, 100 − the sum of the rounded lines), so the shown lines always add up. Lines that round to 0 are not shown.

### Data (starting values to tune; assumptions, not playtested)

- `heat-bands.json`: 6 named bands, by °C, with colour and glow radius in game px. Each band's anchor temperature is its midpoint (`black` 285, `dull-red` 650, `cherry` 825, `orange` 975, `yellow` 1125, `white` 1275). Colour, brightness and glow are interpolated linearly between anchors and held at the end anchors beyond them, so they change continuously with temperature. Light strength follows brightness; spark rate is 0 below 900 °C and rises linearly to 30 per second at 1350; hum pitch rises linearly from 80 Hz at 550 °C to 220 Hz at 1350.
  - `black`: under 550, #2a1418, glow 0
  - `dull-red`: 550–750, #7a2a1a, glow 4
  - `cherry`: 750–900, #b23c1c, glow 8
  - `orange`: 900–1050, #e8682a, glow 12
  - `yellow`: 1050–1200, #f8ae52, glow 16
  - `white`: 1200 and over, #fff2cc, glow 20
  - These colours are new, near the UI_STYLE fire tokens, chosen so each anchor is at least 0.04 brighter in relative luminance; tune with the art.
  - Sparks start at `orange` and their rate rises with heat. A forge hum's pitch rises with heat.
- Heat: the bar starts at 20 °C in the fire. In the fire with the bellows held it rises 250 °C/s, up to 1350. In the fire without the bellows it moves 40 °C/s towards 800, up or down. Out of the fire (`anvil` or `held`) it falls at the alloy's cool rate, down to 20.
- `ores.json`, with placeholder names until Morgan names them:
  - `ore1`: quality 40, working band 800–1150 °C, cool 45 °C/s
  - `ore2`: quality 60, working band 850–1100 °C, cool 60 °C/s
  - `ore3`: quality 85, working band 900–1050 °C, cool 80 °C/s
  - Better ore is harder to work. An alloy's quality, band edges and cool rate are the parts-weighted means of its ores.
- `items.json`: `{id, name, parts, targets: {x, y}[], minutes}` in close-view game px.
  - `horseshoe`: 3 parts, 5 targets, 1 min
  - `knife`: 5 parts, 9 targets, 2 min
  - `sword`: 8 parts, 15 targets, 3 min
  - Targets are spaced evenly along the blade's centre line in the close view, from 20 px inside the tang end to 20 px inside the tip, with exact coordinates fixed in S3 against the close-up art. The default alloy for S2–S4 is `ore2` for all parts but one, and `ore1` for that one (horseshoe 2 + 1, knife 4 + 1, sword 7 + 1).
- `grading.json`:
  - A strike counts for the nearest unstruck target within 9 game px. Off-centre: −1 per game px beyond 3, in fractions, up to −6 per strike (reached at 9 px). No unstruck target within 9 px: −2 (wild strike), or −1 (repeat) if a struck one is within 9 px. (Changed 2026-11-04 at S3 start, Morgan: targets sit 19–22 px apart, so the old 24 px reach overlapped its neighbours.)
  - Cold strike (below the working band): −4. Hot strike (above it): −2. These add to any off-centre points. Each target left unstruck at the quench: −6.
  - Out of band while on the anvil: −2 per second. Burning (`white` band, anywhere): −5 per second.
  - Quench band 780–880 °C; −1 per 25 °C outside it, in fractions.
  - Tiers: Crude 0–39, Common 40–59, Fine 60–74, Superior 75–89, Masterwork 90–100 (D-005).
  - Ruin: the 3rd strike in the `black` band ends the craft at once as `black-strikes`; a quench at 1200 °C or more is `white-quench`. A ruin shows no score lines.
- `hints.json`: one short hint per step (alloy, heat, hammer, quench), shown the first 3 times each step is reached (counted in the save), worded as in the mock-up.

### Debug API

- With `?debug`, `window.__artifice` offers `info()` (scale, visible size, device pixel ratio), `setSeed(n)`, `pinTemp(°C | null)`, `targets()`, `state()` and `pause()` / `advance(ms)` to drive the fixed step from tests. `send(input)` feeds one `Input` to the next step, and `metalBox()` gives the metal's bounding box in screen px. `state()` includes `location`, `temp`, `targets` with a struck flag, and `strikes`. Each slice adds what its checks need. It never ships without `?debug`.

### Screens

- As the approved mock-up: Choose, Alloy (with its refused state), Forge in two views, Result and Ruin, Loading.
- The alloy screen splits the item's parts across up to 3 ores. Start forging is refused until the parts add up to the item's total.
- The hot metal is drawn in code: a blade shape per item, tinted with its band's colour, with its band's brightness and glow radius, sparks from `orange` up, and the forge hum. That gives two cues at every band (D-003).
- "Burning!" shows only in the `white` band.
- Glow: an additive glow sprite at the forge and one on the metal, each scaled and brightened with its heat (the metal's from its band values), with a gentle flicker on the forge. No Phaser lighting or normal maps in the prototype (D-003).

### Save

- `localStorage` key `artifice.save`: `{version: 1, best: {[itemId]: number}, scrap: number, hintsSeen: {[step]: number}}`. `scrap` is a count of mixed-metal parts; it is shown and kept. Ore is unlimited in the prototype (D-005); scrap gets a use with caravans later.
- Written when a craft ends (result or ruin). Hint counts are held in memory during a craft and written with it at the end. A reload mid-craft abandons it.
- If `localStorage` is unavailable, the game runs and says "Progress won't be saved on this device."
- A save with an unknown version or bad JSON is copied to `artifice.save.unreadable` and a fresh save starts.

## Slices

### S1 Skeleton and playtest link

- **Morgan tries:** opens the Vercel preview link on the Pixel. A loading screen, then the item list (horseshoe, knife, sword, "Best: none yet") as in mock-up frame 1: tap a row to select it, then "Forge a knife" (or the selected item) opens a "Forge coming next" placeholder with Back. Adding `?debug` shows the width, height, device pixel ratio and scale in a corner; Morgan reports them. (Changed 2026-11-04 at S1 start: Morgan chose the approved mock-up's full-panel list with select-then-forge over "list over the wide smithy, tap to start".)
- **Checks that fail now:** J1; `src/engine/rng.test.ts`; `src/save/save.test.ts` (read, version, unreadable).
- **Files:**
  - `package.json`, `package-lock.json`, `vite.config.ts` (vitest includes `src/**/*.test.ts` only), `tsconfig.json`, `playwright.config.ts` (builds, then serves `vite preview` on port 4173), `index.html`
  - `src/engine/rng.ts`, `rng.test.ts`; `src/save/save.ts`, `save.test.ts`; `src/data/items.json` (ids, names, parts, minutes; targets come in S3)
  - `src/main.ts` (Phaser config, scale and resize), `src/game/scale.ts`, `scale.test.ts`, `context.ts`, `Boot.ts`, `Choose.ts`; `src/data/items.ts`; `src/ui/` panels, `style.css` (tokens) and `debug.ts` (the debug API's `info()`)
  - `assets/wide.png`: a blade-free edit of the reference wide shot, padded to 400 × 800 (edited locally with `tools/art/`, no credits; loaded in S1, first shown in S2)
  - `assets/fonts/` with Pixelify Sans and Press Start 2P (OFL); `assets/ATTRIBUTION.md`
  - `e2e/open.spec.ts`
  - `.github/workflows/ci.yml`: adds `npm ci`, `npm run check` and `npm run e2e`
  - `AGENTS.md`: local checks, plus the CI-05 override for previews (with `.ai-master.json`)
  - `docs/UI_STYLE.md`: tokens re-sampled from the two reference images in `mockups/forge.html` (the wide shot and the close-up)
  - `docs/playtests/TEMPLATE.md`
  - A Vercel project linked to the repo, with preview protection on
- **Waits on:** Morgan's OK before the OpenArt batch (about 20–40 credits) and before linking Vercel (SAFE-01).

### S2 Heat

- **Morgan tries:** taps Knife (default alloy), holds the bellows and watches the bar heat, glow, spark and hum; lets go and watches it cool; drags it between fire and anvil; sees "Burning!" at white heat. The heat hint shows.
- **Checks that fail now:** J2.
- **Files:** `src/engine/craft.ts` (the full `Input` union, `location`, `createCraft`, `step`; strikes ignored until S3, the tub until S4), `heat.ts`, `heat.test.ts`, `alloy.ts` (the default alloy and weighted means); `src/data/heat-bands.json`, `heat-bands.test.ts`, `ores.json`, `hints.json`; `src/game/Choose.ts` ("Forge a <item>" starts a craft), `Forge.ts` (wide view, bellows, grab and drop, metal drawing, glow sprites, sparks, hum, an fps readout with `?debug`); `assets/sfx/` fire, bellows, hum; ATTRIBUTION; the debug API's `pinTemp`, `pause`, `advance`, `send`, `state`, `metalBox`; `src/save/save.ts` (`hintsSeen`, written at craft end); `e2e/heat.spec.ts`.
- **Waits on:** S1.
- **Settled at S2 start (2026-11-04):** the zero-decision re-check against S1's merged code found 14 open choices. Morgan chose the controls: the mock-up's two buttons ("Hold: bellows"; "To the anvil" / "To the fire") and dragging the bar on the scene both work. Defaults for the rest:
  - An anvil drop in S2 leaves the bar resting on the anvil in the wide view; the close view arrives in S3. A tub drop returns the bar to where it was until S4.
  - `{bellows}` is sticky: it sets the bellows until the next `{bellows}` input, and only works in the fire. The "Hold: bellows" button is disabled, with a reason, while the bar is out of the fire.
  - The heat rates sit in `heat-bands.json` under `heat`, and each item's default alloy is a `defaultAlloy` field in `items.json` (GAME-04). Alloy means are not rounded.
  - The drift to 800 °C without the bellows stops at 800 and doesn't overshoot. The hum is silent below 550 °C.
  - Brightness is the relative luminance of the interpolated colour, mixed per sRGB channel.
  - The background is placed so the fire, anvil and tub sit between the top bar and the panel, as in mock-up frame 3. The top bar shows the steps, with Heat lit.
  - Only "Burning!" shows, and only in the `white` band; mock-up frame 3b's "Too hot / too cold" alert is not built, because it would give the heat away (Risks).
  - Sparks, the glow flicker and the metal are drawn by the screen and advance with engine steps, so `pause()` freezes them. Spark positions come from a generator seeded with the craft's seed. The seed comes from the clock; `setSeed` stays in S3.
  - Sound: the fire and bellows loops are CC0 files from OpenGameArt; the hum is a Web Audio oscillator made in code, so it needs no file.
  - Debug: `pinTemp` overrides the temperature after each step while location still changes, `advance(ms)` carries any part step over, `metalBox()` is in CSS px, and `state()` is null outside the forge. The greyscale check decodes the screenshot in the page, so it needs no new dependency.
  - Hint counts stay in memory until a craft ends (S4), so in S2 the heat hint shows on every craft after a reload. S2 doesn't change `save.ts`.
  - The forge has no way back to the list until S4's result screen; reload to choose again. `e2e/open.spec.ts` changes from the placeholder to the forge.
  - Real time is capped at 250 ms a frame, so a tab returning from the background doesn't run a burst of steps.
  - For S3 (from the S2 review): "Burning!" uses the band from `look()`; S3's burning cause should come from the engine, and the screen should show that flag. `state()` gains `targets` and `strikes` in S3.

### S3 Hammer

- **Morgan tries:** drags the hot knife to the anvil and gets the close-up view; strikes along the blade and sees each strike's points live; taps "Back to the fire" to reheat and returns. The hammer hint shows.
- **Checks that fail now:** J3.
- **Files:** `src/engine/strike.ts`, `strike.test.ts`, `grade.ts` (strike, out-of-band and burning causes, the live total), `determinism.test.ts`; `src/data/items.json` targets, `grading.json` strike values; `src/game/Forge.ts` close view, strike ring, marks, the two buttons; `assets/close.png` (a blade-free edit of the close-up reference, 400 × 800); `assets/sfx/` hammer; ATTRIBUTION; the debug API's `setSeed`, `targets`; `e2e/hammer.spec.ts`. The 3rd black-band strike ends the craft with a placeholder "Ruined" message; the ruin screen comes in S4.
- **Waits on:** S2, and Morgan's OK for the OpenArt edit.

- **Settled at S3 start (2026-11-04):** the zero-decision re-check against S2's merged code found 26 items. Morgan chose the free local edit for `assets/close.png` (`tools/art/deblade_close.py`, no credits) and the 9 px reach (Data → grading.json). Defaults for the rest:
  - Close-view game px are `close.png`'s own px (400 × 800), like the wide view's `wideLayout.ts`. `close.png` is the reference scaled to 360 px wide and centred on 400 × 800 as `tools/art/pad.py` does; the blade line sits at y 390. The screen centres that line between the top bar and the panel.
  - Pieces in the close view are drawn in code at close-up size along the anvil face, tip right: knife 214 px long (x 107–321), sword 320 (x 40–360, over the horn), horseshoe a U of centre-line radius 36 with 34 px legs. Targets lie on each piece's centre line from 20 px inside one end to 20 px inside the other, evenly spaced, rounded to whole px (knife about 22 px apart, sword 20, horseshoe 35), stored in `items.json`. A unit test checks every target lies on its piece.
  - The seed moves each target by whole px in x and y, each drawn as floor(next() × 7) − 3 from `mulberry32(seed)`, x then y, target by target.
  - `CraftState` gains `targets: {x, y, struck}[]`, `strikes: {step, x, y, target, kind: "hit" | "repeat" | "wild", black, lines}[]`, `lost` (per-second causes, in fractions), `burning` (the `white` band) and `ruin: "black-strikes" | null`. `state().strikes` is that list, so the J3 check reads its length.
  - Distance is straight-line, the reach inclusive; ties go to the lower target index. Strikes count only on the anvil; elsewhere they are logged and ignored. A strike is scored at its step's temperature before that step's heat change. Cold and hot apply to hits and repeats; a wild strike misses the metal, so it costs only −2 and doesn't count towards the black-band ruin.
  - The 3rd hit or repeat in the `black` band is scored, then ends the craft: `location` `done`, `ruin` `black-strikes`. A placeholder panel says so with "Forge again" (the same item); S4's ruin screen replaces it.
  - `grade.ts` in S3 gives the live lines (strike causes summed per cause, plus out-of-band and burning, each rounded, zeros hidden) and their total. Missed targets wait for the quench (S4).
  - The screen: an anvil drop (drag or button) shows the close view, with Hammer lit in the top bar. A touch shows the ring 40 game px above it, following the finger; the lift strikes there. Only the first finger strikes; a lift over the panel or off the canvas cancels. Each strike gives sparks, the hammer sound and, on the metal, a dent mark; a struck target loses its dashed square. Its points rise from the strike in the figures face ("−3", or "Clean" when they round to 0) for 0.8 s, advancing with engine steps. A label at the scene's top left reads "Strikes 5 of 9 · −7" (targets struck, live total).
  - The close panel: the mock-up's line "Read the metal: its colour, glow and sparks tell you the heat.", the hammer hint (first 3 crafts that reach the anvil), "Back to the fire" (grab, then drop in the fire) and "Quench", disabled until S4 with the reason "Quenching comes in the next build." The close view has no piece dragging; touches there are strikes. "Burning!" shows from the engine's `burning` flag in both views.
  - Debug: `setSeed(n)` sets the seed for the next craft started (it works outside the forge); `targets()` gives the targets' centres in CSS px with their struck flags; `metalBox()` gives the close piece in the close view. `pinTemp` also holds the temperature before each step, so a strike scores at the pinned heat.
  - `e2e/heat.spec.ts` changes with the close view: the anvil now shows the close panel, so "a drop in empty space returns it" is checked from the fire, and "bellows disabled out of the fire" while the bar is held.
  - Sound: "Blacksmith's Hammer" by VishwaJai, CC0, from OpenGameArt (ATTRIBUTION).
  - Changed 2026-11-04 during S3 (Morgan: the drawn knife didn't look like the art): the finished knife is the concept's own knife, cut out with `tools/art/knife_close.py` at the spot it was painted (x 109–315) as data, tinted with the heat colour, with an untinted dark outline. Its targets follow that knife's centre line, 20–21 px apart. The sword and horseshoe have no concept art, so their finished shapes are drawn outlines.
  - Changed 2026-11-04 during S3 (Morgan chose strict passes): each target takes 2 hits (`grading.json` `passes`), in rounds. A strike counts for the nearest target still open in the round in progress; round 2 opens once every target has its first hit. A second hit on a target in round 1, or any hit once both rounds are done, is a repeat (−1). `CraftState.targets` carry `hits` (0–2) instead of a struck flag; `targets()` in the debug API gives `hits`. The label reads "Round 1 · 5 of 9 · −7" (targets hit this round). For S4: missed-target becomes −3 per missing hit, so a target never hit still costs −6. Per-strike values are unchanged, so a craft has twice the strikes to get right; tune by playtest.
  - Changed 2026-11-04 during S3 (Morgan chose section by section; with rounds, a target's first hit gives the halfway shape and its second the finished one; the halfway shape is every pixel nearer the bar's edge than the finished piece's edge): every piece starts as bar stock along its centre path (half-thickness 5 px, horseshoe 6), as long as the finished piece. Each target owns the pixels nearer to it than to any other target; striking it turns that stretch into the finished shape, so a missed target stays bar at the quench. Visual only: the shape follows the engine's struck flags, with no new rules (`src/game/shapes.ts`). The wide view shows the same worked piece scaled down (knife and sword ×0.45, horseshoe ×0.35), tip left in the fire.

### S4 Quench and grade

- **Morgan tries:** drags the knife to the tub and sees the score, tier, material quality and every point lost; overheats and quenches on purpose to see a ruin and the scrap returned. The quench hint shows.
- **Checks that fail now:** J4.
- **Files:** `src/engine/quench.ts`, `grade.ts` (quench causes, tiers, rounding, floor at 0, ruin, scrap), `grade.test.ts`, `spread.test.ts`; `src/data/grading.json` quench, ruin and tier values; `src/game/Result.ts` (result and ruin; "Choose item" and "Forge another" go back to the list or start the same item); `src/game/Choose.ts` (bests and scrap); `src/save/save.ts` (written at craft end); `assets/sfx/` hiss; `e2e/craft.spec.ts`, `e2e/ruin.spec.ts`.
- **Waits on:** S3.

### S5 Full loop

- **Morgan tries:** the 10-craft test. Mixes alloys from 2- and 3-ore mixes, crafts horseshoes, knives and swords, sees bests survive a reload, and fills in a note in `docs/playtests/` from the template.
- **Checks that fail now:** J5.
- **Files:** `src/game/Alloy.ts` (mixing and its refused state); `src/engine/alloy.ts` (any mix), `alloy.test.ts`; `e2e/loop.spec.ts`.
- **Waits on:** S4.

## Verification

- Every push: `node .claude/master/sync.mjs --check && npm run check`. When screens change, also `npm run e2e`.
- End to end: the slice's Playwright spec, then Morgan on the Pixel through the preview link. Morgan's playtest note is the evidence for "fun" (GAME-06).

## Open questions

- **Ore names:** placeholders `ore1`–`ore3` until Morgan names them.
- **Phaser 4 version:** pin the newest release at least 2 weeks old when S1 starts.
