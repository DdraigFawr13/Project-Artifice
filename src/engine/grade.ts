import type { CraftState } from './craft';
import { CAUSES, type CauseId, type Line } from './strike';

/** Points lost so far per cause, in fractions: every strike's lines plus the per-second causes. */
function rawLost(state: CraftState): Map<CauseId, number> {
  const sum = new Map<CauseId, number>();
  const add = (c: CauseId, p: number) => sum.set(c, (sum.get(c) ?? 0) + p);
  for (const s of state.strikes) for (const l of s.lines) add(l.cause, l.points);
  for (const [c, p] of Object.entries(state.lost) as [CauseId, number][]) add(c, p);
  return sum;
}

/**
 * The live lines during a craft: each cause rounded to a whole number, zeros hidden, in display order (forge spec,
 * Engine → grade). Missed targets are charged at the quench (S4), so they are not here.
 */
export function liveLines(state: CraftState): Line[] {
  const raw = rawLost(state);
  return CAUSES.map((cause) => ({ cause, points: Math.round(raw.get(cause) ?? 0) })).filter((l) => l.points > 0);
}

/** The live total: the sum of the shown lines, so they always add up. */
export function pointsLost(state: CraftState): number {
  return liveLines(state).reduce((a, l) => a + l.points, 0);
}
