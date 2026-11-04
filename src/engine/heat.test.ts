import { describe, expect, it } from 'vitest';
import heatJson from '../data/heat-bands.json';
import { createCraft, step, STEP_MS, type CraftState, type Input } from './craft';
import { defaultAlloy, alloyProps } from './alloy';
import { items } from '../data/items';

// J2 Heat (docs/specs/forge-prototype.md, Data → Heat). Rates come from the data file, not from this test.
const H = heatJson.heat;
const knife = items.find((i) => i.id === 'knife')!;
const steps = (ms: number) => Math.round(ms / STEP_MS);
/** Seconds actually simulated by steps(ms). */
const secs = (ms: number) => (steps(ms) * STEP_MS) / 1000;

function run(s: CraftState, n: number, input: Input = { none: true }): CraftState {
  for (let i = 0; i < n; i++) s = step(s, i === 0 ? input : { none: true });
  return s;
}

describe('heat', () => {
  it('starts at 20 °C in the fire', () => {
    const s = createCraft(1, 'knife', defaultAlloy(knife));
    expect(s.temp).toBe(H.startC);
    expect(s.location).toBe('fire');
  });

  it('rises at the bellows rate while the bellows are held, and caps at the maximum', () => {
    let s = createCraft(1, 'knife', defaultAlloy(knife));
    s = run(s, steps(1000), { bellows: true });
    expect(s.temp).toBeCloseTo(H.startC + H.bellowsRate * secs(1000), 6);
    s = run(s, steps(10_000));
    expect(s.temp).toBe(H.maxC);
  });

  it('drifts towards the idle target without the bellows, from either side, without overshoot', () => {
    let s = createCraft(1, 'knife', defaultAlloy(knife));
    s = run(s, steps(1000));
    expect(s.temp).toBeCloseTo(H.startC + H.idleRate * secs(1000), 6);
    s = run(s, steps(60_000));
    expect(s.temp).toBe(H.idleTargetC);
    s = run(s, steps(2000), { bellows: true });
    const hot = s.temp;
    s = run(s, steps(1000), { bellows: false });
    expect(s.temp).toBeCloseTo(hot - H.idleRate * secs(1000), 6);
  });

  it('falls at the alloy cool rate on the anvil and while held, down to 20 °C', () => {
    const alloy = defaultAlloy(knife);
    const cool = alloyProps(alloy).cool;
    expect(cool).toBeCloseTo((4 * 60 + 45) / 5, 6);
    let s = createCraft(1, 'knife', alloy);
    s = run(s, steps(4000), { bellows: true });
    const hot = s.temp;
    s = step(s, { grab: true });
    expect(s.location).toBe('held');
    s = step(s, { drop: 'anvil' });
    expect(s.location).toBe('anvil');
    s = run(s, steps(3000));
    expect(s.temp).toBeCloseTo(hot - cool * ((2 * STEP_MS) / 1000 + secs(3000)), 6);
    s = run(s, steps(120_000));
    expect(s.temp).toBe(H.floorC);
  });

  it('ignores the bellows out of the fire, and a drop in the tub returns the bar until S4', () => {
    let s = createCraft(1, 'knife', defaultAlloy(knife));
    s = step(s, { grab: true });
    s = step(s, { drop: 'anvil' });
    s = run(s, steps(1000), { bellows: true });
    expect(s.temp).toBe(H.floorC);
    s = step(s, { grab: true });
    s = step(s, { drop: 'tub' });
    expect(s.location).toBe('anvil');
  });

  it('returns a bar dropped in the tub to the fire when it came from the fire', () => {
    let s = createCraft(1, 'knife', defaultAlloy(knife));
    s = step(s, { grab: true });
    s = step(s, { drop: 'tub' });
    expect(s.location).toBe('fire');
  });

  it('ignores inputs that make no sense where the bar is', () => {
    let s = createCraft(1, 'knife', defaultAlloy(knife));
    s = step(s, { drop: 'anvil' }); // not held: no teleport
    expect(s.location).toBe('fire');
    s = step(s, { grab: true });
    s = step(s, { grab: true }); // already held
    expect(s.location).toBe('held');
    expect(s.heldFrom).toBe('fire');
    s = step(s, { drop: 'anvil' });
    const before = s;
    s = step(s, { strike: { x: 10, y: 10 } }); // strikes arrive in S3
    expect({ ...s, log: [], step: 0, temp: 0 }).toEqual({ ...before, log: [], step: 0, temp: 0 });
  });

  it('logs a copy of each input', () => {
    const input = { strike: { x: 1, y: 2 } };
    const s = step(createCraft(1, 'knife', defaultAlloy(knife)), input);
    input.strike.x = 99;
    expect(s.log[0]!.input).toEqual({ strike: { x: 1, y: 2 } });
  });

  it('logs each input with its step number, so a craft replays', () => {
    let s = createCraft(7, 'knife', defaultAlloy(knife));
    s = step(s, { none: true });
    s = step(s, { bellows: true });
    s = step(s, { grab: true });
    expect(s.log).toEqual([
      { step: 1, input: { bellows: true } },
      { step: 2, input: { grab: true } },
    ]);
    expect(s.step).toBe(3);
  });
});
