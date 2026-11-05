import { describe, expect, it } from 'vitest';
import { itemById } from '../data/items';
import { createCraft, PASSES, step, type CraftState, type Input } from './craft';
import { grade, tierFor, type Graded } from './grade';
import { quenchLines } from './quench';

// J4 Quench and grade (forge spec; S4 "Settled at S4 start"): the sum rule, rounding, the floor at 0, the tiers,
// every ruin rule and the scrap returned.
const knife = itemById('knife');
const ALLOY = knife.defaultAlloy;
const at = (s: CraftState, temp: number): CraftState => ({ ...s, temp });
function run(s: CraftState, inputs: Input[]): CraftState {
  for (const i of inputs) s = step(s, i);
  return s;
}
/** A knife on the anvil at `temp`, with every target hit in both rounds dead centre. */
function worked(temp = 950): CraftState {
  let s = at(run(createCraft(3, 'knife', ALLOY), [{ grab: true }, { drop: 'anvil' }]), temp);
  for (let r = 0; r < PASSES; r++) for (const t of s.targets) s = at(step(s, { strike: { x: t.x, y: t.y } }), temp);
  return s;
}
/** Quench at exactly `temp`: pick the piece up and drop it in the tub with the heat held there. */
function quench(s: CraftState, temp: number): CraftState {
  s = at(step(s, { grab: true }), temp);
  return step(s, { drop: 'tub' });
}
const graded = (s: CraftState) => {
  const g = grade(s);
  if (g.ruined) throw new Error(`ruined: ${g.ruin}`);
  return g as Graded;
};

describe('quench', () => {
  it('ends the craft in the tub at that step\'s temperature, before any cooling', () => {
    const s = quench(worked(), 850);
    expect(s).toMatchObject({ location: 'done', quenchC: 850, ruin: null });
    // A done craft takes no more input.
    expect(step(s, { grab: true })).toBe(s);
  });

  it('only quenches a held piece', () => {
    const s = step(worked(), { drop: 'tub' });
    expect(s.location).toBe('anvil');
    expect(s.quenchC).toBeNull();
  });

  it('costs nothing inside 780–880 °C and 1 point per 25 °C outside, in fractions', () => {
    expect(quenchLines(780)).toEqual([]);
    expect(quenchLines(880)).toEqual([]);
    expect(quenchLines(830)).toEqual([]);
    expect(quenchLines(755)).toEqual([{ cause: 'quench-cold', points: 1 }]);
    expect(quenchLines(905)).toEqual([{ cause: 'quench-hot', points: 1 }]);
    expect(quenchLines(890)[0]!.points).toBeCloseTo(0.4);
  });
});

describe('grade', () => {
  it('scores a clean knife 100, Masterwork, with the alloy\'s quality beside it', () => {
    const g = graded(quench(worked(), 830));
    expect(g).toMatchObject({ ruined: false, score: 100, tier: 'Masterwork', materialQuality: 56, lines: [] });
  });

  it('charges 5 per missing hit, so a target never hit costs 10', () => {
    let s = at(run(createCraft(3, 'knife', ALLOY), [{ grab: true }, { drop: 'anvil' }]), 950);
    const t = s.targets;
    // Round 1 complete, then round 2 on all but targets 7 and 8: 2 hits missing.
    for (const p of t) s = at(step(s, { strike: { x: p.x, y: p.y } }), 950);
    for (const p of t.slice(0, 7)) s = at(step(s, { strike: { x: p.x, y: p.y } }), 950);
    expect(graded(quench(s, 830)).lines).toEqual([{ cause: 'missed-target', points: 10, count: 2 }]);
    // No strikes at all: every hit is missing (18 hits × 5).
    const bare = run(createCraft(3, 'knife', ALLOY), [{ grab: true }]);
    const g = graded(step(at(bare, 830), { drop: 'tub' }));
    expect(g.lines).toEqual([{ cause: 'missed-target', points: 90, count: 18 }]);
    expect(g.score).toBe(10);
  });

  it('rounds each line, then takes the sum from 100, so the shown lines add up', () => {
    // A quench 10 °C over: 0.4 points, shown as nothing. Two strikes 3.4 px off: 0.4 each, 0.8 in all, shown as 1.
    let s = worked();
    s = { ...s, strikes: [...s.strikes, ...[0, 1].map((i) => ({ step: 1, x: 0, y: 0, target: i, kind: 'repeat' as const, crack: false, force: 0.5, heat: 'in' as const, offPx: null, perfect: false, lines: [{ cause: 'off-centre' as const, points: 0.4 }] }))] };
    const g = graded(quench(s, 890));
    expect(g.lines).toEqual([{ cause: 'off-centre', points: 1, count: 2 }]);
    expect(g.score).toBe(99);
    // Two causes of 0.4 each: both lines round to 0, so nothing is charged (rounding the 0.8 sum would charge 1).
    let t = worked();
    t = { ...t, strikes: [...t.strikes, { step: 1, x: 0, y: 0, target: 0, kind: 'repeat' as const, crack: false, force: 0.5, heat: 'in' as const, offPx: null, perfect: false, lines: [{ cause: 'off-centre' as const, points: 0.4 }] }] };
    const h = graded(quench(t, 890));
    expect(h.lines).toEqual([]);
    expect(h.score).toBe(100);
  });

  it('gives counts for the wording: strikes per cause, whole seconds, and 1 for the quench', () => {
    let s = worked();
    s = { ...s, lost: { 'out-of-band': 8.2, burning: 10 } };
    const g = graded(quench(s, 980));
    expect(g.lines).toEqual([
      { cause: 'out-of-band', points: 8, count: 4 },
      { cause: 'burning', points: 10, count: 2 },
      { cause: 'quench-hot', points: 4, count: 1 },
    ]);
    expect(g.score).toBe(78);
    // A line shown is never "for 0 s": under half a second still reads 1 s.
    const short = graded(quench({ ...worked(), lost: { 'out-of-band': 0.6 } }, 830));
    expect(short.lines).toEqual([{ cause: 'out-of-band', points: 1, count: 1 }]);
  });

  it('never scores below 0', () => {
    let s = worked();
    s = { ...s, lost: { burning: 150 } };
    expect(graded(quench(s, 830)).score).toBe(0);
  });

  it('places the tiers at their edges', () => {
    expect([0, 39, 40, 59, 60, 74, 75, 89, 90, 100].map(tierFor)).toEqual([
      'Crude', 'Crude', 'Common', 'Common', 'Fine', 'Fine', 'Superior', 'Superior', 'Masterwork', 'Masterwork',
    ]);
  });

  it('only grades a craft that has ended', () => {
    expect(() => grade(worked())).toThrow();
  });
});

describe('ruin', () => {
  it('a quench at 1200 °C or more is a white-quench ruin, with half the parts back as scrap, rounded down', () => {
    expect(quench(worked(), 1199).ruin).toBeNull();
    const s = quench(worked(), 1200);
    expect(s).toMatchObject({ location: 'done', ruin: 'white-quench' });
    expect(grade(s)).toEqual({ ruined: true, ruin: 'white-quench', scrapParts: 2 });
  });

  it('three strikes on black metal are a cracked ruin, with the same scrap', () => {
    let s = at(run(createCraft(3, 'knife', ALLOY), [{ grab: true }, { drop: 'anvil' }]), 300);
    for (const t of s.targets.slice(0, 3)) s = at(step(s, { strike: { x: t.x, y: t.y } }), 300);
    expect(grade(s)).toEqual({ ruined: true, ruin: 'cracked', scrapParts: 2 });
  });

  it('returns floor(parts ÷ 2) for every item', () => {
    for (const [id, scrap] of [['horseshoe', 1], ['knife', 2], ['sword', 4]] as const) {
      const item = itemById(id);
      let s = run(createCraft(1, id, item.defaultAlloy), [{ grab: true }]);
      s = step(at(s, 1300), { drop: 'tub' });
      expect(grade(s)).toEqual({ ruined: true, ruin: 'white-quench', scrapParts: scrap });
    }
  });
});
