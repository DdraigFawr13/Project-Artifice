import { heatRules } from '../data/heatBands';
import type { AlloyMix } from '../data/items';
import { alloyProps, type AlloyProps } from './alloy';
import { heatStep, type Place } from './heat';

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
  /** Every input except `{none}`, with the step it arrived on, so a craft replays from seed plus log (GAME-01). */
  log: { step: number; input: Input }[];
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
    // The tub (quench) arrives in S4; until then a tub drop returns the bar to where it was.
    return { ...s, location: input.drop === 'tub' ? s.heldFrom : input.drop };
  }
  // Strikes arrive in S3.
  return s;
}

/** Advance one fixed step of STEP_MS with one input. Pure. */
export function step(state: CraftState, input: Input): CraftState {
  if (state.location === 'done') return state;
  // A copy, so the replay log can't change after the fact.
  const logged = 'none' in input ? state.log : [...state.log, { step: state.step, input: structuredClone(input) }];
  const s = applyInput({ ...state, log: logged }, input);
  const temp = heatStep(s.temp, s.location, s.bellows, s.props.cool, STEP_MS / 1000);
  return { ...s, temp, step: s.step + 1 };
}
