import { expect, it } from 'vitest';
import { itemById } from '../data/items';
import { strokePoints } from './grindFixture';
import { createCraft, step, type CraftState, type Input } from './craft';

// GAME-01, GAME-06: one determinism test. The same seed and the same inputs give the same craft,
// and replaying a craft's own log from its seed rebuilds it exactly.
function play(seed: number): CraftState {
  let s = createCraft(seed, 'knife', itemById('knife').defaultAlloy);
  const script: Input[] = [{ bellows: true }, ...Array<Input>(220).fill({ none: true }), { bellows: false }, { grab: true }, { drop: 'anvil' }];
  for (const i of script) s = step(s, i);
  for (const t of s.targets.slice(0, 5)) {
    s = step(s, { strike: { x: t.x + 2, y: t.y - 1 } });
    for (let i = 0; i < 20; i++) s = step(s, { none: true });
  }
  // Quench and one grind stroke along the edge (S6); the craft waits in the grind for the second.
  s = step(step(s, { grab: true }), { drop: 'tub' });
  s = step(s, { stroke: strokePoints('knife') });
  return s;
}

it('replays the same craft from seed and log', () => {
  const a = play(12345);
  expect(play(12345)).toEqual(a);
  expect(play(54321).targets).not.toEqual(a.targets);
  expect(a.location).toBe('grind');
  expect(a.strokes).toEqual([100]);
  let r = createCraft(a.seed, a.itemId, a.alloy);
  const byStep = new Map(a.log.map((e) => [e.step, e.input]));
  while (r.step < a.step) r = step(r, byStep.get(r.step) ?? { none: true });
  expect(r).toEqual(a);
});
