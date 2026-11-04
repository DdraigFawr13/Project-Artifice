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
}

/** What an alloy brings to a craft: parts-weighted means of its ores, not rounded (forge spec, Data → ores.json). */
export interface AlloyProps {
  quality: number;
  bandLowC: number;
  bandHighC: number;
  cool: number;
}

export const ores: readonly Ore[] = oresJson;

/** The fixed alloy for S2–S4, until the alloy screen (S5). */
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
