# Forge prototype

- **Status:** Draft
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
- **When** it opens at 412 × 915 CSS px with a device pixel ratio of 3.5
- **Then** a loading screen, then the item list over the wide smithy. The game is drawn at a whole-number scale with between 336 and 400 game px visible across. **Check:** `e2e/open.spec.ts` asserts the integer scale, the visible width and 3 item rows, and saves a screenshot.

### J2 Heat

- **Given** a bar in the fire
- **When** the player holds the bellows for 3 s, then lets go for 3 s
- **Then** heat rises while held and falls after, and the metal's colour, brightness, glow radius and spark rate follow its band. **Check:** `src/engine/heat.test.ts` (rise and fall at the rates in Data); `src/data/heat-bands.test.ts` (luminance and glow radius strictly rise across the 6 bands); `e2e/heat.spec.ts` pins each band through the debug hook and checks, in a greyscale screenshot, that the metal's mean brightness strictly rises.

### J3 Hammer

- **Given** the hot piece in the close-up anvil view
- **When** the player touches and lifts a finger
- **Then** the strike lands 40 game px above the touch point at the moment of lift, on the nearest target; a spark, a sound and a mark answer at once, and the strike's points show live. **Check:** `src/engine/strike.test.ts` (nearest target by distance; error in game px; cold, hot and repeat strike penalties); `e2e/hammer.spec.ts` taps 40 game px below a target and sees its mark and the strike counter rise.

### J4 Quench and grade

- **Given** a hammered piece
- **When** the player drags it to the tub and lets go
- **Then** the result screen shows the score, its tier, the material quality beside it, and one line per cause, with score = max(0, 100 − sum of points lost); or the ruin screen with half the metal returned as scrap. **Check:** `src/engine/grade.test.ts` (sum rule, floor at 0, every ruin rule, scrap = parts ÷ 2); `src/engine/spread.test.ts` (scripted careful and sloppy knife crafts with the default alloy differ by 25 points or more); `e2e/craft.spec.ts` plays a scripted knife to the result screen.

### J5 Full loop

- **Given** a fresh save
- **When** the player mixes an alloy, crafts a knife, then reloads the page
- **Then** the knife's best shows on the item list, and the save carries a version. **Check:** `src/engine/determinism.test.ts` (same seed and input log give the same targets and grade; a different seed gives different targets); `src/save/save.test.ts` (version field; unreadable save kept, not overwritten, GAME-05); `e2e/loop.spec.ts`.

## Decisions

- Touch-first web game in portrait; TypeScript, Phaser 4, Vite; 412 px first target; text 14 px and taps 44 px minimum (D-004).
- Rules in a pure engine module with a seeded generator and a fixed step; screens show results only (D-004, GAME-01, GAME-02).
- Scope, steps, items, grading, ruin and scrap, saving, hints, reheating, drag-to-quench, no heat gauge, CC0 sound (D-005).
- Ember Night look, live light from forge and metal, heat readable without colour, AI placeholders, hot metal drawn in code (D-003).
- Private Vercel preview link per slice (D-006). This overrides master rule CI-05's "branch previews off"; the override goes in AGENTS.md and `.ai-master.json`.

## Alternatives rejected

- **Godot or Unity:** cloud build sessions can't easily run or screenshot them (design round 1). Would fail when an agent must check a screen (VER-06).
- **PixiJS:** no maintained official 2D normal-map lighting (research 2026-11-04). Would fail when D-003's live light is built.
- **A heat gauge:** makes reading the metal trivial (mock-up check record). Would fail the "reading the metal" skill (planning-answers.md:11).
- **Material quality inside the craft score:** CONCEPT.md has rarity = material quality + craft grade, so the craft score shows only the player's work. Would double-count material when rarity arrives in the shop phase.
- **Painted glow instead of live lights by default:** D-003 settled live lights. The painted glow is only the fallback under Risks.
- **Fitting the whole 360 px width (×3 on the Pixel):** leaves black bars about 66 physical px wide each side. Cropping to a 336 px safe zone at ×4 fills the screen (UI_STYLE.md Layout).

## Risks

- Touch precision feels unfair → strike on lift, 40 game px above the thumb, tolerances in game px, fixed step; Morgan tunes by playtest notes.
- Phaser 4 lighting is slow on the phone (old forum reports, not checked) → 2 lights only. S2 measures frame rate on a production build in Morgan's playtest; under 50 fps, Morgan decides whether to switch to a painted glow.
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
e2e/                # Playwright at 412 × 915, deviceScaleFactor 3.5, against `vite preview`
docs/playtests/TEMPLATE.md
```

Scripts: `npm run check` runs `tsc --noEmit` and `vitest run`; `npm run e2e` runs Playwright against `vite preview`. CI runs both, plus the drift check, on ready PRs and `main` pushes (CI-06).

### Scale and screen

- Scale `s` = max(1, floor(physical width ÷ 336)), where physical width = CSS width × device pixel ratio. The visible area is (physical width ÷ s) × (physical height ÷ s) game px. On the Pixel (1344 physical px, reported, not checked) that is ×4 and 336 game px across.
- Gameplay stays inside a centred 336 × 640 safe zone. Backgrounds are 400 × 800 game px, so any visible area up to that size is covered. Wider or taller screens show the background colour `--night-0`.
- Panels and text are DOM overlays over the canvas's bottom area, laid out in CSS px, so text stays sharp at 14 px and up.
- During a craft: `touch-action: none` and `overscroll-behavior: none` on the game area.

### Engine

- `createCraft(seed: number, itemId: ItemId, alloy: AlloyMix): CraftState`. The seed jitters each target by up to ±3 game px, so no two crafts are the same, and seeds the sparks. Heat and grading use no randomness.
- `step(state: CraftState, input: Input): CraftState` advances one fixed step of 16 ms. The game runs as many steps as real time needs (an accumulator), so 90 Hz and 120 Hz screens play the same. `Input` is `{bellows: boolean}`, `{moveTo: "fire" | "anvil" | "tub"}`, `{strike: {x: number, y: number}}` in close-view game px, or `{none: true}`. Moving to the tub is the quench, at that step's temperature.
- Each input is logged with its step number in `state.log`, so a craft replays from seed plus log (GAME-01).
- The screen converts touches. In the close view a lift becomes `{strike}` 40 game px above the touch. In the wide view, dragging the piece and releasing over the tub becomes `{moveTo: "tub"}`, over the fire `{moveTo: "fire"}`, and over the anvil `{moveTo: "anvil"}`. While dragging, the piece cools at its air rate.
- `grade(state): {score, tier, materialQuality, lines: {cause: CauseId, points}[]} | {ruined: true, cause: CauseId, scrapParts}`. `CauseId` is one of `off-centre`, `cold-strike`, `hot-strike`, `repeat-strike`, `missed-target`, `out-of-band`, `burning`, `quench-hot`, `quench-cold`.

### Data (starting values to tune; assumptions, not playtested)

- `heat-bands.json`, by °C, with colour and glow radius in game px:
  - `black`: under 550, #30161c, glow 0
  - `dull-red`: 550–750, #64281d, glow 4
  - `cherry`: 750–900, #93341d, glow 8
  - `orange`: 900–1050, #e26328, glow 12
  - `yellow`: 1050–1200, #f7a74e, glow 16
  - `white`: 1200 and over, #fff2cc, glow 20 (this colour is new, not sampled; tune with the art)
  - Sparks start at `orange` and their rate rises with heat. A forge hum's pitch rises with heat.
- Heat: the bar starts at 20 °C. In the fire with the bellows held it rises 150 °C/s, up to 1350. In the fire without the bellows it moves 40 °C/s towards 800. Out of the fire (anvil, dragging) it falls at the alloy's cool rate.
- `ores.json`, with placeholder names until Morgan names them:
  - `ore1`: quality 40, working band 800–1150 °C, cool 45 °C/s
  - `ore2`: quality 60, working band 850–1100 °C, cool 60 °C/s
  - `ore3`: quality 85, working band 900–1050 °C, cool 80 °C/s
  - Better ore is harder to work. An alloy's quality, band edges and cool rate are the parts-weighted means of its ores.
- `items.json`: `{id, name, parts, targets: {x, y}[], minutes}` in close-view game px.
  - `horseshoe`: 3 parts, 5 targets, 1 min
  - `knife`: 5 parts, 9 targets, 2 min
  - `sword`: 8 parts, 15 targets, 3 min
  - Targets are spaced evenly along the blade. The default alloy for S2–S4 is all `ore2`.
- `grading.json`:
  - Off-centre: −3 per strike landing more than 6 game px from its target.
  - Cold strike (below the working band): −4. Hot strike (above it): −2. Repeat strike on a done target: −1. Each target left unstruck at the quench: −6.
  - Out of band while on the anvil: −2 per second. Burning (`white` band, anywhere): −5 per second.
  - Quench band 780–880 °C; −1 per 25 °C outside it.
  - Ruin: 3 strikes in the `black` band, or a quench at 1200 °C or more.
- `hints.json`: one short hint per step (alloy, heat, hammer, quench), shown the first 3 times each step is reached, worded as in the mock-up.

### Screens

- As the approved mock-up: Choose, Alloy (with its refused state), Forge in two views, Result and Ruin, Loading.
- The alloy screen splits the item's parts across up to 3 ores. Start forging is refused until the parts add up to the item's total.
- The hot metal is drawn in code: a blade shape per item, tinted with its band's colour, with its band's brightness and glow radius, sparks from `orange` up, and the forge hum. That gives two cues at every band (D-003).
- "Burning!" shows only in the `white` band.
- Lighting: Phaser 4 lighting on the backgrounds, with one light at the forge and one on the metal whose strength follows its band. Placeholder backgrounds get flat normal maps generated by a small build script (`scripts/flat-normals.mjs`).

### Save

- `localStorage` key `artifice.save`: `{version: 1, best: {[itemId]: number}, scrap: {[oreId]: number}}`.
- Written when a craft starts and when it ends, never during it. A reload mid-craft abandons the craft, and its metal is lost with no scrap, so reloading is never better than a ruin.
- If `localStorage` is unavailable, the game runs and says "Progress won't be saved on this device."
- A save with an unknown version or bad JSON is copied to `artifice.save.unreadable` and a fresh save starts.

## Slices

### S1 Skeleton and playtest link

- **Morgan tries:** opens the Vercel preview link on the Pixel. A loading screen, then the item list (horseshoe, knife, sword, "Best: none yet") over the wide smithy. Tapping an item opens a "Forge coming next" placeholder. Adding `?debug` shows the width, height, device pixel ratio and scale in a corner; Morgan reports them.
- **Checks that fail now:** J1; `src/engine/rng.test.ts`; `src/save/save.test.ts` (read, version, unreadable).
- **Files:**
  - `package.json`, `vite.config.ts`, `tsconfig.json`, `playwright.config.ts`, `index.html`
  - `src/engine/rng.ts`; `src/save/save.ts`; `src/data/items.json`
  - `src/game/Boot.ts`, `Choose.ts`; `src/ui/` panels and `debug.ts`
  - `assets/wide.png`: a blade-free edit of the reference wide shot, padded to 400 × 800
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
- **Files:** `src/engine/craft.ts` (the full `Input` union, `createCraft`, `step`, heat only), `heat.ts`, `alloy.ts` (default alloy and the weighted means); `src/data/heat-bands.json`, `ores.json`, `hints.json`; `src/game/Forge.ts` (wide view, bellows, drag, metal drawing, lights, sparks, hum); `scripts/flat-normals.mjs`; `assets/sfx/` fire, bellows, hum; ATTRIBUTION; `e2e/heat.spec.ts`; a debug hook `?debug&band=<id>` that pins the metal's band.
- **Waits on:** S1.

### S3 Hammer

- **Morgan tries:** drags the hot knife to the anvil and gets the close-up view; strikes along the blade and sees each strike's points live; drags back to the fire to reheat and returns. The hammer hint shows.
- **Checks that fail now:** J3.
- **Files:** `src/engine/strike.ts`, `grade.ts` (strike and out-of-band causes, the live total); `src/data/items.json` targets, `grading.json` strike values; `src/game/Forge.ts` close view, strike ring, marks; `assets/close.png` (a blade-free edit of the close-up reference, 400 × 800); `assets/sfx/` hammer; ATTRIBUTION; `e2e/hammer.spec.ts`.
- **Waits on:** S2, and Morgan's OK for the OpenArt edit.

### S4 Quench and grade

- **Morgan tries:** drags the knife to the tub and sees the score, tier, material quality and every point lost; overheats and quenches on purpose to see a ruin and the scrap returned. The quench hint shows.
- **Checks that fail now:** J4.
- **Files:** `src/engine/quench.ts`, `grade.ts` (quench and burning causes, tiers, floor at 0, ruin, scrap); `src/data/grading.json` quench, ruin and tier values; `src/game/Result.ts` (result and ruin); `src/save/save.ts` (best and scrap written at craft end); `assets/sfx/` hiss; `src/engine/spread.test.ts`; `e2e/craft.spec.ts`.
- **Waits on:** S3, and Morgan's answer on tiers.

### S5 Full loop

- **Morgan tries:** the 10-craft test. Mixes alloys from 3 ores, crafts horseshoes, knives and swords, sees bests survive a reload, and fills in a note in `docs/playtests/` from the template.
- **Checks that fail now:** J5.
- **Files:** `src/game/Alloy.ts` (mixing and its refused state); `src/engine/alloy.ts` (any mix); `src/game/Choose.ts` (bests); `src/save/save.ts` (write at craft start, ore stock if Morgan chooses one); `e2e/loop.spec.ts`.
- **Waits on:** S4, and Morgan's answer on ore stock.

## Verification

- Every push: `node .claude/master/sync.mjs --check && npm run check`. When screens change, also `npm run e2e`.
- End to end: the slice's Playwright spec, then Morgan on the Pixel through the preview link. Morgan's playtest note is the evidence for "fun" (GAME-06).

## Open questions

- **Ore names:** placeholders `ore1`–`ore3` until Morgan names them.
- **Tiers:** proposed Crude 0–49, Fine 50–79, Masterwork 80–100. "Fine" for 74 matches the mock-up. Needed before S4.
- **Ore stock:** is ore limited in the prototype? Unlimited ore means scrap only adds back to a counter; limited ore makes ruins cost something. Needed before S5.
- **Phaser 4 version:** pin the newest release at least 2 weeks old when S1 starts.
