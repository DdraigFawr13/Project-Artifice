import oresJson from '../data/ores.json';
import type { AlloyMix, Item } from '../data/items';

export interface Ore {
  id: string;
  name: string;
  quality: number;
  bandLowC: number;
  bandHighC: number;
  /** °C lost per second out of the fire. */
  cool: number;
  /** Slag spots per part of this ore in a mix (S3). */
  slagPerPart: number;
  /** How the ore works, in words for the alloy screen; never a temperature (S5). */
  note: string;
}

/** What an alloy brings to a craft: parts-weighted means of its ores, not rounded (forge spec, Data → ores.json). */
export interface AlloyProps {
  quality: number;
  bandLowC: number;
  bandHighC: number;
  cool: number;
}

export const ores: readonly Ore[] = oresJson;

/** The item's starting mix on the alloy screen (S5). */
export function defaultAlloy(item: Item): AlloyMix {
  return { ...item.defaultAlloy };
}

export function alloyProps(mix: AlloyMix): AlloyProps {
  let total = 0;
  const sum = { quality: 0, bandLowC: 0, bandHighC: 0, cool: 0 };
  for (const [id, parts] of Object.entries(mix)) {
    const ore = ores.find((o) => o.id === id);
    if (!ore) throw new Error(`Unknown ore: ${id}`);
    total += parts;
    sum.quality += ore.quality * parts;
    sum.bandLowC += ore.bandLowC * parts;
    sum.bandHighC += ore.bandHighC * parts;
    sum.cool += ore.cool * parts;
  }
  if (total <= 0) throw new Error('An alloy needs at least one part');
  return { quality: sum.quality / total, bandLowC: sum.bandLowC / total, bandHighC: sum.bandHighC / total, cool: sum.cool / total };
}

/** Why a mix can't start a craft (S5 "Settled at S5 start"). */
export type MixRefusal = 'empty' | 'short' | 'over' | 'one-ore' | 'bad';
/** `room` is the parts still to add: the item's parts minus the mix's (negative when over). */
export type MixCheck = { ok: true; room: number } | { ok: false; refusal: MixRefusal; room: number };

/** Most ores in one alloy (D-005: 2 or 3). */
export const MAX_ORES = 3;

/**
 * A mix starts a craft only with 2 or 3 known ores, each a whole number of parts of at least 1, adding up to the
 * item's parts. The screen takes `room` from here for its + buttons and its wording, so the rule has one home.
 */
export function checkMix(item: Item, mix: AlloyMix): MixCheck {
  const entries = Object.entries(mix);
  const total = entries.reduce((n, [, parts]) => n + parts, 0);
  const room = item.parts - total;
  const known = entries.every(([id, parts]) => ores.some((o) => o.id === id) && Number.isInteger(parts) && parts >= 1);
  if (!known || entries.length > MAX_ORES) return { ok: false, refusal: 'bad', room };
  if (total === 0) return { ok: false, refusal: 'empty', room };
  if (room > 0) return { ok: false, refusal: 'short', room };
  if (room < 0) return { ok: false, refusal: 'over', room };
  if (entries.length < 2) return { ok: false, refusal: 'one-ore', room };
  return { ok: true, room };
}

/** The alloy's quality, rounded: shown on the alloy screen and beside the score, never in it (D-005). */
export function materialQuality(mix: AlloyMix): number {
  return Math.round(alloyProps(mix).quality);
}
