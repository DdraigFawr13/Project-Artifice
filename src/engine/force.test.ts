import { describe, expect, it } from 'vitest';
import grading from '../data/grading.json';
import { itemById } from '../data/items';
import { createCraft, step, type CraftState, type Input, cleanStreak } from './craft';
import { grade, pointsLost } from './grade';
import { forceFromHold, idealForce, scoreStrike, type Target } from './strike';

// J3 (forge-depth spec, S2): strike force, light and hard strikes, cracks.
const knife = itemById('knife');
const ALLOY = knife.defaultAlloy;
const band = { bandLowC: 800, bandHighC: 1100 };
const t = (x: number, y: number, struck = false): Target => ({ x, y, struck });
const pts = (lines: { cause: string; points: number }[], cause: string) => lines.find((l) => l.cause === cause)?.points ?? 0;
const at = (s: CraftState, temp: number): CraftState => ({ ...s, temp });
function run(s: CraftState, inputs: Input[]): CraftState {
  for (const i of inputs) s = step(s, i);
  return s;
}
const onAnvil = (seed = 42): CraftState => run(createCraft(seed, 'knife', ALLOY), [{ grab: true }, { drop: 'anvil' }]);
const last = (s: CraftState) => s.strikes[s.strikes.length - 1]!;

describe('ideal force', () => {
  it('runs from 0.8 at the low edge to 0.3 at the high edge, straight between', () => {
    expect(idealForce(800, band)).toBeCloseTo(0.8);
    expect(idealForce(950, band)).toBeCloseTo(0.55);
    expect(idealForce(1100, band)).toBeCloseTo(0.3);
  });

  it('is clamped to 0.25..0.8 outside the band', () => {
    expect(idealForce(700, band)).toBe(0.8);
    expect(idealForce(300, band)).toBe(0.8);
    expect(idealForce(1200, band)).toBe(0.25);
  });

  it('makes 0.05 always light and 1.0 always hard', () => {
    for (let c = 0; c <= 1300; c += 10) {
      const ideal = idealForce(c, band);
      expect(0.05).toBeLessThan(ideal - grading.force.window);
      expect(1).toBeGreaterThan(ideal + grading.force.window);
    }
  });

  it('turns steps held into force: 40 steps (640 ms) is 1, none is 0', () => {
    expect(forceFromHold(40)).toBe(1);
    expect(forceFromHold(0)).toBe(0);
    expect(forceFromHold(100)).toBe(1);
    expect(forceFromHold(20)).toBeCloseTo(320 / 600);
  });
});

describe('scoreStrike with force', () => {
  it('a light strike changes nothing: no hit, no lines', () => {
    const s = scoreStrike([t(100, 100)], 100, 100, 950, band, 0.05);
    expect(s).toMatchObject({ kind: 'light', target: null, lines: [], perfect: false, crack: false });
    expect(scoreStrike([t(100, 100, true)], 100, 100, 950, band, 0.05).kind).toBe('light');
    expect(scoreStrike([t(100, 100)], 100, 100, 300, band, 0.05)).toMatchObject({ kind: 'light', crack: false, lines: [] });
  });

  it('a light edge: exactly ideal − window is right, just under is light', () => {
    const ideal = idealForce(950, band);
    expect(scoreStrike([t(100, 100)], 100, 100, 950, band, ideal - 0.15 + 1e-6).kind).toBe('hit');
    expect(scoreStrike([t(100, 100)], 100, 100, 950, band, ideal - 0.15 - 1e-6).kind).toBe('light');
  });

  it('a wild strike ignores force', () => {
    for (const f of [0.05, 0.5, 1]) expect(scoreStrike([t(100, 100)], 150, 100, 950, band, f)).toMatchObject({ kind: 'wild', lines: [{ cause: 'wild-strike', points: 2 }] });
  });

  it('a missing force is the ideal force', () => {
    const s = scoreStrike([t(100, 100)], 100, 100, 950, band);
    expect(s).toMatchObject({ kind: 'hit', lines: [], perfect: true });
  });

  it('a hard hit or repeat adds hard-strike −2; a hit in the band does not crack', () => {
    const hard = scoreStrike([t(100, 100)], 100, 100, 950, band, 1);
    expect(pts(hard.lines, 'hard-strike')).toBe(2);
    expect(hard).toMatchObject({ kind: 'hit', crack: false, perfect: false });
    const rep = scoreStrike([t(100, 100, true)], 100, 100, 950, band, 1);
    expect(rep.kind).toBe('repeat');
    expect(pts(rep.lines, 'hard-strike')).toBe(2);
  });

  it('a hard strike above the band does not crack; at the band edge it does not; one degree below it does', () => {
    expect(scoreStrike([t(100, 100)], 100, 100, 1101, band, 1).crack).toBe(false);
    expect(scoreStrike([t(100, 100)], 100, 100, 800, band, 1).crack).toBe(false);
    expect(scoreStrike([t(100, 100)], 100, 100, 799, band, 1).crack).toBe(true);
  });

  it('a right-force hit below the band does not crack unless black', () => {
    expect(scoreStrike([t(100, 100)], 100, 100, 700, band).crack).toBe(false);
    expect(scoreStrike([t(100, 100)], 100, 100, 549, band).crack).toBe(true);
    expect(scoreStrike([t(100, 100)], 100, 100, 550, band).crack).toBe(false);
    expect(scoreStrike([t(100, 100, true)], 100, 100, 549, band).crack).toBe(true);
  });

  it('perfect needs the right force', () => {
    expect(scoreStrike([t(100, 100)], 100, 100, 950, band, idealForce(950, band)).perfect).toBe(true);
    expect(scoreStrike([t(100, 100)], 100, 100, 950, band, 1).perfect).toBe(false);
  });
});

describe('cracks through the craft', () => {
  it('a light strike ends the clean streak and leaves rounds alone', () => {
    let s = onAnvil();
    const t0 = s.targets[0]!;
    const t1 = s.targets[1]!;
    s = step(at(s, 950), { strike: { x: t1.x, y: t1.y } });
    expect(cleanStreak(s)).toBe(1);
    s = step(at(s, 950), { strike: { x: t0.x, y: t0.y, force: 0.05 } });
    expect(cleanStreak(s)).toBe(0);
    expect(last(s)).toMatchObject({ kind: 'light', force: 0.05, crack: false });
    expect(s.targets[0]!.hits).toBe(0);
    expect(pointsLost(s)).toBe(0);
    expect(s.targets[1]!.hits).toBe(1);
  });

  it('records the force sent, or the ideal when missing', () => {
    let s = onAnvil();
    const t0 = s.targets[0]!;
    s = step(at(s, 950), { strike: { x: t0.x, y: t0.y } });
    expect(last(s).force).toBeCloseTo(idealForce(950, s.props), 5);
  });

  it('three hard strikes below the working band end the craft as cracked', () => {
    let s = onAnvil();
    const T = s.props.bandLowC - 20;
    for (let i = 0; i < 2; i++) {
      const tg = s.targets[i]!;
      s = step(at(s, T), { strike: { x: tg.x, y: tg.y, force: 1 } });
      expect(last(s).crack).toBe(true);
    }
    expect(s.ruin).toBeNull();
    const tg = s.targets[2]!;
    s = step(at(s, T), { strike: { x: tg.x, y: tg.y, force: 1 } });
    expect(s).toMatchObject({ location: 'done', ruin: 'cracked' });
    expect(grade(s)).toEqual({ ruined: true, ruin: 'cracked', scrapParts: 2 });
  });

  it('hard strikes in the band, or right-force hits below it, never ruin', () => {
    let s = onAnvil();
    for (let i = 0; i < 3; i++) {
      const tg = s.targets[i]!;
      s = step(at(s, s.props.bandLowC + 10), { strike: { x: tg.x, y: tg.y, force: 1 } });
    }
    expect(s.ruin).toBeNull();
    expect(s.strikes.filter((k) => k.lines.some((l) => l.cause === 'hard-strike'))).toHaveLength(3);
  });

  it('a strike both black and hard counts once', () => {
    let s = onAnvil();
    const tg = s.targets[0]!;
    s = step(at(s, 300), { strike: { x: tg.x, y: tg.y, force: 1 } });
    expect(s.strikes.filter((k) => k.crack)).toHaveLength(1);
  });
});
