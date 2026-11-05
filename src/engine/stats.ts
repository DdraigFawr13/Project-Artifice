import grading from '../data/grading.json';
import { itemById } from '../data/items';
import statsJson from '../data/stats.json';
import { ores } from './alloy';
import { PASSES, type CraftState } from './craft';

export type StatId = 'edge' | 'toughness' | 'balance';
/** Every stat, in display order. */
export const STAT_IDS: readonly StatId[] = ['edge', 'toughness', 'balance'];

export interface StatResult {
  /** Whole number, 0–100. */
  value: number;
  word: string;
  /** Why it is not higher, or what helped it, in words. */
  why: string;
}
/** The stats the item uses, by id. */
export type Stats = Partial<Record<StatId, StatResult>>;

const S = statsJson;
const R = grading.strike;

/** The band's word for a value: the highest band whose minimum it reaches (forge spec S4, Data → stats.json). */
export function statWord(stat: StatId, value: number): string {
  let word = S.words[stat][0]!.word;
  for (const b of S.words[stat]) if (value >= b.min) word = b.word;
  return word;
}

/** A deduction in points with the `why` it would give; the largest wins, ties to the first listed. */
interface Deduction {
  points: number;
  why: string;
}

/** Puts the count in a `why` template: `{n}` rounded and at least 1, `{s}` an "s" unless the count is 1. */
const fill = (template: string, n: number) => {
  const count = Math.max(1, Math.round(n));
  return template.replace('{n}', String(count)).replace('{s}', count === 1 ? '' : 's');
};

/** The mix's parts-weighted mean multiplier for a stat, unrounded (forge spec S4). */
function multiplier(state: CraftState, stat: StatId): number {
  let total = 0;
  let sum = 0;
  for (const [id, parts] of Object.entries(state.alloy)) {
    total += parts;
    sum += ores.find((o) => o.id === id)!.stats[stat] * parts;
  }
  return sum / total;
}

/** The ore in the mix with the highest multiplier for the stat (ties: first in `ores.json`). */
function bestOre(state: CraftState, stat: StatId): string {
  let best: { name: string; m: number } | null = null;
  for (const o of ores) if (o.id in state.alloy && (best === null || o.stats[stat] > best.m)) best = { name: o.name, m: o.stats[stat] };
  return best!.name;
}

/** Hits' distance past the centre, per target, in the order of the targets: [] for a target with no hits. */
function overByTarget(state: CraftState): number[][] {
  const over: number[][] = state.targets.map(() => []);
  for (const k of state.strikes) if (k.kind === 'hit' && k.target !== null && k.offPx !== null) over[k.target]!.push(Math.max(0, k.offPx - R.centrePx));
  return over;
}

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function deductions(state: CraftState, stat: StatId): Deduction[] {
  if (stat === 'edge') {
    const over = overByTarget(state).flat();
    // No hits is the worst Edge: the whole 100 is lost.
    if (over.length === 0) return [{ points: 100, why: S.why.noHits }];
    const offCentre = state.strikes.filter((k) => k.kind === 'hit' && k.offPx !== null && k.offPx > R.centrePx).length;
    return [{ points: S.edge.perPx * mean(over), why: fill(S.why.offCentre, offCentre) }];
  }
  if (stat === 'toughness') {
    const T = S.toughness;
    const seconds = (state.lost['out-of-band'] ?? 0) / grading.perSecond.outOfBand;
    const cracks = state.strikes.filter((k) => k.crack).length;
    return [
      { points: T.perOutSecond * seconds, why: fill(S.why.outOfBand, seconds) },
      { points: Math.abs((state.quenchC ?? T.quenchC) - T.quenchC) / T.degreesPerPoint, why: S.why.quench },
      { points: T.perCrack * cracks, why: fill(S.why.crack, cracks) },
    ];
  }
  const B = S.balance;
  const missing = state.targets.reduce((n, t) => n + Math.max(0, PASSES - t.hits), 0);
  const slagLeft = state.slag.filter((p) => !p.cleared).length;
  const means = overByTarget(state).filter((o) => o.length > 0).map(mean);
  const spread = means.length < 2 ? 0 : Math.max(...means) - Math.min(...means);
  return [
    { points: B.perMissing * missing, why: fill(S.why.missing, missing) },
    { points: B.perSlag * slagLeft, why: fill(S.why.slag, slagLeft) },
    { points: B.perSpreadPx * spread, why: S.why.spread },
  ];
}

/**
 * The stats of a finished craft (forge spec S4): for each stat the item uses, the work done (100 less its
 * deductions) times the mix's multiplier, rounded and clamped to 0–100, with its word and the reason. It reads the
 * state only (no `checkMix`), so tests can build states by hand.
 */
export function statsFor(state: CraftState): Stats {
  const out: Stats = {};
  for (const stat of itemById(state.itemId).stats) {
    const ds = deductions(state, stat);
    const work = 100 - ds.reduce((a, d) => a + d.points, 0);
    const value = Math.min(100, Math.max(0, Math.round(work * multiplier(state, stat))));
    let top: Deduction | null = null;
    for (const d of ds) if (d.points > 0 && (top === null || d.points > top.points)) top = d;
    out[stat] = { value, word: statWord(stat, value), why: top ? top.why : S.helped.replace('{ore}', bestOre(state, stat)) };
  }
  return out;
}
