import grading from '../data/grading.json';
import { bandAt } from '../data/heatBands';

/** One fixed step, in ms (forge spec, Engine); craft.ts re-exports it. */
export const STEP_MS = 16;

/** Why points were lost (forge spec, Engine). */
export type CauseId =
  | 'off-centre' | 'wild-strike' | 'cold-strike' | 'hot-strike' | 'hard-strike' | 'repeat-strike'
  | 'missed-target' | 'out-of-band' | 'burning' | 'quench-hot' | 'quench-cold';

/** Every cause in display order. */
export const CAUSES: readonly CauseId[] = [
  'off-centre', 'wild-strike', 'cold-strike', 'hot-strike', 'hard-strike', 'repeat-strike', 'missed-target', 'out-of-band', 'burning', 'quench-hot', 'quench-cold',
];

export interface Line { cause: CauseId; points: number }
/** A target as scoring sees it: `struck` means already hit in the current round, so closed until the next. */
export interface Target { x: number; y: number; struck: boolean }
export type StrikeKind = 'hit' | 'repeat' | 'wild' | 'light';
/** Where the metal was against the working band at the strike: below, in or above it. */
export type Heat = 'cold' | 'in' | 'hot';

export interface StrikeScore {
  /** Index of the target this strike counts for; null for a repeat or a wild strike. */
  target: number | null;
  kind: StrikeKind;
  /** A hit or repeat in the black band, or a hard one below the working band; the 3rd ends the craft (Ruin). */
  crack: boolean;
  /** The force the strike carried, 0–1: the ideal force when none was sent. */
  force: number;
  /** The temperature against the working band, for every strike. */
  heat: Heat;
  /** Distance from the strike to the target's centre, for hits; null otherwise. */
  offPx: number | null;
  /** A hit within `perfectPx` of the centre in the band. */
  perfect: boolean;
  /** Points lost, in fractions. */
  lines: Line[];
}

const R = grading.strike;
const F = grading.force;

/** The force a strike wants at this temperature: a straight line across the working band, clamped (J3). */
export function idealForce(tempC: number, band: { bandLowC: number; bandHighC: number }): number {
  const f = F.idealAtLow + (F.idealAtHigh - F.idealAtLow) * ((tempC - band.bandLowC) / (band.bandHighC - band.bandLowC));
  return Math.min(F.max, Math.max(F.min, f));
}

/** Force from engine steps a finger was held: full at `fullHoldS`. The screen only counts steps (GAME-02). */
export function forceFromHold(steps: number): number {
  return Math.min(1, (steps * STEP_MS) / (F.fullHoldS * 1000));
}

/**
 * Score one strike at close-view game px (x, y) and the metal's temperature at that step (forge spec, Data →
 * grading.json). Pure. The nearest target still open this round within the reach takes it, ties to the lower index;
 * with none, a closed target in reach makes it a repeat, otherwise it is wild and misses the metal.
 */
export function scoreStrike(targets: readonly Target[], x: number, y: number, tempC: number, band: { bandLowC: number; bandHighC: number }, force?: number): StrikeScore {
  let best = -1;
  let bestD = Infinity;
  let repeat = false;
  targets.forEach((t, i) => {
    const d = Math.hypot(x - t.x, y - t.y);
    if (d > R.reachPx) return;
    if (t.struck) repeat = true;
    else if (d < bestD) {
      best = i;
      bestD = d;
    }
  });
  const heat: Heat = tempC < band.bandLowC ? 'cold' : tempC > band.bandHighC ? 'hot' : 'in';
  const ideal = idealForce(tempC, band);
  const f = force ?? ideal;
  if (best < 0 && !repeat) return { target: null, kind: 'wild', crack: false, force: f, heat, offPx: null, perfect: false, lines: [{ cause: 'wild-strike', points: R.wild }] };
  if (f < ideal - F.window) return { target: null, kind: 'light', crack: false, force: f, heat, offPx: null, perfect: false, lines: [] };
  const hard = f > ideal + F.window;

  const lines: Line[] = [];
  if (best >= 0) {
    const off = Math.min(R.offCentreMax, Math.max(0, bestD - R.centrePx) * R.offCentrePerPx);
    if (off > 0) lines.push({ cause: 'off-centre', points: off });
  } else lines.push({ cause: 'repeat-strike', points: R.repeat });
  if (heat === 'cold') lines.push({ cause: 'cold-strike', points: R.cold });
  else if (heat === 'hot') lines.push({ cause: 'hot-strike', points: R.hot });
  if (hard) lines.push({ cause: 'hard-strike', points: F.hard });
  const offPx = best >= 0 ? bestD : null;
  const perfect = offPx !== null && offPx <= grading.perfectPx && heat === 'in' && !hard;
  const crack = bandAt(tempC) === 'black' || (hard && heat === 'cold');
  return { target: best >= 0 ? best : null, kind: best >= 0 ? 'hit' : 'repeat', crack, force: f, heat, offPx, perfect, lines };
}
