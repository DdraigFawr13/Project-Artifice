# Planning answers (design, 2026-11-04)

Status: **Settled** 2026-11-04. The final plan was approved; settled choices are in DECISIONS D-003 to D-006. This file keeps the answers as given. Copied from the form pages' saved answers. Morgan's own words are in quotes.

## Design round 1 ([page](https://claude.ai/artifact/NA4KTBCDvhGa22LTUzwbDy))

- Help: "Just me for now. Artist for final art eventually but I still want quality art for the prototype to make it more fun"
- Platform: a web game, designed for touch first, also works with a mouse
- Tech: TypeScript with a web game library
- Crafting steps in the prototype: mix an alloy, then forge it: heat, hammer, quench
- Player skill: placement (strike the right spot on the piece); reading the metal (judge colour and sound); steady control (hold the heat in the right band). Not timing.
- Mistakes: the grade drops; a really bad mistake ruins the piece
- Craft length: about 1–2 minutes. "But i may want it to be longer to give a more realistic crafting experience"
- Grade display: a score out of 100 plus a tier name (Crude, Fine, Masterwork…)
- Art: "I'd like pixel art from the start through free or cheap assets. For the pixel art I eventually want it to be like artistic well lit semi high detail pixel art but I'm open to whatever honestly"
- Prototype test: after 10 crafts I still want to forge another, with no shop or caravans

## Review ([page](https://claude.ai/artifact/4dzk1d8JqTw6gcPtE4p7kQ))

All 11 findings agreed. Results:

- First prototype (Keep): forging (heat, hammer, quench); alloy mixing from 2–3 ores; grade breakdown with every point lost explained; sound (hammer, hiss, fire); 3 item shapes with a personal best each; save between crafts; a few on-screen hints instead of a tutorial
- After the prototype: reputation, casting
- Items: horseshoe (~1 min), knife (~2 min), sword (~3 min)
- Orientation: portrait
- AI-generated art: only for placeholders and concepts, not final art
- Playtest builds: a free host (Vercel's free plan), private link. Publishing needs Morgan's OK first (SAFE-01).
- A ruined piece: half the metal comes back as scrap
- Quenching is a reading-the-metal call graded on the true temperature (finding r_quench, agreed)
- Every point lost traces to a shown cause; grading uses the hidden true temperature; every read has two cues (finding r_fair, agreed)
- Save only between crafts; a ruin stands (finding r_save, agreed)
- Strike on release with a marker offset from the thumb; bellows by hold or drag; browser gestures blocked during a craft; fixed simulation step (finding r_touch, agreed)
- Phase order (draft): 1 forge prototype; 2 shop (commissions, pricing, rarity, batch variation, reputation); 3 caravans and patterns; 4 casting and own items; later more professions and final art

Morgan's note on art: "We will need an art design direction workshop for this"

## Art direction ([step 1](https://claude.ai/artifact/1MpZv8TsgQK6DXwHRtRnNT), [step 2](https://claude.ai/artifact/LMMZGoVFjiwkUbSt4yBYnH))

Recorded as D-003 and in UI_STYLE.md. Step 1 note: "Need more detail and resolution. It's too simple."

## Target device

Morgan's phone: "I have a pixel 10xl so it will be on that" (read as the Pixel 10 Pro XL).

## Final plan ([page](https://claude.ai/artifact/Dp2hubybfACEV2c8WHrftx); answered in chat because the page saved only on the device)

- Minimum sizes: 14 px text, 44 px buttons
- Reheat: yes, back to the fire any time
- Quench: drag the blade to the tub
- Sound: free CC0 packs
- Playtest link: Vercel free plan
- Approval: "Approved, start"
