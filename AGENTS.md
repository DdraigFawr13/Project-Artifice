# Agent instructions

Artifice: a fantasy smithy-and-shop game where the player's own hand precision sets each item's quality. It's for players who love crafting and want it to be the whole game. The concept is in `docs/CONCEPT.md`.

Shared rules come from AI-Master-Instructions and load through CLAUDE.md (`.claude/master/RULES.md`). This file holds only what is specific to this project. Keep it under 80 lines.

## Read first

1. `docs/HANDOFF.md`: current state and next step.
2. `docs/DECISIONS.md`: settled rules. Don't reopen them.
3. `docs/LESSONS.md`: entries for the area you are about to work in.
4. `docs/CONCEPT.md`: the chosen concept. Its "Design brief" section lists what design must not reopen.
5. `docs/UI_STYLE.md`: the look, tokens and screen checklist. Read it before any screen or art work.

## Local checks (run before pushing)

- Every push: `node .claude/master/sync.mjs --check`. There's no app code yet; add the project's checks here when the stack is chosen.

## What CI runs

- **CI** (`ci.yml`): the master drift check, on PRs marked ready and on default-branch pushes. Markdown and `docs/` changes skip it.
- No deploys yet.

## Project rules

- Hands-on crafting comes first: the smithing step must be fun on its own before shop or caravan work grows (CONCEPT.md kill criteria).
- Smithing is the only profession until the first prototype is judged enjoyable (D-001).

## Overrides

Master rules this project deliberately changes. Each line names the rule id and the reason; the same entry is in `.ai-master.json` "overrides".

- None.
