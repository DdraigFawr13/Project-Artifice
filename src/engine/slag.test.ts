import { describe, expect, it } from 'vitest';
import { itemById } from '../data/items';
import { cleanStreak, createCraft, step, type CraftState, type Input } from './craft';
import { grade, liveLines, pointsLost, type Graded } from './grade';
import { scoreStrike, type Target } from './strike';
import { grindOut } from './grindFixture';

// J4 (forge-depth spec, S3): slag spots in the bar, how many, where, what they block, and what they cost.
const knife = itemById('knife');
const ALLOY = knife.defaultAlloy;
const run = (s: CraftState, inputs: Input[]): CraftState => inputs.reduce(step, s);
const onAnvil = (seed = 42, item = 'knife', alloy = ALLOY): CraftState => run(createCraft(seed, item, alloy), [{ grab: true }, { drop: 'anvil' }]);
const mid = (s: CraftState) => (s.props.bandLowC + s.props.bandHighC) / 2;
/** Strike (x, y) with the metal held mid-band (the ideal force is the default). */
const hit = (s: CraftState, x: number, y: number, force?: number): CraftState => step({ ...s, temp: mid(s) }, { strike: { x, y, force } });
const last = (s: CraftState) => s.strikes[s.strikes.length - 1]!;
/** A spot with no spot in the next gap either side, so clearing it frees both its neighbours. */
const isolated = (s: CraftState): number => {
  const i = s.slag.findIndex((p) => !s.slag.some((q) => Math.abs(q.gap - p.gap) === 1));
  expect(i).toBeGreaterThanOrEqual(0);
  return i;
};
const cleared = (s: CraftState, ...idx: number[]): CraftState => ({ ...s, slag: s.slag.map((p, i) => ({ ...p, cleared: p.cleared || idx.includes(i) })) });

describe('slag count', () => {
  it('follows the mix and the item', () => {
    expect(createCraft(42, 'knife', ALLOY).slag).toHaveLength(3);
    expect(createCraft(42, 'knife', { ore1: 1, ore2: 2, ore3: 2 }).slag).toHaveLength(2);
    expect(createCraft(42, 'sword', itemById('sword').defaultAlloy).slag).toHaveLength(4);
    expect(createCraft(42, 'horseshoe', itemById('horseshoe').defaultAlloy).slag).toHaveLength(2);
  });
});

describe('slag placement', () => {
  it('is the same for a seed, on distinct gaps, at the midpoint of the two targets', () => {
    const gapsSeen = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      const a = createCraft(seed, 'knife', ALLOY);
      expect(createCraft(seed, 'knife', ALLOY).slag).toEqual(a.slag);
      expect(new Set(a.slag.map((p) => p.gap)).size).toBe(a.slag.length);
      for (const p of a.slag) {
        const [t0, t1] = [a.targets[p.gap]!, a.targets[p.gap + 1]!];
        expect(p).toEqual({ x: Math.round((t0.x + t1.x) / 2), y: Math.round((t0.y + t1.y) / 2), gap: p.gap, cleared: false });
        expect(p.gap).toBeGreaterThanOrEqual(0);
        expect(p.gap).toBeLessThan(a.targets.length - 1);
      }
      gapsSeen.add(a.slag.map((p) => p.gap).join(','));
    }
    expect(gapsSeen.size).toBeGreaterThan(5);
  });

  it('seed 42, default knife mix: pinned gaps and target coordinates', () => {
    const s = createCraft(42, 'knife', ALLOY);
    expect(s.slag.map((p) => p.gap)).toEqual([2, 4, 1]);
    expect(s.targets.map((t) => [t.x, t.y])).toEqual([[130, 387], [152, 389], [168, 388], [189, 391], [215, 390], [231, 393], [256, 389], [272, 390], [296, 389]]);
  });

  it('leaves the target positions alone', () => {
    expect(createCraft(42, 'knife', ALLOY).targets.map((t) => [t.x, t.y])).toEqual(createCraft(42, 'knife', { ore2: 4, ore3: 1 }).targets.map((t) => [t.x, t.y]));
  });
});

describe('clearing and reach', () => {
  const s0 = onAnvil();
  const p = s0.slag[0]!;

  it('a strike within 6 px of a spot clears it, 7 px does not', () => {
    const near = hit(s0, p.x, p.y + 6);
    expect(last(near)).toMatchObject({ kind: 'slag', slag: 0, target: null, offPx: null, perfect: false });
    expect(near.slag[0]!.cleared).toBe(true);
    const far = hit(s0, p.x, p.y + 7);
    expect(far.slag[0]!.cleared).toBe(false);
    expect(last(far).kind).not.toBe('slag');
  });

  it('a clearing strike counts no hit, has no off-centre line, and a clean one has no lines', () => {
    const s = hit(s0, p.x, p.y);
    expect(s.targets.every((t) => t.hits === 0)).toBe(true);
    expect(last(s).lines).toEqual([]);
  });

  it('a clearing strike carries cold, hard-strike and crack as a hit does', () => {
    const cold = step({ ...s0, temp: s0.props.bandLowC - 1 }, { strike: { x: p.x, y: p.y } });
    expect(last(cold)).toMatchObject({ kind: 'slag', heat: 'cold' });
    expect(last(cold).lines.map((l) => l.cause)).toEqual(['cold-strike']);
    const hard = hit(s0, p.x, p.y, 1);
    expect(last(hard).lines.map((l) => l.cause)).toEqual(['hard-strike']);
    const hardCold = step({ ...s0, temp: s0.props.bandLowC - 1 }, { strike: { x: p.x, y: p.y, force: 1 } });
    expect(last(hardCold).crack).toBe(true);
    const black = step({ ...s0, temp: 300 }, { strike: { x: p.x, y: p.y } });
    expect(last(black)).toMatchObject({ kind: 'slag', crack: true });
  });

  it('a light strike on a spot changes nothing', () => {
    const s = hit(s0, p.x, p.y, 0.05);
    expect(last(s)).toMatchObject({ kind: 'light', lines: [] });
    expect(s.slag[0]!.cleared).toBe(false);
  });

  it('a cleared spot is no longer in reach', () => {
    const s = hit(hit(s0, p.x, p.y), p.x, p.y);
    expect(last(s).kind).not.toBe('slag');
    expect(s.slag.filter((q) => q.cleared)).toHaveLength(1);
  });
});

describe('scoreStrike candidates (target reach 9 px, spot reach 6 px)', () => {
  const band = { bandLowC: 700, bandHighC: 900 };
  const open: Target = { x: 100, y: 100, struck: false };
  const score = (targets: Target[], x: number, spots: { x: number; y: number }[]) => scoreStrike(targets, x, 100, 800, band, undefined, spots);

  it('a strike nearer a spot than an open target clears the spot', () => {
    const sc = score([open], 104, [{ x: 106, y: 100 }]);
    expect(sc).toMatchObject({ kind: 'slag', slag: 0, target: null });
  });

  it('a strike nearer the target than the spot hits the target', () => {
    const sc = score([open], 102, [{ x: 106, y: 100 }]);
    expect(sc).toMatchObject({ kind: 'hit', target: 0 });
    expect(sc.slag).toBeUndefined();
  });

  it('equal distance goes to the target', () => {
    const sc = score([open], 103, [{ x: 106, y: 100 }]);
    expect(sc).toMatchObject({ kind: 'hit', target: 0 });
  });

  it('a spot within 6 px beats a closed target: slag, not a repeat', () => {
    const sc = score([{ ...open, struck: true }], 103, [{ x: 106, y: 100 }]);
    expect(sc).toMatchObject({ kind: 'slag', slag: 0 });
    expect(sc.lines).toEqual([]);
  });

  it('a strike 7 to 9 px from a target and over 6 px from any spot hits the target', () => {
    for (const d of [7, 8, 9]) {
      const sc = score([open], 100 + d, [{ x: 100 + d + 7, y: 100 }]);
      expect(sc).toMatchObject({ kind: 'hit', target: 0 });
    }
    expect(score([open], 110, [{ x: 117, y: 100 }]).kind).toBe('wild');
  });
});

describe('blocking', () => {
  const s0 = onAnvil();
  const pi = isolated(s0);
  const p = s0.slag[pi]!;
  const left = s0.targets[p.gap]!;
  const right = s0.targets[p.gap + 1]!;

  it('a spot holds both its neighbours: a strike on either is blocked (−1, no hit)', () => {
    for (const [i, t] of [left, right].entries()) {
      const s = hit(s0, t.x, t.y);
      expect(last(s)).toMatchObject({ kind: 'blocked', target: null, offPx: null, perfect: false });
      expect(last(s).lines).toEqual([{ cause: 'blocked-strike', points: 1 }]);
      expect(s.targets[p.gap + i]!.hits).toBe(0);
    }
  });

  it('a blocked strike carries the other lines of a hit, and can crack', () => {
    const cold = step({ ...s0, temp: s0.props.bandLowC - 1 }, { strike: { x: left.x, y: left.y } });
    expect(last(cold).lines.map((l) => l.cause)).toEqual(['blocked-strike', 'cold-strike']);
    const hardCold = step({ ...s0, temp: s0.props.bandLowC - 1 }, { strike: { x: left.x, y: left.y, force: 1 } });
    expect(last(hardCold).lines.map((l) => l.cause)).toEqual(['blocked-strike', 'cold-strike', 'hard-strike']);
    expect(last(hardCold).crack).toBe(true);
  });

  it('clearing the spot unblocks both neighbours', () => {
    const s = hit(s0, p.x, p.y);
    for (const t of [left, right]) expect(last(hit(s, t.x, t.y)).kind).toBe('hit');
  });

  it('a target away from every spot is open from the start', () => {
    const free = s0.targets.findIndex((_, i) => !s0.slag.some((q) => q.gap === i || q.gap === i - 1));
    expect(free).toBeGreaterThanOrEqual(0);
    const t = s0.targets[free]!;
    expect(last(hit(s0, t.x, t.y)).kind).toBe('hit');
  });

  it('an unblocked target hits once, then a second strike on it is a repeat', () => {
    const s = hit(cleared(s0, pi), left.x, left.y);
    expect(last(s).kind).toBe('hit');
    const again = hit(s, left.x, left.y);
    expect(last(again).kind).toBe('repeat');
  });
});

describe('the quench and the streak', () => {
  const finish = (s: CraftState): Graded => {
    const held = step({ ...s, temp: 830 }, { grab: true });
    return grade(grindOut(step({ ...held, temp: 830 }, { drop: 'tub' }))) as Graded;
  };

  it('charges −3 per spot left at the quench, counted as spots', () => {
    const s = onAnvil();
    const withSlag = finish(s);
    const line = withSlag.lines.find((l) => l.cause === 'slag-left');
    expect(line).toMatchObject({ points: 9, count: 3 });
    expect(withSlag.score).toBe(1);
    const one = finish(cleared(s, 0, 1));
    expect(one.lines.find((l) => l.cause === 'slag-left')).toMatchObject({ points: 3, count: 1 });
    expect(finish({ ...s, slag: [] }).lines.some((l) => l.cause === 'slag-left')).toBe(false);
    expect(finish({ ...s, slag: [] }).score).toBe(10);
  });

  it('lists blocked-strike after repeat-strike and slag-left after missed-target', () => {
    const s0 = onAnvil();
    const t = s0.targets[s0.slag[0]!.gap]!;
    const g = finish(hit(s0, t.x, t.y));
    const causes = g.lines.map((l) => l.cause);
    expect(causes).toContain('blocked-strike');
    expect(causes.indexOf('missed-target')).toBeLessThan(causes.indexOf('slag-left'));
  });

  it('counts slag clears in the clean streak, and a blocked strike ends it', () => {
    let s = onAnvil();
    const pi = isolated(s);
    const p = s.slag[pi]!;
    const free = s.targets.findIndex((_, i) => !s.slag.some((q) => q.gap === i || q.gap === i - 1));
    s = hit(s, s.targets[free]!.x, s.targets[free]!.y);
    s = hit(s, p.x, p.y);
    expect(last(s).kind).toBe('slag');
    expect(cleanStreak(s)).toBe(2);
    s = hit(s, s.targets[p.gap]!.x, s.targets[p.gap]!.y);
    expect(cleanStreak(s)).toBe(3);
    const q = s.slag.find((x) => !x.cleared)!;
    s = hit(s, s.targets[q.gap]!.x, s.targets[q.gap]!.y);
    expect(last(s).kind).toBe('blocked');
    expect(cleanStreak(s)).toBe(0);
  });

  it('slag-left is charged only at grade(): not in the live lines before the quench, not on a cracked ruin', () => {
    const s = onAnvil();
    expect(liveLines(s).some((l) => l.cause === 'slag-left')).toBe(false);
    expect(pointsLost(s)).toBe(liveLines(s).reduce((a, l) => a + l.points, 0));
    expect(liveLines(s).some((l) => l.cause === 'slag-left')).toBe(false);
    expect(finish(s).lines.some((l) => l.cause === 'slag-left')).toBe(true);

    const free = s.targets.findIndex((_, i) => !s.slag.some((q) => q.gap === i || q.gap === i - 1));
    const t = s.targets[free]!;
    let c = s;
    for (let i = 0; i < 3; i++) c = step({ ...c, temp: 300 }, { strike: { x: t.x, y: t.y } });
    expect(c.ruin).toBe('cracked');
    expect(c.slag.some((p) => !p.cleared)).toBe(true);
    expect(grade(c)).toMatchObject({ ruined: true, ruin: 'cracked' });
    expect('lines' in grade(c)).toBe(false);
  });
});
