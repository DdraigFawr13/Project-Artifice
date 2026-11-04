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

- Every push: `node .claude/master/sync.mjs --check && npm run check` (typecheck and unit tests).
- When screens change: also `npm run e2e` (Playwright at the Pixel size, 414 × 921 at ×3.25, against `vite preview`).
- Install with `npm ci`. npm 10.9 fails `npm install` on this tree ("Cannot read properties of null (reading 'edgesOut')"); change dependencies with `npx npm@11 install`.

## What CI runs

- **CI** (`ci.yml`): the master drift check, `npm run check` and `npm run e2e`, on PRs marked ready and on default-branch pushes. Markdown and `docs/` changes skip it.
- **Vercel:** a private preview build on every push (D-006); no production deploys yet.

## Project rules

- Hands-on crafting comes first: the smithing step must be fun on its own before shop or caravan work grows (CONCEPT.md kill criteria).
- Smithing is the only profession until the first prototype is judged enjoyable (D-001).

## Overrides

Master rules this project deliberately changes. Each line names the rule id and the reason; the same entry is in `.ai-master.json` "overrides".

- **CI-05:** Vercel builds a private preview on every push, drafts included, so Morgan can playtest each slice on the Pixel (D-006). The rest of CI-05 still holds: deploy to production only from the default branch; merge when a change is done, not to preview it; deploys and migrations queue and are never cancelled or re-run without reading the log; after a deploy, check the deployed commit equals the merge commit.
