# Handoff

Updated: 2026-11-04. A fresh session must be able to continue from this file alone. Keep it to 60 lines; move finished entries to `docs/archive/handoff-YYYY-MM.md`.

## Phase

Build: forge spec approved ([docs/specs/forge-prototype.md](specs/forge-prototype.md)); next is slice S1 in a fresh build session.

## Plan map

Shown at the start of a session and when asking the owner to approve a PR or a merge (WS-08). One line per step, marked done ✔, now ▶ or later ○.

- ✔ Brainstorm: concept chosen and brief committed.
- ✔ Bootstrap: shared rules, starter docs and CI ([PR #1](https://github.com/DdraigFawr13/Project-Artifice/pull/1)).
- ✔ Design: rounds, review, art direction, forge mock-up, final plan approved.
- ✔ Plan: forge spec approved 2026-11-04.
- ▶ Build S1: skeleton and playtest link (fresh session).
- ○ Build S2 heat, S3 hammer, S4 quench and grade, S5 full loop and the 10-craft test (one fresh session each).

## Just done

- 2026-11-04 Brainstorm done. Pages: [open questions](https://claude.ai/artifact/TPWNRT6HAxtDPSnwhRNGtM), [concepts](https://claude.ai/artifact/7Rvk1HAdvK1EcWVgYDkRNP), [round 1](https://claude.ai/artifact/J2wvcWkCKBkBYwCBTMVs2J), [round 2](https://claude.ai/artifact/Skf9Aids5RjZPmhExmYpkD). Brief committed (e5b1553). Morgan renamed the first branch to `main`, now the default.
- 2026-11-04 Bootstrap merged ([PR #1](https://github.com/DdraigFawr13/Project-Artifice/pull/1), 8fc3611): AI-Master v4.8.0 with `core` and `project-types/game`.
- 2026-11-04 Design round 1 published: [round 1](https://claude.ai/artifact/NA4KTBCDvhGa22LTUzwbDy) (collection `round1`): platform, tools, forging steps, skill, failure, craft length, grade display, art, scope, prototype test.

- 2026-11-04 Round 1 answered. Reviewer ($0.53 measured) and own review done; [review page](https://claude.ai/artifact/4dzk1d8JqTw6gcPtE4p7kQ) (collection `review1`): 11 findings, keep list, draft phases, 5 questions.

- 2026-11-04 Review answered: all 11 findings agreed; prototype = forge, alloy, grade breakdown, sound, 3 items (horseshoe/knife/sword), save between crafts, hints; reputation and casting after; portrait; AI art only for placeholders; Vercel free plan (publishing still needs Morgan's OK); a ruin returns half the metal as scrap. Morgan asked for an art direction workshop: [taste board](https://claude.ai/artifact/1MpZv8TsgQK6DXwHRtRnNT) (collection `taste`).

- 2026-11-04 Taste board 1: kept Ember Night and Daylight Workshop, Rune Forge parked, Chunky cut; Morgan wanted more detail and research. Research agent $0.71 measured; 6 OpenArt concepts (Nano Banana 2, Morgan approved the spend). [Taste board 2](https://claude.ai/artifact/LMMZGoVFjiwkUbSt4yBYnH) (collection `taste2`): lead look, resolution, live lighting, art pipeline, colour-blind cues.

- 2026-11-04 Taste 2: Ember Night leads the forge, Daylight for the shop later; 360×640; live forge/metal lights; AI placeholders; heat readable without colour (D-003). Target phone: Pixel 10 Pro XL, 412 px. `docs/UI_STYLE.md` and `docs/design/planning-answers.md` written. [Forge mock-up](https://claude.ai/artifact/8MATSEHtmtMVsXEF7X8faQ) (`mockups/forge.html`), fresh check $0.18.

- 2026-11-04 Forge mock-up approved after 6 rounds (close-up anvil view, side on, knife along the face tip right; Press Start 2P for scores). [Final plan page](https://claude.ai/artifact/Dp2hubybfACEV2c8WHrftx) (collection `final`). OpenArt credits now 3,425 (measured).

- 2026-11-04 Art refined at Morgan's request: close-up anvil (side on, cleaner, knife tip right) and the wide shot redrawn to match. These two replace Ember concept 3 as the style reference; resample UI_STYLE tokens from them when the spec is written.

- 2026-11-04 Final plan approved in chat (the page saved only on the device): 14/44 px minimums, reheat any time, drag to quench, CC0 sound, Vercel free plan. Recorded as D-004 to D-006.

- 2026-11-04 Forge spec drafted; 3 fresh checks, 2 re-checks and a final zero-decision check, all findings fixed or put to Morgan. Spec check agents $1.25 measured in total. D-003 scale rule and D-006 CI-05 override recorded.

## Next

1. Merge PR #2 (design docs and spec) once its CI is green.
2. Start a fresh session on Project-Artifice for slice S1, as the spec's "S1 Skeleton and playtest link" says. Ask Morgan before the OpenArt batch and before linking Vercel. Re-run the zero-decision check on S1 first if anything changed (write-spec step 8).


## Open questions

- Art style, platform, and whether anyone else helps: open in CONCEPT.md, for design.

## Brainstorm trial (D-048 in AI-Master-Instructions)

- 2026-11-04: 5 concepts made; dropped with reasons: yes; kill criteria: yes; rounds: 2; measured agent cost $1.12; measure 2 (planning-interview round 1 asks nothing the brief answered): pending; measure 3 (concept unchanged after design): pending. A master session copies this to `decisions/benchmarks/brainstorm-trial.md` when done.

## Decisions since the last plan update

- 2026-11-04 Concept chosen ([D-001](DECISIONS.md#d-001-concept-chosen)).
- 2026-11-04 Full setup with the game layer ([D-002](DECISIONS.md#d-002-full-ai-master-setup-with-the-game-layer)).
- 2026-11-04 Forge spec approved: five tiers, unlimited ore, painted glow for now (D-003 updated), previews on every push.
