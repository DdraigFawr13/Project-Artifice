import grading from '../data/grading.json';
import { bandAt, heatRules } from '../data/heatBands';
import { itemById, type AlloyMix } from '../data/items';
import { alloyProps, type AlloyProps } from './alloy';
import { heatStep, type Place } from './heat';
import { isWhiteQuench } from './quench';
import { mulberry32 } from './rng';
import { scoreStrike, type CauseId, type Line, type StrikeKind, type Target } from './strike';

/** One fixed step, in ms (forge spec, Engine). */
export const STEP_MS = 16;

export type DropTarget = 'fire' | 'anvil' | 'tub';
export type Input =
  | { bellows: boolean }
  | { grab: true }
  | { drop: DropTarget }
  | { strike: { x: number; y: number } }
  | { none: true };

export interface CraftState {
  seed: number;
  itemId: string;
  alloy: AlloyMix;
  props: AlloyProps;
  /** Steps taken so far. */
  step: number;
  /** True temperature, °C. Never shown as a number to the player. */
  temp: number;
  location: Place;
  /** Where the bar was picked up from, so a drop elsewhere can return it. */
  heldFrom: 'fire' | 'anvil';
  /** Sticky: set by `{bellows}` until the next `{bellows}` input. Works only in the fire. */
  bellows: boolean;
  /** Strike targets in close-view game px, moved by the seed, with how many times each has been hit (0 to `passes`). */
  targets: CraftTarget[];
  /** Every strike made on the anvil, in order, with its points lost. */
  strikes: Strike[];
  /** Per-second causes so far (out of band on the anvil, burning), in fractions. */
  lost: Partial<Record<CauseId, number>>;
  /** True while the metal is in the `white` band: it is being damaged. The screen shows "Burning!" from this. */
  burning: boolean;
  /** The metal's temperature when it went into the tub, or null before the quench. */
  quenchC: number | null;
  /** Set when the craft ends in ruin; `location` is then `done`. */
  ruin: Ruin | null;
  /** Every input except `{none}`, with the step it arrived on, so a craft replays from seed plus log (GAME-01). */
  log: { step: number; input: Input }[];
}

export type Ruin = 'black-strikes' | 'white-quench';

export interface CraftTarget {
  x: number;
  y: number;
  hits: number;
}

/** Each target takes this many hits, in rounds: round 2 opens once every target has its first hit (Morgan, S3). */
export const PASSES = grading.passes;

/** The round in progress: 1 + the fewest hits on any target, at most PASSES. */
export function currentRound(s: Pick<CraftState, 'targets'>): number {
  return Math.min(PASSES, 1 + Math.min(...s.targets.map((t) => t.hits)));
}

/** True once every target has all its hits. */
export function allWorked(s: Pick<CraftState, 'targets'>): boolean {
  return s.targets.every((t) => t.hits >= PASSES);
}

export interface Strike {
  step: number;
  x: number;
  y: number;
  target: number | null;
  kind: StrikeKind;
  black: boolean;
  lines: Line[];
}

/** The seed moves each target by whole px, up to ±3 in x and y: floor(next() × 7) − 3, x then y (forge spec S3). */
function placeTargets(seed: number, itemId: string): CraftTarget[] {
  const rng = mulberry32(seed);
  const shift = () => Math.floor(rng.next() * 7) - 3;
  return itemById(itemId).targets.map((t) => {
    const x = t.x + shift();
    const y = t.y + shift();
    return { x, y, hits: 0 };
  });
}

export function createCraft(seed: number, itemId: string, alloy: AlloyMix): CraftState {
  return {
    seed: seed >>> 0,
    itemId,
    alloy: { ...alloy },
    props: alloyProps(alloy),
    step: 0,
    temp: heatRules.startC,
    location: 'fire',
    heldFrom: 'fire',
    bellows: false,
    targets: placeTargets(seed >>> 0, itemId),
    strikes: [],
    lost: {},
    burning: false,
    quenchC: null,
    ruin: null,
    log: [],
  };
}

function applyInput(s: CraftState, input: Input): CraftState {
  if ('bellows' in input) return { ...s, bellows: input.bellows };
  if ('grab' in input) {
    if (s.location !== 'fire' && s.location !== 'anvil') return s;
    return { ...s, location: 'held', heldFrom: s.location };
  }
  if ('drop' in input) {
    if (s.location !== 'held') return s;
    // The quench ends the craft at this step's temperature, before any heat change (S4); white heat cracks it.
    if (input.drop === 'tub') return { ...s, location: 'done', bellows: false, quenchC: s.temp, ruin: isWhiteQuench(s.temp) ? 'white-quench' : null };
    return { ...s, location: input.drop };
  }
  if ('strike' in input) {
    // Strikes count only on the anvil; elsewhere they are logged and ignored.
    if (s.location !== 'anvil') return s;
    const { x, y } = input.strike;
    // A target is open while it has fewer hits than the round in progress; once all are worked, none is open.
    const round = currentRound(s);
    const view: Target[] = s.targets.map((t) => ({ x: t.x, y: t.y, struck: t.hits >= round }));
    const sc = scoreStrike(view, x, y, s.temp, s.props);
    const targets = sc.target === null ? s.targets : s.targets.map((t, i) => (i === sc.target ? { ...t, hits: t.hits + 1 } : t));
    const strikes = [...s.strikes, { step: s.step, x, y, ...sc }];
    const blacks = strikes.filter((k) => k.black).length;
    // The 3rd black-band strike is scored, then ends the craft at once.
    if (blacks >= grading.ruin.blackStrikes) return { ...s, targets, strikes, location: 'done', bellows: false, ruin: 'black-strikes' };
    return { ...s, targets, strikes };
  }
  return s;
}

/** Per-second causes for one step at the step's new temperature (forge spec, Data → grading.json). */
function accrue(s: CraftState, dtS: number): CraftState {
  const burning = bandAt(s.temp) === 'white';
  const outOfBand = s.location === 'anvil' && (s.temp < s.props.bandLowC || s.temp > s.props.bandHighC);
  if (!burning && !outOfBand) return s.burning ? { ...s, burning } : s;
  const lost = { ...s.lost };
  const P = grading.perSecond;
  if (outOfBand) lost['out-of-band'] = (lost['out-of-band'] ?? 0) + P.outOfBand * dtS;
  if (burning) lost.burning = (lost.burning ?? 0) + P.burning * dtS;
  return { ...s, lost, burning };
}

/** Advance one fixed step of STEP_MS with one input. Pure. */
export function step(state: CraftState, input: Input): CraftState {
  if (state.location === 'done') return state;
  // A copy, so the replay log can't change after the fact.
  const logged = 'none' in input ? state.log : [...state.log, { step: state.step, input: structuredClone(input) }];
  const s = applyInput({ ...state, log: logged }, input);
  if (s.location === 'done') return { ...s, step: s.step + 1 };
  const temp = heatStep(s.temp, s.location, s.bellows, s.props.cool, STEP_MS / 1000);
  return accrue({ ...s, temp, step: s.step + 1 }, STEP_MS / 1000);
}
