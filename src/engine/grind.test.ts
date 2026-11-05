import { describe, expect, it } from 'vitest';
import grading from '../data/grading.json';
import stats from '../data/stats.json';
import { itemById } from '../data/items';
import { createCraft, step, type CraftState, type Input } from './craft';
import { grade, type Graded } from './grade';
import { grindScoreOf, strokeScore } from './grind';
import { grindOut, strokePoints } from './grindFixture';
import { statsFor } from './stats';

// J7 (forge-depth spec, S6): the stroke score, the grind score and what the grind does to Edge.
const knife = itemById('knife');
const EDGE = knife.edgeLine!;
const G = stats.grind;
/** Points along the edge, 1 px apart in x, alternating `dy` px either side of the edge line. */
const along = (n: number, dy: number, x0 = EDGE.x0, stepX = 1) => Array.from({ length: n }, (_, i) => ({ x: x0 + i * stepX, y: EDGE.y0 + (i % 2 === 0 ? dy : -dy) }));

describe('stroke score', () => {
  it('scores a straight, even stroke along the whole edge 100', () => {
    expect(strokeScore(strokePoints('knife'), EDGE)).toBe(100);
  });

  it('scores an alternating ±6 px stroke 52 (100 − 8 × 6, an even step so cv 0)', () => {
    expect(strokeScore(along(89, 6), EDGE)).toBeCloseTo(52, 9);
  });

  it('scores a stroke with no movement 0, and a stroke that moves but covers none of the edge 0', () => {
    expect(strokeScore(Array.from({ length: 10 }, () => ({ x: 200, y: EDGE.y0 })), EDGE)).toBe(0);
    expect(strokeScore(Array.from({ length: 10 }, (_, i) => ({ x: 200, y: EDGE.y0 + i })), EDGE)).toBe(0);
  });

  it('takes the distance to the segment, so an overshoot costs, and a stroke off the line costs 8 per px', () => {
    // All points 3 px below the edge: distance 3, cv 0.
    expect(strokeScore(strokePoints('knife', 0).map((p) => ({ x: p.x, y: p.y + 3 })), EDGE)).toBeCloseTo(100 - G.perPx * 3, 9);
    // The points run on past the end: those beyond it are measured to the end point, not the line.
    const over = strokePoints('knife').map((p) => ({ x: p.x + 20, y: p.y }));
    const dist = over.reduce((t, p) => t + Math.max(0, p.x - EDGE.x1), 0) / over.length;
    expect(dist).toBeGreaterThan(0);
    expect(strokeScore(over, EDGE)).toBeLessThan(100);
  });

  it('penalises an uneven speed by perCv × cv', () => {
    // On the line; steps alternate 1 and 3 px: mean 2, population SD 1, cv 0.5. 36 steps cover 72 of 88 px (0.82 ≥ 0.8).
    const xs = [EDGE.x0];
    for (let i = 0; i < 36; i++) xs.push(xs[i]! + (i % 2 === 0 ? 1 : 3));
    expect(strokeScore(xs.map((x) => ({ x, y: EDGE.y0 })), EDGE)).toBeCloseTo(100 - G.perCv * 0.5, 9);
  });

  it('scales the score by cover ÷ minCover when the stroke covers less of the edge', () => {
    const len = EDGE.x1 - EDGE.x0;
    const half = Array.from({ length: 20 }, (_, i) => ({ x: EDGE.x0 + (len * 0.4 * i) / 19, y: EDGE.y0 }));
    expect(strokeScore(half, EDGE)).toBeCloseTo(100 * (0.4 / G.minCover), 9);
  });

  it('is the mean of the strokes', () => {
    expect(grindScoreOf([100, 52])).toBe(76);
  });
});

/** An ended knife of the default mix, every target hit twice dead centre, quenched at 830 °C and waiting in the grind. */
function quenched(): CraftState {
  const c = createCraft(7, 'knife', knife.defaultAlloy);
  const s: CraftState = {
    ...c, slag: [], location: 'held', heldFrom: 'anvil', temp: 830,
    targets: c.targets.map((t) => ({ ...t, hits: 2 })),
    strikes: c.targets.flatMap((_, i) => [0, 1].map(() => ({ step: 0, x: 0, y: 0, target: i, kind: 'hit' as const, crack: false, force: 0.5, heat: 'in' as const, offPx: 0, perfect: false, lines: [] }))),
  };
  return step(s, { drop: 'tub' });
}
const stroke = (s: CraftState, dy: number) => step(s, { stroke: along(89, dy) });

describe('J7 grind', () => {
  it('waits in the grind until 2 strokes, frozen at the quench heat, and ignores short strokes', () => {
    let s = quenched();
    expect(s.location).toBe('grind');
    expect(s.quenchC).toBe(830);
    expect(s.ruin).toBeNull();
    s = step(s, { stroke: along(4, 0) });
    expect(s.strokes).toEqual([]);
    s = step(s, { none: true });
    expect(s.temp).toBe(830);
    s = stroke(s, 0);
    expect(s.location).toBe('grind');
    expect(s.strokes).toEqual([100]);
    expect(s.grindScore).toBeNull();
    s = stroke(s, 6);
    expect(s.location).toBe('done');
    expect(s.grindScore).toBeCloseTo(76, 9);
  });

  it('ignores a stroke outside the grind, and a ruined quench does not grind', () => {
    const c = createCraft(7, 'knife', knife.defaultAlloy);
    expect(step(c, { stroke: along(10, 0) }).strokes).toEqual([]);
    const ruined = step({ ...c, location: 'held', heldFrom: 'fire', temp: 1300 }, { drop: 'tub' });
    expect(ruined.location).toBe('done');
    expect(ruined.ruin).toBe('white-quench');
  });

  it('sends a horseshoe from the quench straight to done', () => {
    const c = createCraft(7, 'horseshoe', itemById('horseshoe').defaultAlloy);
    const s = step({ ...c, location: 'held', heldFrom: 'anvil', temp: 830 }, { drop: 'tub' });
    expect(s.location).toBe('done');
    expect(s.grindScore).toBeNull();
    expect(grade(s).ruined).toBe(false);
  });

  it('gives Edge 83 with a perfect grind, 63 with a 52 grind and 83 with no grind (default mix, centred hits)', () => {
    const base = quenched();
    const edgeOf = (s: CraftState) => statsFor(s).edge!.value;
    expect(edgeOf({ ...base, location: 'done' })).toBe(83);
    expect(edgeOf({ ...base, location: 'done', strokes: [100, 100], grindScore: 100 })).toBe(83);
    expect(edgeOf({ ...base, location: 'done', strokes: [52, 52], grindScore: 52 })).toBe(63);
  });

  it('scales the hammer deductions by the other half and names an uneven grind when it is the worst', () => {
    const base = { ...quenched(), location: 'done' as const };
    const off = { ...base, strikes: base.strikes.map((k, i) => (i === 0 ? { ...k, offPx: 8 } : k)) };
    const plain = statsFor(off).edge!;
    const blended = statsFor({ ...off, strokes: [100, 100], grindScore: 100 }).edge!;
    // One of 18 hits is 8 px out: the mean overshoot is (8 − centrePx) ÷ 18, 10 points per px, halved with a grind.
    const lost = (stats.edge.perPx * (8 - grading.strike.centrePx)) / 18;
    expect(plain.value).toBe(Math.round((100 - lost) * 0.83));
    expect(blended.value).toBe(Math.round((100 - lost / 2) * 0.83));
    expect(blended.why).toBe(plain.why);
    expect(statsFor({ ...base, strokes: [0, 0], grindScore: 0 }).edge!.why).toBe(stats.why.grind);
  });

  it('halves the no-hits deduction: Edge is 100 × (1 − share) × multiplier lost when nothing was hit', () => {
    const c = { ...quenched(), strikes: [], location: 'done' as const };
    expect(statsFor(c).edge!.value).toBe(0);
    expect(statsFor({ ...c, strokes: [100, 100], grindScore: 100 }).edge!.value).toBe(Math.round(50 * 0.83));
  });

  it('does not change the score', () => {
    const good = grade(grindOut(quenched())) as Graded;
    let wavy = quenched();
    for (let i = 0; i < 2; i++) wavy = stroke(wavy, 8);
    const bad = grade(wavy) as Graded;
    const stroke0 = grade({ ...quenched(), location: 'done' }) as Graded;
    expect(good.score).toBe(stroke0.score);
    expect(bad.score).toBe(good.score);
    expect(good.stats.edge!.value).toBeGreaterThan(bad.stats.edge!.value);
  });

  it('puts the stroke into the log as it is', () => {
    const pts = along(10, 0);
    const s = step(quenched(), { stroke: pts });
    expect(s.log[s.log.length - 1]!.input).toEqual({ stroke: pts } satisfies Input);
  });
});
