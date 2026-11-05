import { ores } from '../engine/alloy';
import type { AlloyMix } from './items';

export type Rgb = readonly [number, number, number];

const channels = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as unknown as Rgb;

/** A mix's colour: each channel the parts-weighted mean of its ores' sheens, rounded (forge spec S5). */
export function sheenOf(alloy: AlloyMix): Rgb {
  let total = 0;
  const sum = [0, 0, 0];
  for (const [id, parts] of Object.entries(alloy)) {
    const ore = ores.find((o) => o.id === id);
    if (!ore) throw new Error(`Unknown ore: ${id}`);
    total += parts;
    channels(ore.sheen).forEach((c, i) => (sum[i]! += c * parts));
  }
  if (total <= 0) throw new Error('An alloy needs at least one part');
  return sum.map((c) => Math.round(c / total)) as unknown as Rgb;
}

/** A colour at a raster's shading value: each channel rounded. */
export function shaded(rgb: Rgb, shade: number): Rgb {
  return rgb.map((c) => Math.round(c * shade)) as unknown as Rgb;
}
