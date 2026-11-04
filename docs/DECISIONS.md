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
