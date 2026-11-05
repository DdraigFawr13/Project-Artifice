# Forge depth pass

- **Status:** Draft
- **Planned in:** [ideas page](https://claude.ai/artifact/KTpAvi8EfJSm6UBfaerknz) (idea ids L1–L10, M1–M10, H1–H10), [round 1](https://claude.ai/artifact/K4G53fSfXyj7K3ovUrk2ZQ) (database collection `depth1`), [round 2](https://claude.ai/artifact/T9No24JSVbtoPS2rLXhAE3) (`depth2`; Morgan, 2026-11-05: "Go with all recommended and continue"). Answer ids such as `q_miss` are those collections' document ids; the answers are restated where used. **Decisions:** D-001, D-003, D-005; the depth-pass decision is added on approval. Builds on [forge-prototype.md](forge-prototype.md), whose slices are cited as "prototype S1"–"prototype S5"; slices here are "S1"–"S6".

## Problem

After the 10-craft test (`docs/playtests/2026-11-04-s5-loop.md`, 6 crafts), Morgan was "unsure" about forging another: "It's fun enough for this portion of the game but it needs to have more depth I think", and crafts were "Honestly way shorter than" the 1, 2 and 3 minute goal. More depth "would feel more like I'm actually shaping the bar and making something real. It would have like the ore really matter to stats of the item and how it looks. It would feel more like I am crafting it." Today a strike is only aim and heat, ores differ only in band, cool rate and quality, and the finished piece is a score with nothing to show for it.

## Goals

- After the pass, Morgan reruns the 10-craft test and wants to forge another, with no shop or caravans (CONCEPT.md kill criteria; `c_done`: "judged by rerunning the 10-craft test"). Only Morgan's playtest notes count (GAME-06).
- Every strike asks for aim, heat and force; a knife with no strikes scores 10 (Crude), not 46.
- The alloy changes what the player does (slag) and what comes out (stats, look): two different mixes crafted the same way give different stat cards and different colours.
- The craft can't be solved once: the working heat moves by up to ±20 °C each craft, and the hammer's sound after each strike says whether it landed below, in or above it.
- Crafts get longer through new steps (slag, force, grind), not more targets. Estimate, not measured: a practised knife gains about 30–45 s (3 slag strikes, 18 holds of about 0.3 s, 2 grind strokes, more trips to the fire). The 1, 2 and 3 minute goal stays a guide (`q_time`).

## Non-goals

- No shop, commissions, prices, rarity score or reputation (D-005; the kill test is "without the shop").
- No new items, casting, folding, tools or upgrades, and no art spend.
- Stats don't enter the score out of 100 (`st_score`), and the grind changes Edge only, never the score.
- A bad grind never ruins the piece (`g_ruin`).

## Journeys and checks

Each check below fails at the commit the slice starts from, except lines marked *guard*, which already pass and must stay passing.

### J1 Missed hits, varied metal, faster cooling (S1)

- **Given** a knife with seed 42 and the default mix (Ore 2 × 4, Ore 1 × 1)
- **When** it is quenched at 830 °C with no strikes; and when crafts start with different seeds
- **Then** the score is 10 (18 missing hits × −5) and the tier Crude (until S3, which adds 3 slag spots × −3 to this knife, making it 1); the working band is the alloy's band moved by `bandShiftC`, a whole number from −20 to 20 drawn from the seed; Ore 2 cools at 78 °C/s; `state().rulesVersion` is 2. **Check:** new `src/engine/depth.test.ts` (score 10; shift range over 200 seeds, same seed same shift; *guard*: target positions for seed 42 unchanged); updated tests that pin −3 or 46 (listed in S1).

### J2 Hear the heat, Perfect, the streak (S1)

- **Given** a knife on the anvil, paused, temperature pinned
- **When** a strike lands below the shifted band, one in it, one above it, and one within 1 px of a target in it
- **Then** each strike records `heat` `cold` / `in` / `hot`, and `lastSound()` gives the hammer's rate 1.25 / 1.0 / 0.8; the 1 px strike records `perfect`, its popup reads "Perfect", and `lastSound().perfect` is true; after 3 strikes in a row that each lost 0 (rounded), the label ends "· Clean ×3". **Check:** `depth.test.ts` (`heat`, `perfect`, `cleanStreak`); new `e2e/depth.spec.ts`.

### J3 Strike force (S2)

- **Given** a knife on the anvil, paused, temperature pinned
- **When** strikes are sent with force 0.05, the ideal force and 1.0, in band and below it; and a touch is held while 640 ms of engine time advances (40 steps)
- **Then** the light strike records kind `light`, no hit and no lines; the ideal one hits (*guard*: it already hits); the 1.0 strike adds `hard-strike` −2, and below the band also `crack`; three cracking strikes end the craft as `cracked`; the held touch strikes with force 1. **Check:** new `src/engine/force.test.ts`; `e2e/depth.spec.ts` (hold through `pause()` / `advance()`).

### J4 Slag (S3)

- **Given** a knife with the default mix: 3 slag spots
- **When** the player strikes a target next to a spot, then the spot, then the target
- **Then** the first strike is kind `blocked` (−1, no hit), the spot clears with a puff, the target then takes the hit; each spot left at the quench costs −3 in a line "N slag spots left". **Check:** new `src/engine/slag.test.ts` (count per mix, placement, reach, blocking, clearing, the quench line); `e2e/depth.spec.ts` clears a spot through a real press 40 game px below its `slag()` position (converted with `strikeAt`'s CSS-to-game scale in `e2e/hammer.spec.ts`), held for the ideal force with `advance()`.

### J5 Blade stats and ore traits (S4)

- **Given** ended crafts built by hand in a unit test (state objects, not `createCraft`) with the same targets, strikes, slag and quench, differing only in mix
- **When** `statsFor(state)` runs on each
- **Then** a knife of Ore 1 × 4 + Ore 2 × 1 and one of Ore 3 × 4 + Ore 2 × 1 have stat cards (Edge, Toughness, Balance) where the Ore 3 card has the higher Edge and the lower Toughness; a sword of Ore 1 × 4 + Ore 3 × 4 and the default sword (Ore 2 × 7 + Ore 1 × 1) differ in Balance; on screen the result shows the card, and the item list shows the best of each stat after a reload. **Check:** new `src/engine/stats.test.ts`; `src/save/save.test.ts` (v1 upgrades to v2); `e2e/depth.spec.ts`.

### J6 Ore look (S5)

- **Given** a finished knife of the default mix and one of Ore 1 × 1, Ore 2 × 2, Ore 3 × 2
- **When** each result opens
- **Then** the finished piece is drawn above the score in its mix's sheen; both test crafts clear every slag spot and then strike every target twice, so the piece is fully worked; the most common opaque colour of each drawing is within 8 per channel of the sheen × the finished raster's most common shade (measured from `shapes.ts` in S5 and written into the test), and the two drawings differ by at least 30 in some channel (worked out from the sheens: 51 apart in red before shading, about 45 after a shade near 0.88). **Check:** new `src/data/sheen.test.ts` (blend); `e2e/depth.spec.ts` reads `getImageData` from the `result-piece` canvas.

### J7 Grind (S6)

- **Given** a knife quenched at 830 °C (not ruined)
- **When** the player makes two strokes along the edge through the real drag control, once straight and even, once wavy
- **Then** the craft waits in `grind` until 2 strokes, `grindScore` is higher for the straight pair, Edge blends hammer work and grind half and half; *guard*: the score is the same as without the grind, and a horseshoe goes from the quench straight to the result. **Check:** new `src/engine/grind.test.ts`; `e2e/depth.spec.ts`.

## Decisions

- Scope: the 11 ideas Morgan set to Now in round 1 (L1, L2, L3, L4, L6, L7, L8, M1, M3, M5, H3), as one pass in the order below, with a quick playtest after S3 (`o_split`, `o_order`). Recorded in DECISIONS on approval.
- Every rule lives in the engine; screens show results (GAME-02). Every number is data in `src/data/*.json` (GAME-04). New randomness comes from new seeded streams, so prototype S3's target positions for a seed don't move (GAME-01). `CraftState.rulesVersion` is 2 for the whole pass, so a replay knows its rules; no replay logs are saved, so none from version 1 have to play back.
- The hammer's sound tells where a strike landed against the working heat, after the strike (`q_vary`). It's feedback, like the points popup that already shows "on metal too cold"; D-005's "no heat gauge" is about reading the heat before acting.
- On approval, D-005 is updated in the same change (SRC-04): the craft gains force, slag, stats, the ore look and a grind after the quench.
- Mock-ups first: S2–S6 change a screen or a control, so each starts with its frame in `mockups/depth.html`, made with `ui-mockups` and approved by Morgan before code.

## Alternatives rejected

Round 1 and 2 options Morgan didn't pick:

- **Pull-back or tap-speed force:** fights the 40 px strike offset and phone touch timing. Would fail when drags get read as aim.
- **A fixed force sweet spot, or targets that show their force:** the first is solved once; the second is a gauge (D-005).
- **Wrong force as points only, or a hard strike finishing a spot:** the first adds lines without changing play; the second skips the 2-round rule.
- **Slag in material quality only:** material quality changes nothing in the prototype, so slag would carry no stake.
- **Slag any time before the quench:** loses the clear first phase.
- **Stats in the score:** rewrites grading and D-005, and breaks every best so far.
- **Ore look from work marks, or no look:** marks need art; no look misses "how it looks".
- **Tap or hold grinding:** a drag along the edge reads as grinding and measures steadiness.
- **Split pass (S1–S3, test, S4–S6):** Morgan chose one pass with a quick test after S3.

From the spec checks:

- **A sheen fade on the anvil between 550 and 300 °C:** rejected; the piece is quenched at 780–880 °C, so the fade would show only after a mistake. The sheen shows on the result piece and in the grind view instead.
- **Stat multipliers above 1:** rejected; they clamp at 100 and hide the ore at the top, and an Ore 1 + Ore 3 mix averaged to Ore 2. Multipliers are at most 1, and each ore leads one stat.

## Risks

- Too much at once on a phone (aim, heat, force, slag) → slices land one at a time on the preview; the quick playtest after S3 can cut or tune before stats.
- A cracking ruin can now come in warm metal: 3 too-hard strikes below the working band (about 800–900 °C) end the craft (`f_wrong`, Morgan's choice) → shown on the approval page; `cracks` is data.
- Ore 3 cools at 104 °C/s across a band about 150 °C wide: under 1.5 s per heat (worked out, not measured) → tune `cool` by the S1 preview.
- Force read from heat feels arbitrary → the ideal is a straight line across the working band (data), and "Too light" / "Too hard" show at once.
- Stat formulas feel random → each stat comes from named parts of the craft, the card names what hurt it most, every weight is data.
- Grind is fiddly by finger → judged by mean distance and speed evenness with generous weights; it can't ruin the piece.
- Old bests were earned with −3 per missed hit → Morgan decides on the approval page whether to keep or clear them.

## Design

### Data (starting values to tune; assumptions, not playtested)

- `grading.json`: `missedHit` 3 → 5 (S1). New (S1): `metal: {bandShiftC: 20}`, `perfectPx: 1`, `streakShowAt: 3`. New (S2): `force: {fullHoldS: 0.6, idealAtHigh: 0.3, idealAtLow: 0.8, min: 0.25, max: 0.8, window: 0.15, hard: 2}` (so 1.0 is always hard and 0.05 always light); `ruin.blackStrikes` renamed `ruin.cracks` (3). New (S3): `slag: {reachPx: 6, blocked: 1, left: 3}`.
- `feel.json` (new, S1; screen-only numbers): `hammerRate: {cold: 1.25, in: 1, hot: 0.8}`, `perfectRate: 1.5`, `perfectVolume: 0.3`, `lightVolume: 0.3`; `grindEndS: 0.8` (S6).
- `ores.json`, per ore (Ore 1 / Ore 2 / Ore 3): `cool` 58.5 / 78 / 104 (+30%, S1); `name` from the approval page (S1); `slagPerPart` 0.8 / 0.5 / 0.2 (S3); `stats` {edge, toughness, balance}: {0.75, 1, 0.85} / {0.85, 0.85, 1} / {1, 0.75, 0.85} (S4); `sheen` "#8a6248" / "#c8c2b4" / "#4a7ae0" (S5); a mix's sheen is the parts-weighted mean of each channel, rounded.
- `items.json`: `stats` (S4): horseshoe ["toughness", "balance"], knife and sword ["edge", "toughness", "balance"]; `grind` (S6): true for knife and sword; `edgeLine: {x0, y0, x1, y1}` (S6) in close-view px along the cutting edge, measured in S6 on `close.png` against the drawn piece (assumption: knife about y 393, x 129–300; sword about y 394, x 60–340).
- `stats.json` (new, S4): `edge: {perPx: 10}`; `toughness: {perOutSecond: 4, degreesPerPoint: 5, perCrack: 10, quenchC: 830}`; `balance: {perMissing: 3, perSlag: 15, perSpreadPx: 2}`; `words` for the bands 0/40/60/75/90: Edge Dull, Fair, Sharp, Keen, Razor; Toughness Brittle, Fair, Sound, Sturdy, Unyielding; Balance Clumsy, Fair, Steady, True, Perfect; `why` templates per deduction, `{n}` being the count named (off-centre strikes = hits with `offPx` > `centrePx`) (`"hurt most by {n} off-centre strikes"`, `"hurt most by {n} s out of the working heat"`, `"hurt most by a quench {d} °C off"`, `"hurt most by {n} cracking strikes"`, `"hurt most by {n} hits missing"`, `"hurt most by {n} slag spots left"`, `"hurt most by uneven work"`, `"hurt most by an uneven grind"`) and `"helped by the {ore} in the mix"`. S6 adds `grind: {perPx: 8, perCv: 60, minCover: 0.8, strokes: 2, minPoints: 5, share: 0.5}`.
- `hints.json`: `force` (S2) "Hold longer to strike harder. Hot metal wants a light touch."; `slag` (S3) "Knock out the dark slag first. The spots beside it won't shape until it's gone."; `grind` (S6) "Drag the stone along the edge, steady and even." Each shows the first 3 times its step is reached, counted like the hammer hint.

### Engine

- **S1.** `createCraft` sets `rulesVersion: 2` and `bandShiftC = round((next() × 2 − 1) × metal.bandShiftC) + 0` (no −0) from `mulberry32(seed ^ 0xba5d)`, added to `props.bandLowC` and `props.bandHighC`. Only the working band moves; heat colours, the `black` band and the burning band don't. Each `Strike` gains `heat`: `cold` below the (shifted) band, `in`, `hot` above it, at the strike's temperature, for every strike including wild ones; `offPx`: the distance from the strike point (already 40 px above the touch) to the target's centre, for hits, else null; and `perfect` (false for anything but a hit): a hit with `offPx ≤ perfectPx`, `heat` `in` (and, from S2, force right). `cleanStreak(state)`: the number of latest strikes in a row whose lines, each rounded, sum to 0, counting hits and (from S3) slag clears; any other strike ends it.
- **S2.** `Input` `{strike: {x, y, force?}}`, `force` in [0, 1]; a missing `force` means the ideal force, so scripted crafts in earlier checks keep their meaning. Ideal force at temperature T: `idealAtLow + (idealAtHigh − idealAtLow) × (T − bandLowC) ÷ (bandHighC − bandLowC)`, clamped to [min, max]. Light: force < ideal − window. Hard: force > ideal + window. Otherwise right. `forceFromHold(steps)` in `strike.ts` = min(1, steps × 16 ms ÷ `fullHoldS`); the screen only counts steps (GAME-02). A light strike (any target) changes nothing and has no lines (kind `light`). A wild strike ignores force (light or not, it is wild). A hard hit or repeat adds `hard-strike` −2. `crack` = a hit or repeat in the `black` band, or a hard hit or repeat below the working band (one count even when both). The 3rd `crack` ends the craft with `ruin` `cracked` (renamed from `black-strikes`). `Strike.black` is replaced by `crack`.
- **S3.** `createCraft` places slag: `count = min(targets − 1, round(Σ parts × slagPerPart))`; the gaps (gap g lies between targets g and g + 1 in `items.json` order) are shuffled Fisher–Yates with `mulberry32(seed ^ 0x51a6)` (i from n − 1 down to 1, j = floor(next() × (i + 1)), swap) and the first `count` taken; each spot sits at the midpoint of its two targets after their seed shift, x and y each rounded with `Math.round`. `CraftState.slag: {x, y, gap, cleared}[]`. A strike's candidates are open targets within `strike.reachPx` and uncleared spots within `slag.reachPx`; the nearest wins, ties to the target. A spot taken by a strike that isn't light is cleared (kind `slag`), with cold, hot, `hard-strike` and `crack` exactly as for a hit; a light strike on it changes nothing. A target is blocked while gap g − 1 or gap g holds an uncleared spot; a strike that would count for an open blocked target is kind `blocked`: −1 `blocked-strike`, no hit, other lines as for a hit. A closed target stays a repeat, blocked or not. At the quench, each uncleared spot adds `slag-left` −3 (count = spots).
- **S4.** `statsFor(state)` in new `stats.ts` (no `checkMix`, so tests can build states by hand); `grade(state)` adds its result as `stats` for a finished craft (never for a ruin): for each stat the item uses, `{value, word, why}`. Work is computed, multiplied by the mix's parts-weighted `stats` multiplier, rounded, clamped 0–100:
  - Edge work = 100 − `perPx` × mean over hits of max(0, `offPx` − `strike.centrePx`); 0 with no hits.
  - Toughness work = 100 − `perOutSecond` × (`lost["out-of-band"]` ÷ `grading.perSecond.outOfBand`, i.e. seconds) − |quenchC − `quenchC`| ÷ `degreesPerPoint` − `perCrack` × cracking strikes.
  - Balance work = 100 − `perMissing` × missing hits − `perSlag` × slag left − `perSpreadPx` × (largest − smallest per-target mean `offPx`, over targets with at least 1 hit; 0 with fewer than 2).
  - `why` names the largest single deduction with its template (the grind's deduction is `share` × (100 − grindScore), in the same points as the rest) (ties: the first in the list above); with no deduction, "helped by the {ore} in the mix", naming the ore in the mix with the highest multiplier for that stat (ties: first in `ores.json`).
  - `GradeResult` gains `stats`; `ResultData` gains `stats`, `hits` (each target's hits) and `alloy` (it has `alloy` since prototype S5).
- **S6.** `Place` gains `grind` (no heat change). For items with `grind`, a `{drop: "tub"}` that doesn't ruin sets `location` `grind` and `quenchC`; the craft isn't ended. Input `{stroke: {x, y}[]}`: close-view px, one point per engine step (16 ms) of the drag, sent at lift; ignored outside `grind` or under `minPoints` points. For a stroke: distance = mean distance from each point to the edge segment; cv = the coefficient of variation of the distances between consecutive points; cover = (largest − smallest projection of the points on the edge) ÷ the edge's length. Stroke score = clamp(100 − `perPx` × distance − `perCv` × cv, 0, 100) × min(1, cover ÷ `minCover`); a stroke whose mean step distance is 0 scores 0. After `strokes` strokes, `grindScore` = their mean and `location` `done`. Edge with a grind = clamp(round(((1 − share) × hammer work + share × grindScore) × multiplier), 0, 100).

### Screens

- **S1.** The hammer plays at `hammerRate[heat]` (key `hammer`; `lastSound()` is null before any strike); a Perfect strike adds a second play at `perfectRate`, `perfectVolume`. A wild strike plays at rate 1 (it rings the anvil). The popup reads "Perfect" for a Perfect strike, else "Clean" or "−n" as now. From `streakShowAt` the label ends "· Clean ×N".
- **S2 (mock-up `f-force`).** While a finger is down in the close view, a ring fills clockwise over `fullHoldS` of engine time (steps counted while the finger is down, so `pause()` freezes it); at lift the strike carries `forceFromHold(steps held)`. A light strike plays at `lightVolume` and pops "Too light"; a hard one pops "Too hard" (and its points). The force hint shows in the close panel.
- **S3 (mock-up `f-slag`).** Uncleared spots are dark pits on the bar; a clearing strike gives a puff of grey scale and the popup "Slag out"; a blocked strike pops "Slag first". The slag hint shows in the close panel.
- **S4 (mock-ups `f-result-stats`, `f-list-stats`).** A stat card (`data-testid="stat-card"`, one `stat-row` per stat) under the score lines: per stat, the name, a bar (value ÷ 100), the word and the `why` line. The item list adds a line (`data-testid="best-stats"`) under the best: the best word of each stat, "Edge Keen · Toughness Sound · Balance True", only once any exist.
- **S5 (mock-up `f-result-piece`).** A `<canvas data-testid="result-piece">` above the score, drawing `worked(shapesFor(item.id), hits)` one canvas px per game px, shown at min(2, 300 ÷ the raster's width) CSS px per game px with `image-rendering: pixelated`, so the sword fits the 443 px screen; each pixel = the mix's sheen × the raster's shade, with the dark outline as in the forge.
- **S6 (mock-up `f-grind`).** The quench's hiss, steam, sinking and 1.6 s hold start when `quenchC` is set (today they start at `done`); then, for a piece in `grind`, the close view shows the cooled piece in its sheen and the top bar gains a Grind step, lit; a whetstone drawn in code follows the finger; sparks along the stroke; the panel reads "Stroke 1 of 2" and the grind hint. After the last stroke, `grindEndS`, then the result. The craft's end (save, Result) happens at `done`, after the grind.

### Save (S4)

- Version 2 adds `bestStats: {[itemId]: {[stat]: number}}`: the best of each stat on its own (`st_best`), integers 0–100, only stats the item uses, updated on finished crafts only. Load accepts version 1 (upgraded in memory with `bestStats: {}`, written as version 2 at the next save) and version 2 (each value checked); anything else is kept aside as today (GAME-05). `recordCraft` takes the stats.
- Old bests: kept or cleared as Morgan answers on the approval page.

### Debug API

- S1: `e2e/forge.ts`'s `Api` type follows each slice's additions. `state()` gains `rulesVersion`, `bandShiftC`, and strike `heat` / `offPx` / `perfect`; `lastSound()` returns `{key, rate, perfect}` for the last strike: `rate` is the first (hammer) play's rate, `perfect` true when the second ring played; a light strike reports its hammer play at `lightVolume` with the same rate rule. S2: `send()` takes `force`; strike `force`, `kind`, `crack`. S3: `slag()` gives the spots' centres in CSS px with `cleared`. S6: `send()` takes `stroke`; `state().grindScore`; `edgeLine()` gives the edge's ends in CSS px, converted like `targets()`.

## Slices

### S1 Quick bundle

- **Morgan tries:** a knife with no strikes scores 10 (Crude); the working heat moves between crafts and the hammer's clank or thud says where it is; more trips to the fire; "Perfect" on a dead-centre strike; "Clean ×N"; the ores' new names.
- **Checks that fail now:** J1, J2.
- **Files:** `src/data/grading.json`, `ores.json` (cool, names), new `feel.json`; `src/engine/craft.ts` (rulesVersion, band shift, `heat`, `offPx`, `perfect`), `strike.ts`; new `src/engine/depth.test.ts`; `src/game/Forge.ts` (sound rate, Perfect, streak); `src/ui/forge.ts` (label); `src/ui/debug.ts` (`lastSound`); tests that pin −3, 46 or 94 and change on purpose: `alloy.test.ts` (cool means), `grade.test.ts`, `heat.test.ts`, `spread.test.ts`, `e2e/craft.spec.ts` (46 → 10, Common → Crude, 94 → 92, "−3" → "−5"), `e2e/loop.spec.ts` (46 → 10, ore names); `src/engine/grade.test.ts` strike literals gain the new fields; `e2e/forge.ts` (`Api`); new `e2e/depth.spec.ts`.
- **Waits on:** Morgan's ore names.

### S2 Strike force

- **Morgan tries:** holding fills the ring; light strikes don't take, hard ones cost and crack cold metal; reading the heat now sets the force.
- **Checks that fail now:** J3; J2's Perfect gains the force condition.
- **Files:** `mockups/depth.html` `f-force` first; `src/engine/strike.ts` (`CAUSES` gains `hard-strike`), `craft.ts`, `src/data/grading.json`, `hints.json`; new `src/engine/force.test.ts`; `src/game/Forge.ts` (hold counting, ring, popups, light volume); `src/ui/forge.ts` (force hint); `src/ui/result.ts` (`hard-strike` wording "N strikes too hard", ruin text "The {item} cracked on the anvil." / "3 cracking strikes: on black metal, or too hard below the working heat."); `e2e/depth.spec.ts`; ruin and hint checks that change on purpose (`e2e/ruin.spec.ts`, `hammer.spec.ts` ruin wording, `craft.spec.ts` `hintsSeen`); unit tests that pin `black` and `black-strikes` (`strike.test.ts`, `grade.test.ts`, `hammer.test.ts`); the real-tap helpers (`e2e/hammer.spec.ts` `strikeAt`, `e2e/forge.ts`) hold for the ideal force with `advance()` between press and lift, since a plain tap is now light.
- **Waits on:** S1.

### S3 Slag in the bar

- **Morgan tries:** dark pits on the bar, more with cheaper ore; the spots beside them won't shape until they're knocked out; slag left shows on the result. Then a quick playtest form.
- **Checks that fail now:** J4.
- **Files:** `mockups/depth.html` `f-slag` first; `src/engine/craft.ts`, `strike.ts` (`CAUSES` gains `blocked-strike`, `slag-left`), `grade.ts`; `src/data/ores.json` (`slagPerPart`), `grading.json`, `hints.json`; new `src/engine/slag.test.ts`; `src/game/Forge.ts` (pits, puff, popups); `src/ui/forge.ts` (slag hint); `src/ui/result.ts` (wording "N strikes on spots held by slag", "N slag spots left"); `src/ui/debug.ts` (`slag()`), `e2e/forge.ts` (`Api`); `craft.spec.ts` and `loop.spec.ts` no-strike knives 10 → 1; `e2e/depth.spec.ts`; scripted e2e crafts that now meet slag clear it first or expect its lines; `depth.test.ts` J1 (10 → 1) and `grade.test.ts` totals for the default knife.
- **Waits on:** S2.

### S4 Blade stats and ore traits

- **Morgan tries:** a stat card on every result; an Ore 3 knife comes out keener but more brittle than an Ore 1 knife; best stats on the item list after a reload.
- **Checks that fail now:** J5.
- **Files:** `mockups/depth.html` `f-result-stats`, `f-list-stats` first; new `src/data/stats.json`, `src/engine/stats.ts`, `stats.test.ts`; `grade.ts`; `src/data/ores.json` (`stats`), `items.json` (`stats`); `src/save/save.ts` (v2), `save.test.ts`; `src/game/Forge.ts`, `Result.ts`; `src/ui/result.ts`, `choose.ts`; `e2e/depth.spec.ts`.
- **Waits on:** S3 and the quick playtest's notes.

### S5 Ore look

- **Morgan tries:** the result shows the finished piece in its metal's colour; different mixes look different.
- **Checks that fail now:** J6.
- **Files:** `mockups/depth.html` `f-result-piece` first; `src/data/ores.json` (`sheen`), new `src/data/sheen.ts` (the blend), `sheen.test.ts`; `src/game/Result.ts`, `src/ui/result.ts` (canvas); `e2e/depth.spec.ts`.
- **Waits on:** S4.

### S6 Grind and finish

- **Morgan tries:** after the quench, two strokes of the whetstone along the knife's edge; a steady grind gives a keener edge; the horseshoe skips it.
- **Checks that fail now:** J7.
- **Files:** `mockups/depth.html` `f-grind` first; `src/engine/heat.ts` (`Place`), `craft.ts` (`grind`, `stroke`), new `src/engine/grind.ts`, `grind.test.ts`; `stats.ts`; `src/data/items.json` (`grind`, `edgeLine`), `stats.json`, `hints.json`, `feel.json`; `src/game/Forge.ts` (quench effects on `quenchC`, grind mode, stone, sparks, end at `done`, `grindEndS`); `src/ui/forge.ts` (`ForgeMode` `grind`, the Grind step, panel); e2e stroke helper that moves the mouse and calls `advance(16)` between points; `src/ui/debug.ts` (`edgeLine`); `e2e/depth.spec.ts`; knife and sword quench checks that now pass through the grind (`craft.spec.ts`, `loop.spec.ts`, and the J5 and J6 crafts in `depth.spec.ts`; ruins in `ruin.spec.ts` are unaffected).
- **Waits on:** S5.

Then Morgan reruns the 10-craft test with the playtest form.

## Verification

- Every push: `node .claude/master/sync.mjs --check && npm run check`. When screens change, also `npm run e2e` (AGENTS.md).
- End to end: each slice's checks in `e2e/depth.spec.ts`, driven through the debug API and the real controls with `page.mouse` as the existing helpers do, then Morgan on the Pixel through the preview link. Morgan's playtest notes are the evidence for fun (GAME-06).

## Open questions

- **Ore names:** Morgan picks a set on the approval page before S1.
- **Old bests:** keep them (earned at −3 per missed hit) or clear them when S1 lands; asked on the approval page.
- **Weights:** every number in Data is a starting value, tuned by playtest.
