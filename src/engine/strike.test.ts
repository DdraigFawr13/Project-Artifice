import { describe, expect, it } from 'vitest';
import { scoreStrike, type Target } from './strike';

// J3 (docs/specs/forge-prototype.md; Data → grading.json; S3 "Settled at S3 start").
const band = { bandLowC: 800, bandHighC: 1100 };
const WORK = 950;
const t = (x: number, y: number, struck = false): Target => ({ x, y, struck });
const pts = (lines: { cause: string; points: number }[], cause: string) => lines.find((l) => l.cause === cause)?.points ?? 0;

describe('scoreStrike', () => {
  it('counts for the nearest unstruck target, ties to the lower index', () => {
    const targets = [t(100, 100), t(120, 100), t(140, 100)];
    expect(scoreStrike(targets, 118, 100, WORK, band).target).toBe(1);
    expect(scoreStrike(targets, 110, 100, WORK, band).kind).toBe('wild'); // 10 px from both: out of reach
    expect(scoreStrike([t(100, 100), t(116, 100)], 108, 100, WORK, band).target).toBe(0); // 8 px from both: a tie
  });

  it('skips struck targets when an unstruck one is in reach', () => {
    const targets = [t(100, 100, true), t(108, 100)];
    const s = scoreStrike(targets, 101, 100, WORK, band);
    expect(s.kind).toBe('hit');
    expect(s.target).toBe(1);
  });

  it('charges nothing within 3 px, then 1 per px beyond, in fractions, up to 6 at the 9 px reach', () => {
    const one = [t(100, 100)];
    expect(scoreStrike(one, 103, 100, WORK, band).lines).toEqual([]);
    expect(pts(scoreStrike(one, 100, 104.5, WORK, band).lines, 'off-centre')).toBeCloseTo(1.5);
    expect(pts(scoreStrike(one, 103, 104, WORK, band).lines, 'off-centre')).toBeCloseTo(2); // 5 px, straight line
    const edge = scoreStrike(one, 109, 100, WORK, band);
    expect(edge.kind).toBe('hit'); // the reach is inclusive
    expect(pts(edge.lines, 'off-centre')).toBe(6);
  });

  it('is a wild strike (−2) with no target in reach, and touches no target', () => {
    const s = scoreStrike([t(100, 100)], 110, 100, WORK, band);
    expect(s).toMatchObject({ kind: 'wild', target: null });
    expect(s.lines).toEqual([{ cause: 'wild-strike', points: 2 }]);
  });

  it('is a repeat (−1) when only a struck target is in reach', () => {
    const s = scoreStrike([t(100, 100, true), t(140, 100)], 101, 100, WORK, band);
    expect(s).toMatchObject({ kind: 'repeat', target: null });
    expect(pts(s.lines, 'repeat-strike')).toBe(1);
    expect(pts(s.lines, 'off-centre')).toBe(0);
  });

  it('adds −4 below the working band and −2 above it, on top of off-centre points', () => {
    const cold = scoreStrike([t(100, 100)], 105, 100, 799, band);
    expect(pts(cold.lines, 'cold-strike')).toBe(4);
    expect(pts(cold.lines, 'off-centre')).toBeCloseTo(2);
    expect(pts(scoreStrike([t(100, 100)], 100, 100, 1101, band).lines, 'hot-strike')).toBe(2);
    expect(scoreStrike([t(100, 100)], 100, 100, 800, band).lines).toEqual([]); // band edges are in the band
    expect(pts(scoreStrike([t(100, 100, true)], 100, 100, 700, band).lines, 'cold-strike')).toBe(4); // repeats hit metal too
  });

  it('charges no heat points on a wild strike, and flags black-band hits only', () => {
    const wild = scoreStrike([t(100, 100)], 150, 100, 300, band);
    expect(wild.lines).toEqual([{ cause: 'wild-strike', points: 2 }]);
    expect(wild.black).toBe(false);
    expect(scoreStrike([t(100, 100)], 100, 100, 549, band).black).toBe(true);
    expect(scoreStrike([t(100, 100)], 100, 100, 550, band).black).toBe(false);
  });
});
