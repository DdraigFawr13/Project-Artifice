import data from './heat-bands.json';

/** Heat bands and how the metal looks at a temperature (forge spec, Data → heat-bands.json; D-003). */
export type BandId = 'black' | 'dull-red' | 'cherry' | 'orange' | 'yellow' | 'white';

export interface Band {
  id: BandId;
  /** Lowest °C of the band; null for the bottom band. */
  minC: number | null;
  anchorC: number;
  color: string;
  /** Glow radius in game px. */
  glow: number;
}

export interface Look {
  band: BandId;
  /** Interpolated colour, `#rrggbb`. */
  color: string;
  /** Relative luminance of `color`, 0–1. Light strength follows it. */
  luminance: number;
  /** Glow radius in game px. */
  glow: number;
  sparksPerSecond: number;
  /** Forge hum pitch, or null when the metal is too cool to hum. */
  humHz: number | null;
}

export const bands: readonly Band[] = data.bands as Band[];
export const heatRules = data.heat;

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const hex = (c: number[]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const channel = (v: number) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance. */
export function relativeLuminance(color: string): number {
  const [r, g, b] = rgb(color);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function bandAt(tempC: number): BandId {
  let id = bands[0]!.id;
  for (const b of bands) if (b.minC !== null && tempC >= b.minC) id = b.id;
  return id;
}

const ramp = (t: number, from: number, to: number) => Math.min(1, Math.max(0, (t - from) / (to - from)));

/** Colour, brightness and glow change continuously between band anchors and hold beyond the end anchors. */
export function look(tempC: number): Look {
  const first = bands[0]!;
  const last = bands[bands.length - 1]!;
  const t = Math.min(last.anchorC, Math.max(first.anchorC, tempC));
  let lo = first;
  let hi = first;
  for (let i = 0; i < bands.length - 1; i++) {
    if (t >= bands[i]!.anchorC && t <= bands[i + 1]!.anchorC) {
      lo = bands[i]!;
      hi = bands[i + 1]!;
      break;
    }
  }
  const f = hi === lo ? 0 : (t - lo.anchorC) / (hi.anchorC - lo.anchorC);
  const a = rgb(lo.color);
  const b = rgb(hi.color);
  const color = f === 0 ? lo.color : f === 1 ? hi.color : hex(a.map((v, i) => v + (b[i]! - v) * f));
  const { sparks, hum } = data;
  return {
    band: bandAt(tempC),
    color,
    luminance: relativeLuminance(color),
    glow: lo.glow + (hi.glow - lo.glow) * f,
    sparksPerSecond: tempC < sparks.fromC ? 0 : ramp(tempC, sparks.fromC, sparks.toC) * sparks.maxPerSecond,
    humHz: tempC < hum.fromC ? null : hum.fromHz + ramp(tempC, hum.fromC, hum.toC) * (hum.toHz - hum.fromHz),
  };
}
