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
export type MixCheck = { ok: true } | { ok: false; refusal: MixRefusal };

/** A mix starts a craft only with 2 or 3 known ores, each a whole number of parts of at least 1, adding up to the item's parts. */
export function checkMix(item: Item, mix: AlloyMix): MixCheck {
  const entries = Object.entries(mix);
  for (const [id, parts] of entries) {
    if (!ores.some((o) => o.id === id) || !Number.isInteger(parts) || parts < 1) return { ok: false, refusal: 'bad' };
  }
  const total = entries.reduce((n, [, parts]) => n + parts, 0);
  if (total === 0) return { ok: false, refusal: 'empty' };
  if (total < item.parts) return { ok: false, refusal: 'short' };
  if (total > item.parts) return { ok: false, refusal: 'over' };
  if (entries.length < 2) return { ok: false, refusal: 'one-ore' };
  return { ok: true };
}

/** The alloy's quality, rounded: shown on the alloy screen and beside the score, never in it (D-005). */
export function materialQuality(mix: AlloyMix): number {
  return Math.round(alloyProps(mix).quality);
}
