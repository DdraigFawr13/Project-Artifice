import grading from '../data/grading.json';
import { bandAt } from '../data/heatBands';

/** Why points were lost (forge spec, Engine). */
export type CauseId =
  | 'off-centre' | 'wild-strike' | 'cold-strike' | 'hot-strike' | 'repeat-strike'
  | 'missed-target' | 'out-of-band' | 'burning' | 'quench-hot' | 'quench-cold';

/** Every cause in display order. */
export const CAUSES: readonly CauseId[] = [
  'off-centre', 'wild-strike', 'cold-strike', 'hot-strike', 'repeat-strike', 'missed-target', 'out-of-band', 'burning', 'quench-hot', 'quench-cold',
];

export interface Line { cause: CauseId; points: number }
/** A target as scoring sees it: `struck` means already hit in the current round, so closed until the next. */
export interface Target { x: number; y: number; struck: boolean }
export type StrikeKind = 'hit' | 'repeat' | 'wild';

export interface StrikeScore {
  /** Index of the target this strike counts for; null for a repeat or a wild strike. */
  target: number | null;
  kind: StrikeKind;
  /** A hit or repeat in the black band; the 3rd ends the craft (Data → grading.json, Ruin). */
  black: boolean;
  /** Points lost, in fractions. */
  lines: Line[];
}

const R = grading.strike;

/**
 * Score one strike at close-view game px (x, y) and the metal's temperature at that step (forge spec, Data →
 * grading.json). Pure. The nearest target still open this round within the reach takes it, ties to the lower index;
 * with none, a closed target in reach makes it a repeat, otherwise it is wild and misses the metal.
 */
export function scoreStrike(targets: readonly Target[], x: number, y: number, tempC: number, band: { bandLowC: number; bandHighC: number }): StrikeScore {
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
  if (best < 0 && !repeat) return { target: null, kind: 'wild', black: false, lines: [{ cause: 'wild-strike', points: R.wild }] };

  const lines: Line[] = [];
  if (best >= 0) {
    const off = Math.min(R.offCentreMax, Math.max(0, bestD - R.centrePx) * R.offCentrePerPx);
    if (off > 0) lines.push({ cause: 'off-centre', points: off });
  } else lines.push({ cause: 'repeat-strike', points: R.repeat });
  if (tempC < band.bandLowC) lines.push({ cause: 'cold-strike', points: R.cold });
  else if (tempC > band.bandHighC) lines.push({ cause: 'hot-strike', points: R.hot });
  return { target: best >= 0 ? best : null, kind: best >= 0 ? 'hit' : 'repeat', black: bandAt(tempC) === 'black', lines };
}
