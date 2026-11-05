import { describe, expect, it } from 'vitest';
import grading from '../data/grading.json';
import { bandAt } from '../data/heatBands';
import { itemById } from '../data/items';
import { alloyProps, ores } from './alloy';
import { cleanStreak, createCraft, step, type CraftState, type Input } from './craft';
import { grade, type Graded } from './grade';
import { grindOut } from './grindFixture';

// J1 and J2's engine parts (forge-depth spec, S1): the new miss cost, the per-craft band shift, and what each strike
// records (heat, offPx, perfect) and the clean streak.
const knife = itemById('knife');
const ALLOY = knife.defaultAlloy;
const at = (s: CraftState, temp: number): CraftState => ({ ...s, temp });
function run(s: CraftState, inputs: Input[]): CraftState {
  for (const i of inputs) s = step(s, i);
  return s;
}
/** On the anvil with the slag cleared, so strikes at targets keep their meaning (S3); J1 uses the real craft. */
const onAnvil = (seed = 42): CraftState => run({ ...createCraft(seed, 'knife', ALLOY), slag: [] }, [{ grab: true }, { drop: 'anvil' }]);
/** Strike (x, y) with the metal held at `temp`. */
const hit = (s: CraftState, x: number, y: number, temp: number): CraftState => step(at(s, temp), { strike: { x, y } });
const last = (s: CraftState) => s.strikes[s.strikes.length - 1]!;

describe('J1 missed hits and the shifted band', () => {
  it('scores a knife with no strikes 1 and Crude (10 before its 3 slag spots, −9), quenched at 830 °C', () => {
    const quench = (c: CraftState) => grade(grindOut(step(at(step(at(run(c, [{ grab: true }, { drop: 'anvil' }]), 830), { grab: true }), 830), { drop: 'tub' }))) as Graded;
    const g = quench(createCraft(42, 'knife', ALLOY));
    expect(g.ruined).toBe(false);
    expect(g.score).toBe(1);
    expect(g.tier).toBe('Crude');
    expect(quench({ ...createCraft(42, 'knife', ALLOY), slag: [] }).score).toBe(10);
  });

  it('draws bandShiftC as a whole number in −20..20, the same for a seed, varying across seeds', () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 200; seed++) {
      const a = createCraft(seed, 'knife', ALLOY);
      expect(Number.isInteger(a.bandShiftC)).toBe(true);
      expect(Math.abs(a.bandShiftC)).toBeLessThanOrEqual(20);
      expect(Object.is(a.bandShiftC, -0)).toBe(false);
      expect(createCraft(seed, 'knife', ALLOY).bandShiftC).toBe(a.bandShiftC);
      seen.add(a.bandShiftC);
    }
    expect(seen.size).toBeGreaterThan(10);
    // Both directions, near the full ±20 (a shift scaled down to ±11 would fail here).
    expect(Math.min(...seen)).toBeLessThan(-15);
    expect(Math.max(...seen)).toBeGreaterThan(15);
  });

  it('moves only the working band by the shift', () => {
    const s = createCraft(5, 'knife', ALLOY);
    const base = alloyProps(ALLOY);
    expect(s.props.bandLowC).toBe(base.bandLowC + s.bandShiftC);
    expect(s.props.bandHighC).toBe(base.bandHighC + s.bandShiftC);
    expect(s.props.cool).toBe(base.cool);
    expect(s.props.quality).toBe(base.quality);
    // The heat bands (black, burning, colours) don't move with the working band.
    expect(bandAt(base.bandLowC - 300)).toBe('black');
    expect(bandAt(1275)).toBe('white');
  });

  it('keeps the target positions for seed 42 (guard)', () => {
    expect(createCraft(42, 'knife', ALLOY).targets.map((t) => [t.x, t.y])).toEqual([
      [130, 387], [152, 389], [168, 388], [189, 391], [215, 390], [231, 393], [256, 389], [272, 390], [296, 389],
    ]);
  });

  it('cools Ore 2 at 78 °C/s, and names the ores', () => {
    expect(alloyProps({ ore2: 1, ore1: 0 }).cool).toBe(78);
    expect(ores.map((o) => o.cool)).toEqual([58.5, 78, 104]);
    expect(ores.map((o) => o.name)).toEqual(['Bog Iron', 'Ridge Iron', 'Starmetal']);
    expect(grading.missedHit).toBe(5);
  });

  it('starts at rules version 2', () => {
    expect(createCraft(1, 'knife', ALLOY).rulesVersion).toBe(2);
  });
});

describe('J2 heat, perfect and the streak', () => {
  it('classifies every strike against the shifted band, wild ones too', () => {
    const s0 = onAnvil();
    const { bandLowC: lo, bandHighC: hi } = s0.props;
    const t = s0.targets[0]!;
    expect(last(hit(s0, t.x, t.y, lo - 1)).heat).toBe('cold');
    expect(last(hit(s0, t.x, t.y, lo)).heat).toBe('in');
    expect(last(hit(s0, t.x, t.y, hi)).heat).toBe('in');
    expect(last(hit(s0, t.x, t.y, hi + 1)).heat).toBe('hot');
    expect(last(hit(s0, 0, 0, lo - 1))).toMatchObject({ kind: 'wild', heat: 'cold', offPx: null, perfect: false });
    expect(last(hit(s0, 0, 0, hi + 1)).heat).toBe('hot');
    // The shift matters: the unshifted low edge is cold for a craft shifted up.
    const shifted = [...Array(200).keys()].map((n) => createCraft(n, 'knife', ALLOY)).find((c) => c.bandShiftC > 0)!;
    const ts = run(shifted, [{ grab: true }, { drop: 'anvil' }]);
    const tt = ts.targets[0]!;
    expect(last(hit(ts, tt.x, tt.y, alloyProps(ALLOY).bandLowC)).heat).toBe('cold');
  });

  it('records offPx for hits only', () => {
    const s0 = onAnvil();
    const t = s0.targets[0]!;
    const mid = (s0.props.bandLowC + s0.props.bandHighC) / 2;
    expect(last(hit(s0, t.x + 3, t.y + 4, mid)).offPx).toBe(5);
    expect(last(hit(s0, 0, 0, mid)).offPx).toBeNull();
    // A repeat is not a hit.
    const once = hit(s0, t.x, t.y, mid);
    expect(last(hit(once, t.x, t.y, mid))).toMatchObject({ kind: 'repeat', offPx: null, perfect: false });
  });

  it('flags perfect for a hit within 1 px in the band, and not at 2 px or out of band', () => {
    const s0 = onAnvil();
    const t = s0.targets[0]!;
    const mid = (s0.props.bandLowC + s0.props.bandHighC) / 2;
    expect(last(hit(s0, t.x, t.y, mid))).toMatchObject({ offPx: 0, perfect: true });
    expect(last(hit(s0, t.x + 1, t.y, mid))).toMatchObject({ offPx: 1, perfect: true });
    expect(last(hit(s0, t.x + 2, t.y, mid))).toMatchObject({ offPx: 2, perfect: false });
    expect(last(hit(s0, t.x, t.y, s0.props.bandLowC - 1))).toMatchObject({ offPx: 0, heat: 'cold', perfect: false });
    expect(last(hit(s0, t.x, t.y, s0.props.bandHighC + 1))).toMatchObject({ offPx: 0, heat: 'hot', perfect: false });
  });

  it('counts the latest strikes in a row whose rounded lines sum to 0, and resets', () => {
    let s = onAnvil();
    const mid = (s.props.bandLowC + s.props.bandHighC) / 2;
    expect(cleanStreak(s)).toBe(0);
    s = hit(s, s.targets[0]!.x, s.targets[0]!.y, mid);
    s = hit(s, s.targets[1]!.x, s.targets[1]!.y, mid);
    expect(cleanStreak(s)).toBe(2);
    // 3.4 px off: 0.4 points, which rounds to 0, so the streak goes on.
    s = hit(s, s.targets[2]!.x + 3.4, s.targets[2]!.y, mid);
    expect(last(s).lines).toHaveLength(1);
    expect(cleanStreak(s)).toBe(3);
    // A cold strike loses 4 and ends it; two clean hits after it count 2.
    s = hit(s, s.targets[3]!.x, s.targets[3]!.y, s.props.bandLowC - 1);
    expect(cleanStreak(s)).toBe(0);
    s = hit(s, s.targets[4]!.x, s.targets[4]!.y, mid);
    s = hit(s, s.targets[5]!.x, s.targets[5]!.y, mid);
    expect(cleanStreak(s)).toBe(2);
    // A wild strike ends it.
    s = hit(s, 0, 0, mid);
    expect(cleanStreak(s)).toBe(0);
  });
});
