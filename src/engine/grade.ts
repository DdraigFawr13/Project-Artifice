import grading from '../data/grading.json';
import { itemById } from '../data/items';
import { PASSES, type CraftState, type Ruin } from './craft';
import { materialQuality } from './alloy';
import { quenchLines } from './quench';
import { CAUSES, type CauseId, type Line } from './strike';

export type Tier = 'Crude' | 'Common' | 'Fine' | 'Superior' | 'Masterwork';

/** A result line: whole points, and a count for its wording (strikes, missing hits, whole seconds, or 1 for the quench). */
export interface ResultLine extends Line {
  count: number;
}

export interface Graded {
  ruined: false;
  score: number;
  tier: Tier;
  /** The alloy's quality, rounded; shown beside the score, never in it (D-005). */
  materialQuality: number;
  lines: ResultLine[];
}
export interface Ruined {
  ruined: true;
  ruin: Ruin;
  scrapParts: number;
}
export type GradeResult = Graded | Ruined;

const PER_SECOND: Partial<Record<CauseId, number>> = { 'out-of-band': grading.perSecond.outOfBand, burning: grading.perSecond.burning };

/** Points lost so far per cause, in fractions, with counts: every strike's lines plus the per-second causes. */
function rawLost(state: CraftState): Map<CauseId, { points: number; count: number }> {
  const sum = new Map<CauseId, { points: number; count: number }>();
  const add = (c: CauseId, p: number, n: number) => {
    const v = sum.get(c) ?? { points: 0, count: 0 };
    sum.set(c, { points: v.points + p, count: v.count + n });
  };
  for (const s of state.strikes) for (const l of s.lines) add(l.cause, l.points, 1);
  for (const [c, p] of Object.entries(state.lost) as [CauseId, number][]) add(c, p, Math.max(1, Math.round(p / (PER_SECOND[c] ?? 1))));
  return sum;
}

/** Round each cause to whole points, hide zeros, in display order (forge spec, Engine → grade). */
function rounded(raw: Map<CauseId, { points: number; count: number }>): ResultLine[] {
  return CAUSES.flatMap((cause) => {
    const v = raw.get(cause);
    const points = Math.round(v?.points ?? 0);
    return v && points > 0 ? [{ cause, points, count: v.count }] : [];
  });
}

/**
 * The live lines during a craft: each cause rounded to a whole number, zeros hidden, in display order. Missed hits
 * and the quench are charged when the craft ends, so they are not here.
 */
export function liveLines(state: CraftState): Line[] {
  return rounded(rawLost(state)).map(({ cause, points }) => ({ cause, points }));
}

/** The live total: the sum of the shown lines, so they always add up. */
export function pointsLost(state: CraftState): number {
  return liveLines(state).reduce((a, l) => a + l.points, 0);
}

export function tierFor(score: number): Tier {
  let tier = grading.tiers[0]!.name;
  for (const t of grading.tiers) if (score >= t.min) tier = t.name;
  return tier as Tier;
}

/**
 * Grade an ended craft (forge spec, Engine → grade): score = max(0, 100 − the sum of the rounded lines), so the shown
 * lines always add up; or a ruin with floor(parts ÷ 2) parts back as scrap.
 */
export function grade(state: CraftState): GradeResult {
  if (state.location !== 'done') throw new Error('Only an ended craft is graded');
  if (state.ruin) return { ruined: true, ruin: state.ruin, scrapParts: Math.floor(itemById(state.itemId).parts * grading.ruin.scrapShare) };
  const raw = rawLost(state);
  const missing = state.targets.reduce((n, t) => n + Math.max(0, PASSES - t.hits), 0);
  if (missing > 0) raw.set('missed-target', { points: missing * grading.missedHit, count: missing });
  const slagLeft = state.slag.filter((p) => !p.cleared).length;
  if (slagLeft > 0) raw.set('slag-left', { points: slagLeft * grading.slag.left, count: slagLeft });
  for (const l of quenchLines(state.quenchC ?? 0)) raw.set(l.cause, { points: l.points, count: 1 });
  const lines = rounded(raw);
  const score = Math.max(0, 100 - lines.reduce((a, l) => a + l.points, 0));
  return { ruined: false, score, tier: tierFor(score), materialQuality: materialQuality(state.alloy), lines };
}
