import { describe, expect, it } from 'vitest';
import { itemById } from '../data/items';
import { createCraft, PASSES, step, type CraftState } from './craft';
import { grade } from './grade';

// J4's spread goal (forge spec Goals and J4): careful and sloppy play of the same knife and alloy differ by 25 or more.
// Careful: every strike 4 px from its target and in the working band, quench at 830 °C. Sloppy: every strike 12 px
// off its target across the blade (along it, 12 px off one target lands within reach of the next), quench at 980 °C.
const knife = itemById('knife');
const IN_BAND = 950; // the default knife alloy's band is 840–1110 °C

function play(offY: number, quenchC: number): number {
  let s: CraftState = createCraft(11, 'knife', knife.defaultAlloy);
  s = step(s, { grab: true });
  s = { ...step(s, { drop: 'anvil' }), temp: IN_BAND };
  for (let r = 0; r < PASSES; r++) {
    for (const t of s.targets) s = { ...step(s, { strike: { x: t.x, y: t.y + offY } }), temp: IN_BAND };
  }
  s = { ...step(s, { grab: true }), temp: quenchC };
  const g = grade(step(s, { drop: 'tub' }));
  if (g.ruined) throw new Error('ruined');
  return g.score;
}

describe('spread', () => {
  it('careful and sloppy knives differ by 25 points or more', () => {
    const careful = play(4, 830);
    const sloppy = play(12, 980);
    expect(careful - sloppy).toBeGreaterThanOrEqual(25);
  });
});
