# Decisions

Settled rules for this project. Not a changelog: an entry stays while the rule is in force. Change a rule here in the same change that changes the behaviour. Mark ideas Proposed until the owner approves them; mark retired entries SUPERSEDED with a pointer, never delete them.

## D-001 Concept chosen

- **Status:** Accepted (2026-11-04)
- **Decision:** Build the concept in [CONCEPT.md](CONCEPT.md): a fantasy smithy with a shop, hands-on precision crafting, material quality as part of the craft, commissions and caravans. Smithing is the only profession in the first prototype.
- **Why:** Morgan picked it in the brainstorm (5 concepts, 2 rounds) and agreed with every part of it in round 2. Dropped concepts and their reasons are in CONCEPT.md.

## D-002 Full AI-Master setup with the game layer

- **Status:** Accepted (2026-11-04)
- **Decision:** Use AI-Master-Instructions v4.8.0, full profile, layers `core` and `project-types/game`. Pick a stack layer when design settles phone or PC.
- **Why:** Morgan chose the full setup: the project is a multi-session plan (design, spec, prototype). There's no code yet, so no stack applies.

## D-003 Art direction

- **Status:** Accepted (2026-11-04)
- **Decision:** The forge uses the Ember Night look: semi high detail pixel art, lit only by the fire and the hot metal (concept 3 of taste board 2). Daylight Workshop's look (concept 2) is kept for the shop in a later phase. The game renders at 360 × 640 game pixels in portrait. The forge and the hot metal are live 2D lights; everything else is painted. Heat is readable without colour: brightness rises with heat, and every band has a second cue, always on. Prototype art is AI-generated placeholders cleaned to the palette, with the hot metal drawn in code; an artist replaces it later. Details: [UI_STYLE.md](UI_STYLE.md).
- **Why:** Morgan picked these on [taste board 2](https://claude.ai/artifact/LMMZGoVFjiwkUbSt4yBYnH) after asking for more detail and research. Smiths read heat colour in dim light, so Ember Night fits the core skill. The research found no asset pack with a forge close-up, and the budget is about $50. Morgan allows AI art only for placeholders and concepts (design review).

## D-004 Platform and tech

- **Status:** Accepted (2026-11-04)
- **Decision:** A web game designed for touch first, also playable with a mouse, in portrait. Mock-ups and checks start at Morgan's Pixel 10 Pro XL (412 px). Minimum text 14 px, minimum tap 44 px. Built in TypeScript with Phaser 4 and Vite. All game rules live in a separate engine module with seeded randomness; screens only show results (GAME-01, GAME-02). Items, ores and heat bands are data files (GAME-04).
- **Why:** One link runs on Morgan's phone and PC. Touch-first designs also work with a mouse; the reverse fails. Cloud build sessions can run, test and screenshot a web game. Phaser 4 has 2D lighting with normal maps, which D-003's live light needs (research 2026-11-04). Approved on the [final plan](https://claude.ai/artifact/Dp2hubybfACEV2c8WHrftx), answered in chat.

## D-005 Forge prototype scope

- **Status:** Accepted (2026-11-04)
- **Decision:** The first prototype is smithing only. Mix an alloy from 2–3 ores, then forge: heat with the bellows (hold), hammer in a close-up side-on anvil view (strikes land on release at a ring above the thumb, along the whole blade), and quench by dragging the blade to the tub in the wide shot. The piece can go back to the fire any time. There is no heat gauge: the metal's colour, brightness, glow and sparks show heat. 3 items: horseshoe (~1 min), knife (~2 min), sword (~3 min), each with a personal best. Grade: a score out of 100 plus a tier, every point lost shown with its cause, graded on the hidden true temperature; material quality is not in the craft score. A bad mistake ruins the piece and returns half the metal as scrap. Save only between crafts; a ruin stays. A few on-screen hints, no tutorial system. Sound from free CC0 packs, each file's source recorded. After the prototype: reputation, commissions, casting and the rest of the phase order in docs/design/planning-answers.md.
- **Why:** The test is "after 10 crafts I still want to forge another, with no shop or caravans" (CONCEPT.md kill criteria). Design rounds, the review and the [approved mock-up](https://claude.ai/artifact/8MATSEHtmtMVsXEF7X8faQ) settled each part; reheat, drag-to-quench and CC0 sound were approved on the final plan.

## D-006 Playtest builds

- **Status:** Accepted (2026-11-04)
- **Decision:** Playtest builds go to a private preview link on Vercel's free plan, which Morgan opens on the Pixel after each build step. "Fun" counts only from Morgan's playtest notes (GAME-06).
- **Why:** Morgan approved it on the final plan: $0, private, and the only way to play on the phone. Publishing anything public still needs Morgan's OK (SAFE-01).
