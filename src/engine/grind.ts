import stats from '../data/stats.json';

const G = stats.grind;

export interface Pt {
  x: number;
  y: number;
}
export interface EdgeSegment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * One stroke's score, 0–100 (forge spec S6): 100 − `perPx` × the mean distance from the points to the edge segment
 * − `perCv` × the coefficient of variation of the steps between points (population SD ÷ mean), clamped, times
 * min(1, cover ÷ `minCover`), where cover is the points' spread along the edge ÷ its length. A stroke that doesn't
 * move (mean step 0) scores 0. Pure.
 */
export function strokeScore(points: readonly Pt[], edge: EdgeSegment): number {
  const dx = edge.x1 - edge.x0;
  const dy = edge.y1 - edge.y0;
  const len2 = dx * dx + dy * dy;
  const dists: number[] = [];
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of points) {
    const t = ((p.x - edge.x0) * dx + (p.y - edge.y0) * dy) / len2;
    const c = Math.min(1, Math.max(0, t));
    dists.push(Math.hypot(p.x - (edge.x0 + c * dx), p.y - (edge.y0 + c * dy)));
    lo = Math.min(lo, t);
    hi = Math.max(hi, t);
  }
  const steps: number[] = [];
  for (let i = 1; i < points.length; i++) steps.push(Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y));
  const meanStep = steps.reduce((a, b) => a + b, 0) / steps.length;
  if (!(meanStep > 0)) return 0;
  const sd = Math.sqrt(steps.reduce((a, s) => a + (s - meanStep) ** 2, 0) / steps.length);
  const distance = dists.reduce((a, b) => a + b, 0) / dists.length;
  // `t` is the projection as a share of the edge's length, so its spread is the cover.
  const cover = hi - lo;
  const base = Math.min(100, Math.max(0, 100 - G.perPx * distance - G.perCv * (sd / meanStep)));
  return base * Math.min(1, cover / G.minCover);
}

/** The grind score: the mean of the strokes' scores, unrounded (forge spec S6). */
export function grindScoreOf(strokes: readonly number[]): number {
  return strokes.reduce((a, b) => a + b, 0) / strokes.length;
}
