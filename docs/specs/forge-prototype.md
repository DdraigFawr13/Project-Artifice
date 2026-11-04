# Forge prototype

- **Status:** Draft
- **Planned in:** [design round 1](https://claude.ai/artifact/NA4KTBCDvhGa22LTUzwbDy), [review](https://claude.ai/artifact/4dzk1d8JqTw6gcPtE4p7kQ), art direction ([1](https://claude.ai/artifact/1MpZv8TsgQK6DXwHRtRnNT), [2](https://claude.ai/artifact/LMMZGoVFjiwkUbSt4yBYnH)), [forge mock-up](https://claude.ai/artifact/8MATSEHtmtMVsXEF7X8faQ), [final plan](https://claude.ai/artifact/Dp2hubybfACEV2c8WHrftx), all 2026-11-04. Answers: [planning-answers.md](../design/planning-answers.md). **Decisions:** D-001, D-003, D-004, D-005, D-006.

## Problem

Morgan: "I just always have loved crafting and nothing has ever really scratched the itch of being a crafter properly." Games they played make crafting easy and tier-based, "it didn't really have much by way of quality of the end product except like tiers but it was fairly easy to craft" (CONCEPT.md). The prototype tests whether hands-on smithing, graded by the player's own precision, is fun on its own.

## Goals

- Morgan plays 10 crafts on the Pixel and still wants to forge another, with no shop or caravans (D-005). Only Morgan's recorded playtest notes count (GAME-06).
- Careful and sloppy work with the same alloy give grades at least 25 points apart, and every point lost is shown with its cause.
- Heat is readable without colour: the 6 heat bands differ in brightness in a greyscale screenshot (D-003).
- A craft takes about 1 minute (horseshoe), 2 (knife) or 3 (sword) for a practised player, measured by Morgan's playtest.
- Each slice lands a playable build on a private Vercel preview link (D-006).

## Non-goals

- No shop, commissions, pricing, rarity score, reputation, caravans, patterns, casting, own-item selling or other professions (D-005).
- No final art, no normal-mapped hand-made sprites, no tutorial system, no settings screen, no accounts or cloud saves.
- No landscape layout. No public release.

## Journeys and checks

### J1 Open the game

- **Given** the playtest link on the Pixel 10 Pro XL
- **When** Morgan opens it
- **Then** a loading screen, then the item list over the wide smithy, with the game drawn at a whole-number scale (sharp pixels). **Check:** `e2e/open.spec.ts` at 412 × 915 asserts the canvas scale is an integer and the item list shows 3 items; screenshot saved.

### J2 Heat

- **Given** a bar in the fire
- **When** the player holds the bellows, then lets go
- **Then** the metal's heat rises while held and falls after, and its colour, brightness, glow and sparks follow its heat band; a live light from the metal brightens and dims with it. **Check:** `engine/heat.test.ts` (bellows held 3 s raises heat; released 3 s lowers it); `data/heat-bands.test.ts` (band luminance strictly rises); `e2e/heat.spec.ts` greyscale screenshot of 6 forced bands, mean luminance strictly rising.

### J3 Hammer

- **Given** the hot piece in the close-up anvil view
- **When** the player touches, drags and lifts a finger
- **Then** the strike lands at the ring 48 CSS px above the touch point, at the moment the finger lifts, and counts against the nearest target along the blade; a spark, a sound and a mark answer at once. **Check:** `engine/strike.test.ts` (offset, nearest target, error in game px, cold/hot strike penalties); `e2e/hammer.spec.ts` taps a target and sees the strike counter rise.

### J4 Quench and grade

- **Given** a hammered piece
- **When** the player drags it to the tub and lets go
- **Then** the result screen shows the score out of 100, its tier, and one line per cause whose points add up to 100 minus the score; or the ruin screen with half the metal returned as scrap. **Check:** `engine/grade.test.ts` (lines sum; ruin rules; scrap = parts ÷ 2); `e2e/craft.spec.ts` plays a scripted knife craft to the result screen.

### J5 Full loop

- **Given** a fresh save
- **When** the player mixes an alloy, crafts a knife, then reloads the page
- **Then** the knife's personal best shows on the item list, and the save has a version number. **Check:** `engine/determinism.test.ts` (same seed and input log give the same grade); `save/save.test.ts` (version field; an older version upgrades; an unreadable save is kept, not overwritten, per GAME-05); `e2e/loop.spec.ts`.

## Decisions

- Touch-first web game in portrait, TypeScript, Phaser 4, Vite; 412 px first target; 14 px text and 44 px taps minimum (D-004).
- Rules in a pure engine module with seeded randomness and a fixed step; screens show results only (D-004, GAME-01, GAME-02).
- Scope, steps, items, grading, ruin, saving, hints, reheat, drag-to-quench, no heat gauge, CC0 sound (D-005).
- Ember-night look at 360 × 640 game px, live light from forge and metal, heat readable without colour, AI placeholders, hot metal drawn in code (D-003).
- Private Vercel preview link per slice (D-006).

## Alternatives rejected

- **Godot or Unity:** cloud build sessions can't easily run or screenshot them (design round 1). Would fail when an agent must verify a screen (VER-06).
- **PixiJS:** no maintained official 2D normal-map lighting (research 2026-11-04). Would fail when D-003's live light is built.
- **A heat gauge:** makes reading the metal trivial (mock-up check record). Would fail the "reading the metal" skill (planning-answers.md:11).
- **Material quality in the craft score:** CONCEPT.md keeps rarity = material quality + craft grade, so the craft score shows only the player's work. Would fail when the rarity score arrives in the shop phase and double-counts material.
- **Timing (rhythm) skill:** Morgan didn't pick it (planning-answers.md:11). Quench is a reading call graded on true heat.
- **Saving mid-craft:** a reload could undo a ruin (review r_save).

## Risks

- Touch precision feels unfair → strike on release with an offset ring, tolerances in game px relative to the piece, fixed step; Morgan tunes by playtest notes.
- Phaser 4 lighting is slow on the phone (old forum reports) → only 2 lights; S2 measures frame rate on a production build (VER-06) and falls back to a painted glow if under 50 fps.
- Placeholder art with the blade baked in → S1 and S2 replace backgrounds with blade-free edits (OpenArt, ask Morgan before each batch).
- Data tuning needs many playtests → all numbers live in `src/data/*.json` so tuning never touches code (GAME-04).

## Design

### Layout

```
package.json            # vite, typescript, phaser 4.x (exact pin), vitest, @playwright/test (pinned to the preinstalled version)
index.html
src/engine/             # pure TypeScript, no Phaser, no DOM, no Math.random, no Date
  rng.ts                # seeded PRNG (mulberry32)
  craft.ts              # CraftState, createCraft, step, the input types
  heat.ts strike.ts quench.ts grade.ts alloy.ts
src/data/               # tuning: items.json, ores.json, heat-bands.json, grading.json
src/game/               # Phaser scenes: Boot, Choose, Alloy, Forge (wide and close views), Result
src/save/save.ts        # localStorage, versioned
src/ui/                 # DOM overlay panels (text, buttons) styled from UI_STYLE tokens
assets/                 # images and sounds; assets/ATTRIBUTION.md lists every file's source and licence (SAFE-05)
e2e/                    # Playwright specs at 412 × 915
```

### Engine interface (signatures, not code)

- `createCraft(seed: number, itemId: ItemId, alloy: AlloyMix): CraftState`
- `step(state: CraftState, input: Input, dtMs: 16): CraftState`, a pure fixed step of 16 ms. `Input` is one of `{bellows: boolean}`, `{moveTo: "fire" | "anvil" | "tub"}`, `{strike: {x: number, y: number}}` (game px, already offset), `{quench: true}`, `{none: true}`.
- `heatBand(tempC: number): BandId` reads `heat-bands.json`.
- `grade(state: CraftState): {score: number, tier: TierId, lines: {cause: CauseId, points: number}[]} | {ruined: true, cause: CauseId, scrapParts: number}`
- Every input is logged with its step number in `state.log`, so a craft replays from seed plus log (GAME-01).

### Data (starting values to tune; assumptions, not playtested)

- `heat-bands.json`: 6 bands by temperature in °C: `black` < 550, `dull-red` 550–750, `cherry` 750–900, `orange` 900–1050, `yellow` 1050–1200, `white` ≥ 1200. Each has a colour and a relative luminance that strictly rises.
- `ores.json`: 3 ores with ids `ore1`, `ore2`, `ore3`, placeholder names "Ore 1–3" (Open questions). Each has `quality` (0–100), `workingBand` (a low and high °C), `coolRate` (°C/s).
- `items.json`: `horseshoe` (5 targets, about 60 s), `knife` (9 targets, about 120 s), `sword` (15 targets, about 180 s). Targets are positions along the blade in the close view.
- `grading.json`: off-centre strike −3 per strike beyond 6 game px; working out of band −2 per second; quench outside the quench band −1 per 25 °C; ruin when struck below `black` 3 times or quenched at `white`.
- An alloy mix sets the piece's working band and cool rate as the parts-weighted mean of its ores, and its material quality likewise. Material quality shows on the result screen beside the score, not in it.

### Screens and views

- As the approved mock-up: Choose, Alloy (with refused state), Forge in two views (wide for heat and quench, close side-on anvil for hammer), Result, Ruin, Loading.
- The game canvas is 360 × 640 game px at the largest whole-number scale that fits; the outer 12 px on each side may be cropped (UI_STYLE.md Layout). Panels and text are DOM overlays, so text stays crisp at 14 px+.
- Strike ring sits 48 CSS px above the touch point; the strike lands on lift (D-005).
- During a craft: `touch-action: none` and `overscroll-behavior: none` on the game area.
- Hot metal is drawn in code: a blade shape per item, tinted by its heat band's colour, with brightness and a glow sprite that scale with heat, and a spark emitter whose rate rises with heat (second cue, D-003).
- Lighting: Phaser 4 lighting on the background sprites with one light at the forge and one on the metal. Placeholder backgrounds get flat generated normal maps (an assumption until art arrives).

### Save

- `localStorage` key `artifice.save`, JSON `{version: 1, personalBest: {[itemId]: number}, scrapParts: number}`. Written only between crafts. A save with an unknown future version or bad JSON is copied to `artifice.save.unreadable` and a fresh save starts.

## Slices

### S1 Skeleton and playtest link

- **Morgan tries:** opens the Vercel preview link on the Pixel: loading screen, then the item list (horseshoe, knife, sword, "Best: none yet") over the wide smithy. Taps an item: a placeholder "Forge coming next" screen. Reports the width the page shows in its corner (debug overlay).
- **Checks that fail now:** J1; `engine/rng.test.ts`.
- **Files:** `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`; `src/engine/rng.ts`; `src/data/items.json`; `src/game/Boot.ts`, `Choose.ts`; `src/ui/` panel styles from UI_STYLE tokens; `assets/wide.png` (blade-free edit of the reference wide shot) and `assets/ATTRIBUTION.md`; `e2e/open.spec.ts`; `.github/workflows/ci.yml` adds `npm ci`, `npm run check` (typecheck, vitest) and Playwright; `AGENTS.md` local checks; `docs/UI_STYLE.md` tokens re-sampled from the two reference images in `mockups/forge.html` (the wide shot and the close-up); Vercel project linked to the repo with previews private.
- **Waits on:** none. Asks Morgan before spending OpenArt credits on the blade-free wide shot (about 20–40).

### S2 Heat

- **Morgan tries:** taps Knife, mixes nothing yet (a fixed default alloy), holds the bellows and watches the bar heat, glow and spark; lets go and watches it cool; sees the "too hot" alert when overheating.
- **Checks that fail now:** J2.
- **Files:** `src/engine/craft.ts`, `heat.ts`; `src/data/heat-bands.json`, `ores.json`; `src/game/Forge.ts` (wide view, bellows, metal drawing, lights, sparks); `assets/sfx/` fire and bellows (CC0) and ATTRIBUTION; `e2e/heat.spec.ts`. Measures frame rate on a production build on the Pixel via Morgan, and in Playwright.
- **Waits on:** S1.

### S3 Hammer

- **Morgan tries:** moves the hot knife to the anvil, gets the close-up view, strikes along the blade; strikes off target or when too cold cost points shown live; can go back to the fire and return.
- **Checks that fail now:** J3.
- **Files:** `src/engine/strike.ts`; `src/data/items.json` targets; `src/game/Forge.ts` close view, strike ring, marks; `assets/close.png` (blade-free close-up edit) and ATTRIBUTION; `assets/sfx/` hammer; `e2e/hammer.spec.ts`.
- **Waits on:** S2.

### S4 Quench and grade

- **Morgan tries:** drags the knife to the tub; sees the score, tier and each point lost; overheats and quenches on purpose to see a ruin and the scrap returned.
- **Checks that fail now:** J4.
- **Files:** `src/engine/quench.ts`, `grade.ts`; `src/data/grading.json`; `src/game/Result.ts`; `assets/sfx/` hiss; `e2e/craft.spec.ts`.
- **Waits on:** S3.

### S5 Full loop

- **Morgan tries:** the 10-craft test: mixes alloys from 3 ores, crafts horseshoes, knives and swords, sees personal bests survive a reload, reads the on-screen hints.
- **Checks that fail now:** J5.
- **Files:** `src/engine/alloy.ts`; `src/data/ores.json`, `items.json`; `src/game/Alloy.ts`, `Choose.ts` bests; `src/save/save.ts`; hints in `src/ui/`; `e2e/loop.spec.ts`; `docs/playtests/` note template for Morgan's 10-craft test.
- **Waits on:** S4.

## Verification

- Every push: `node .claude/master/sync.mjs --check && npm run check` (typecheck and vitest), plus `npx playwright test` when screens change.
- End to end: the slice's Playwright spec at 412 × 915, then Morgan on the Pixel via the preview link; Morgan's playtest note is the evidence for "fun" (GAME-06).

## Open questions

- Ore names and their flavour (placeholders "Ore 1–3" until Morgan names them).
- Tier names and score ranges: proposed Crude 0–49, Fine 50–79, Masterwork 80–100 ("Fine" for 74 matches the mock-up).
- Exact Phaser 4 version: pin the newest release at least 2 weeks old when S1 starts.
- Ore stock: is ore limited in the prototype? Scrap from a ruin only matters if it is. Proposed: a starting stock of 20 parts per ore that refills to 20 at the start of each play session, with scrap added back as parts of the same mix.
