# Forge depth pass

- **Status:** Draft
- **Planned in:** [ideas page](https://claude.ai/artifact/KTpAvi8EfJSm6UBfaerknz), [round 1](https://claude.ai/artifact/K4G53fSfXyj7K3ovUrk2ZQ) (collection `depth1`), [round 2](https://claude.ai/artifact/T9No24JSVbtoPS2rLXhAE3) (`depth2`; Morgan: "Go with all recommended and continue", 2026-11-05). **Decisions:** D-001, D-003, D-005; the depth-pass decision is added on approval. Builds on [forge-prototype.md](forge-prototype.md) (shipped S1–S5).

## Problem

After the 10-craft test (`docs/playtests/2026-11-04-s5-loop.md`, 6 crafts), Morgan was "unsure" about forging another: "It's fun enough for this portion of the game but it needs to have more depth I think", and crafts were "Honestly way shorter than" the 1, 2 and 3 minute goal. More depth "would feel more like I'm actually shaping the bar and making something real. It would have like the ore really matter to stats of the item and how it looks. It would feel more like I am crafting it." Today a strike is only aim and heat, every ore plays alike apart from its band and cool rate, and the finished piece is a score with nothing to show for it.

## Goals

- After the pass, Morgan reruns the 10-craft test and wants to forge another, with no shop or caravans (CONCEPT.md kill criteria; round 2 `c_done`). Only Morgan's playtest notes count (GAME-06).
- Every strike asks for aim, heat and force; a knife with no strikes scores 10 (Crude), not 46.
- The alloy changes what the player does (slag, handling) and what comes out (stats, look): two mixes crafted equally well give different stat cards.
- The craft can't be solved once: the working heat moves ±20 °C each craft, and the hammer's sound tells the player where it is.
- Crafts get longer through new steps (slag, grind), not more of the same targets. The 1, 2 and 3 minute goal stays a guide; fun matters more (round 1 `q_time`).

## Non-goals

- No shop, commissions, prices, rarity score or reputation (D-005; the kill test is "without the shop").
- No new items, no casting, no folding, no tools or upgrades, no art spend.
- Stats don't enter the score out of 100 (round 2 `st_score`; D-005 keeps material out of the score).
- A bad grind never ruins the piece (round 2 `g_ruin`).

## Journeys and checks

### J1 Missed hits, varied metal, faster cooling (S1)

- **Given** a knife with seed 42 and the default mix
- **When** it is quenched at 830 °C with no strikes; and when two crafts start with different seeds
- **Then** the score is 10 (18 missing hits × −5); each craft's working band is the alloy's band moved by the same whole number of °C, between −20 and +20, drawn from the seed; Ore 2 cools at 78 °C/s. **Check:** `src/engine/depth.test.ts` (score 10; band shift range, determinism, and that target positions for seed 42 are unchanged); `alloy.test.ts` cool means updated; `e2e/craft.spec.ts` "no strikes" case shows 10, Crude.

### J2 Hear the heat, Perfect, the streak (S1)

- **Given** a knife on the anvil
- **When** strikes land in the working heat, below it and above it, one dead centre
- **Then** the hammer plays at rate 1.0 in band, 1.25 below, 0.8 above; a strike within 1 px in band shows "Perfect" and plays a second, quiet ring at rate 1.5; after 3 clean strikes in a row the label adds "· Clean ×3". **Check:** `depth.test.ts` (`perfect` flag, `cleanStreak`); `e2e/depth.spec.ts` reads the last strike's sound rate from the debug API's `lastSound()` and the popup text.

### J3 Strike force (S2)

- **Given** a knife on the anvil at a pinned temperature
- **When** strikes land with force 0.1, the right force and 1.0, hot and cold
- **Then** a too-light strike doesn't take (no hit, no points); the right force hits; a too-hard strike costs −2 ("hard-strike") and, below the working band, counts towards cracking. **Check:** `src/engine/force.test.ts` (ideal force at the band edges and middle, the ±0.15 window, light, hard, cracking); `e2e/depth.spec.ts` holds a touch for 0.6 s and sees force 1 in `state().strikes`.

### J4 Slag (S3)

- **Given** a knife with the default mix (3 slag spots)
- **When** the player strikes a target beside a slag spot, then strikes the slag, then the target
- **Then** the first strike is blocked (−1, no hit), the slag clears with a puff, the target then takes the hit; each spot left at the quench costs −3 ("N slag spots left"). **Check:** `src/engine/slag.test.ts` (count per mix, placement, blocking, clearing, the quench line); `e2e/depth.spec.ts` clears a spot through a real tap.

### J5 Blade stats and ore traits (S4)

- **Given** two knives crafted with the same scripted strikes, one Ore 1-heavy and one Ore 3-heavy
- **When** both are quenched
- **Then** each result shows a stat card (Edge, Toughness, Balance; bar, word and one line on what helped or hurt), and the Ore 3 knife has the higher Edge and the lower Toughness; the item list keeps the best of each stat across a reload. **Check:** `src/engine/stats.test.ts`; `src/save/save.test.ts` (v1 upgrades to v2); `e2e/depth.spec.ts` (stat card text, best stats after reload).

### J6 Ore look (S5)

- **Given** a finished knife of a mix
- **When** the result opens
- **Then** the finished piece is drawn above the score in the mix's sheen colour (a parts-weighted blend of the ores' `sheen`), and on the anvil a cooling piece fades from the heat colour to the sheen between 550 and 300 °C. **Check:** `src/data/sheen.test.ts` (blend); `e2e/depth.spec.ts` samples the result piece's pixel colour for two mixes and finds them different, within 12 of each expected RGB value per channel.

### J7 Grind (S6)

- **Given** a quenched knife (not ruined)
- **When** the player drags the whetstone along the edge twice
- **Then** a steady, even stroke gives a higher grind than a wavy or jerky one; Edge mixes hammer work and grind half and half; the score is unchanged; the horseshoe skips the grind. **Check:** `src/engine/grind.test.ts`; `e2e/depth.spec.ts` drags two strokes through real touches and sees the result.

## Decisions

- Scope: the 11 ideas in round 1 `p_*`, built as one pass in the order below, with a quick playtest after S3 (round 2 `o_split`, `o_order`). Recorded in DECISIONS on approval.
- Every rule lives in the engine; screens show results (GAME-02). Every number is data in `src/data/*.json` (GAME-04). New randomness comes from new seeded streams, so the S3 target positions for a seed stay as they are (GAME-01).
- Mock-ups first: S2–S6 each change a screen or a control, so each starts with its frame in `mockups/depth.html`, made with `ui-mockups` and approved by Morgan before code.

## Alternatives rejected

From the round 1 and 2 forms (Morgan picked the recommended option each time):

- **Pull-back or tap-speed force:** fights the 40 px strike offset and phone touch timing. Would fail when drags get read as aim.
- **A fixed force sweet spot, or targets that show their force:** the first is solved once; the second is a gauge (D-005 has no heat gauge).
- **Wrong force as points only, or a hard strike finishing a spot:** the first adds penalty lines without changing play; the second skips the 2-round rule.
- **Slag in material quality only:** material quality changes nothing in the prototype, so slag would carry no stake.
- **Slag any time before the quench:** loses the clear first phase that lengthens a craft with a new task.
- **Stats in the score:** rewrites grading and D-005, and breaks every best so far.
- **Ore look from work marks, or no look:** marks need art; no look misses Morgan's "how it looks".
- **Tap or hold grinding:** a drag along the edge reads as grinding and measures steadiness.
- **Split pass (S1–S3, test, S4–S6):** Morgan chose one pass with a quick test after S3.

## Risks

- Too much at once on a phone (aim, heat, force, slag) → slices land one at a time on the preview; the quick playtest after S3 can cut or tune before stats.
- Force read from heat feels arbitrary → the ideal force is a straight line across the working band (data), and "Too light" / "Too hard" show at once.
- Stat formulas feel random → each stat comes from named parts of the craft, the card names what hurt it most, and every weight is data to tune by playtest.
- Grind is fiddly by finger → strokes are judged by mean distance from the edge line and speed evenness, with generous starting weights; it can't ruin the piece.
- S1 mixes seven ideas → each is data or feedback only; the risky ones (force, slag, stats, grind) have their own slices.

## Design

### Data (starting values to tune; assumptions, not playtested)

- `grading.json`: `missedHit` 3 → 5. New: `metal: {bandShiftC: 20}`; `force: {fullHoldS: 0.6, idealAtHigh: 0.3, idealAtLow: 0.8, min: 0.15, max: 0.95, window: 0.15, hard: 2}`; `slag: {blocked: 1, left: 3}`; `perfectPx: 1`; `streakShowAt: 3`.
- `ores.json`, per ore (Ore 1 / Ore 2 / Ore 3): `cool` 58.5 / 78 / 104 (+30%); `slagPerPart` 0.8 / 0.5 / 0.2; `stats` multipliers `{edge, toughness, balance}` {0.85, 1.15, 1} / {1, 1, 1} / {1.15, 0.85, 1}; `sheen` "#8a8f96" / "#a9b0b8" / "#c9d4e6"; `name` from the approval page (L6).
- `items.json`: `stats` per item (horseshoe ["toughness", "balance"]; knife and sword all three); `grind` true for knife and sword; `edgeLine: {x0, y0, x1, y1}` in close-view px along each blade's cutting edge, fixed in S6 against `close.png` (assumption: knife about y 393, x 129–300).
- `stats.json` (new): `edge: {perPx: 10}`; `toughness: {perSecond: 4, perDegrees: 5, perCrack: 10}`; `balance: {perMissing: 3, perSlag: 15, perSpreadPx: 2}`; `grind: {perPx: 8, perCv: 60, minCover: 0.8, strokes: 2, minPoints: 5, share: 0.5}`; `words` per stat for the tier bands 0/40/60/75/90: Edge Dull, Fair, Sharp, Keen, Razor; Toughness Brittle, Fair, Sound, Sturdy, Unyielding; Balance Clumsy, Fair, Steady, True, Perfect.
- `hints.json`: `force` ("Hold longer to strike harder. Hot metal wants a light touch."), `slag` ("Knock out the dark slag first. The spots beside it won't shape until it's gone."), `grind` ("Drag the stone along the edge, steady and even.").

### Engine

- `createCraft` adds `bandShiftC` (an integer, `round((next() × 2 − 1) × bandShiftC)` from `mulberry32(seed ^ 0xba5d)`) to `props.bandLowC` and `props.bandHighC`, and stores it. It places slag: `count = min(targets − 1, round(Σ parts × slagPerPart))`, in distinct gaps between neighbouring targets chosen with `mulberry32(seed ^ 0x51a6)`, each at the midpoint of its two targets (after their seed shift), rounded. `CraftState.slag: {x, y, gap, cleared}[]`.
- `Input` `{strike: {x, y, force?}}`: `force` in [0, 1]. The ideal force at temperature T is `idealAtLow + (idealAtHigh − idealAtLow) × (T − bandLowC) / (bandHighC − bandLowC)`, clamped to [min, max]. A strike within `window` of it is right; below is light; above is hard. A missing `force` means the ideal force, so S1–S5 checks and older scripted crafts keep their meaning.
- Strike order: the nearest uncleared slag spot or open target within the reach takes the strike, ties to the target. A light strike changes nothing and costs nothing (kind `light`). A strike on slag clears it (kind `slag`, no points). A strike that would count for a target next to an uncleared spot is kind `blocked`: −1 `blocked-strike`, no hit. A hard strike adds −2 `hard-strike`; a hard strike below the working band is a cracking strike, as a hit or repeat in the `black` band is. The 3rd cracking strike ends the craft as today (`ruin` stays `black-strikes`; the ruin line becomes "3 cracking strikes: on black metal, or too hard on cold metal.").
- `Strike` gains `force`, `kind` (`hit`, `repeat`, `wild`, `light`, `slag`, `blocked`), `perfect` (hit, within `perfectPx`, in band, right force) and `crack`. `cleanStreak(state)` counts the latest strikes in a row whose lines sum to 0 and that hit or cleared slag.
- `CauseId` gains `hard-strike`, `blocked-strike` and `slag-left` (at the quench, `left` per uncleared spot, count = spots).
- Grind: for items with `grind`, a `{drop: "tub"}` that doesn't ruin sets `location` to `grind` (not `done`). Input `{stroke: {x, y}[]}` (close-view px, one point per engine step of the drag, sent at lift); strokes under `minPoints` points are ignored. A stroke's score is `clamp(100 − perPx × mean distance from the edge line − perCv × coefficient of variation of point-to-point distances, 0, 100) × min(1, cover ÷ minCover)`, where cover is the stroke's length along the edge ÷ the edge's length. After `strokes` strokes, `location` becomes `done` and `grindScore` is their mean. No heat changes in `grind`.
- `grade(state)` adds `stats: {[stat]: {value, word, why}}` for a finished craft. Work per stat, then × the alloy's parts-weighted `stats` multiplier, rounded, clamped 0–100:
  - Edge = 100 − `perPx` × the mean off-centre px beyond `centrePx` over hits; with a grind, `(1 − share) × that + share × grindScore`.
  - Toughness = 100 − `perSecond` × out-of-band seconds − |quenchC − 830| ÷ `perDegrees` − `perCrack` × cracking strikes.
  - Balance = 100 − `perMissing` × missing hits − `perSlag` × slag left − `perSpreadPx` × (largest − smallest mean off-centre px across targets).
  - `why` names the biggest deduction ("hurt most by 4 off-centre strikes") or, with none, the ore trait that raised it ("helped by Ore 3's keen edge").

### Screens

- Close view (S2): a ring that fills clockwise over `fullHoldS` while the finger is down; at lift the strike carries `force`. "Too light" / "Too hard" / "Perfect" rise as the points do (S3 popups). Slag spots are dark pits on the bar (S3); a clearing strike gives a puff of grey scale particles.
- Sound (S1): the hammer at rate 1.0 in band, 1.25 below (a sharp clank), 0.8 above (a dull thud); Perfect adds a second hammer play at rate 1.5 and volume 0.3. No new sound files.
- Result (S4, S5): a stat card under the score lines, one row per stat the item uses: name, a bar, the word, the `why` line; the finished piece above the score, drawn from the worked shape in the sheen colour (S5). The item list row adds the best stats ("Edge Keen · Toughness Sound") once any exist.
- Grind view (S6): the close view with the cooled piece, a whetstone sprite drawn in code that follows the finger, sparks along the stroke, the panel line "Stroke 1 of 2". After the 2nd stroke, 0.8 s, then the result.
- Mock-ups: frames `f-force`, `f-slag`, `f-result-stats`, `f-list-stats`, `f-result-piece`, `f-grind` in `mockups/depth.html`, each approved before its slice.

### Save

- Version 2: adds `bestStats: {[itemId]: {[stat]: number}}` (the best of each stat separately, round 2 `st_best`). A v1 save upgrades on load with `bestStats: {}` (GAME-05); an unknown version is kept aside as today.

### Debug API

- `send()` takes the new inputs; `state()` includes `bandShiftC`, `slag`, strike `force` / `kind` / `perfect` / `crack`, and `grindScore`; `lastSound()` gives the last sound's key and rate; `edgeLine()` gives the edge line in CSS px (S6).

## Slices

### S1 Quick bundle

- **Morgan tries:** a knife with no strikes scores 10 (Crude); the working heat moves between crafts and the hammer's clank or thud tells where it is; crafts need the fire more often; "Perfect" on a dead-centre strike; "Clean ×N"; the ores' new names.
- **Checks that fail now:** J1, J2.
- **Files:** `src/data/grading.json`, `ores.json` (cool, names); `src/engine/craft.ts` (band shift, `perfect`), `strike.ts`, new `src/engine/depth.test.ts`; `src/game/Forge.ts` (sound rate, Perfect, streak label); `src/ui/forge.ts` (label); `src/ui/debug.ts` (`lastSound`); updated `alloy.test.ts`, `spread.test.ts`, `e2e/craft.spec.ts` (46 → 10); new `e2e/depth.spec.ts`.
- **Waits on:** Morgan's ore names (approval page).

### S2 Strike force

- **Morgan tries:** holding fills the ring; light strikes don't take, hard ones cost and crack cold metal; reading the heat now sets the force.
- **Checks that fail now:** J3; J2's Perfect gains the force condition.
- **Files:** `mockups/depth.html` `f-force` first; `src/engine/strike.ts`, `craft.ts`, `src/data/grading.json`, `hints.json`; new `src/engine/force.test.ts`; `src/game/Forge.ts` (hold timing, ring fill); `src/ui/result.ts` (ruin wording); `e2e/depth.spec.ts`; ruin specs' wording.
- **Waits on:** S1.

### S3 Slag in the bar

- **Morgan tries:** dark pits on the bar, more with cheaper ore; spots beside them won't shape until they're knocked out; slag left shows on the result. Then a quick playtest (a short form).
- **Checks that fail now:** J4.
- **Files:** `mockups/depth.html` `f-slag` first; `src/engine/craft.ts`, `strike.ts`, `grade.ts`, `src/data/ores.json`, `grading.json`, `hints.json`; new `src/engine/slag.test.ts`; `src/game/Forge.ts` (pits, puff); `src/ui/result.ts` (line wording); `e2e/depth.spec.ts`.
- **Waits on:** S2.

### S4 Blade stats and ore traits

- **Morgan tries:** a stat card on every result; an Ore 3 knife comes out keener but more brittle than an Ore 1 knife; best stats on the item list after a reload.
- **Checks that fail now:** J5.
- **Files:** `mockups/depth.html` `f-result-stats`, `f-list-stats` first; new `src/data/stats.json`, `src/engine/stats.ts`, `stats.test.ts`; `grade.ts`; `src/data/ores.json`, `items.json`; `src/save/save.ts` (v2), `save.test.ts`; `src/game/Forge.ts`, `Result.ts`; `src/ui/result.ts`, `choose.ts`; `e2e/depth.spec.ts`.
- **Waits on:** S3, and the quick playtest's notes.

### S5 Ore look

- **Morgan tries:** a cooled piece shows its metal's colour on the anvil; the result shows the finished piece in that colour; different mixes look different.
- **Checks that fail now:** J6.
- **Files:** `mockups/depth.html` `f-result-piece` first; `src/data/ores.json` (`sheen`), `heatBands.ts` or a new `src/data/sheen.ts`, `sheen.test.ts`; `src/game/Forge.ts` (tint below 550 °C); `src/game/Result.ts`, `src/ui/result.ts` (piece image); `e2e/depth.spec.ts`.
- **Waits on:** S4.

### S6 Grind and finish

- **Morgan tries:** after the quench, two strokes of the whetstone along the knife's edge; a steady grind gives a keener edge; the horseshoe skips it.
- **Checks that fail now:** J7.
- **Files:** `mockups/depth.html` `f-grind` first; `src/engine/craft.ts` (`grind` location, `stroke`), new `src/engine/grind.ts`, `grind.test.ts`; `stats.ts`; `src/data/items.json` (`grind`, `edgeLine`), `stats.json`, `hints.json`; `src/game/Forge.ts` (grind view, stone, sparks); `src/ui/forge.ts` (panel); `src/ui/debug.ts` (`edgeLine`); `e2e/depth.spec.ts`; quench checks that now reach the grind first.
- **Waits on:** S5.

Then Morgan reruns the 10-craft test with the playtest form.

## Verification

- Every push: `node .claude/master/sync.mjs --check && npm run check`. When screens change, also `npm run e2e` (AGENTS.md).
- End to end: each slice's checks in `e2e/depth.spec.ts`, then Morgan on the Pixel through the preview link; Morgan's playtest notes are the evidence for fun (GAME-06).

## Open questions

- **Ore names (L6):** Morgan picks a set on the approval page before S1.
- **Stat and grind weights:** starting values above, tuned by playtest.
