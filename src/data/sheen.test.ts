import { describe, expect, it } from 'vitest';
import { itemById } from './items';
import { shapesFor, worked } from '../game/shapes';
import { sheenOf, shaded } from './sheen';

describe('sheenOf', () => {
  it('blends the default knife mix by parts', () => {
    // (4 × #c8c2b4 + 1 × #8a6248) ÷ 5 per channel.
    expect(sheenOf({ ore2: 4, ore1: 1 })).toEqual([188, 175, 158]);
  });

  it('blends a 3-ore mix', () => {
    expect(sheenOf({ ore1: 1, ore2: 2, ore3: 2 })).toEqual([137, 146, 176]);
  });

  it('rounds each channel to the nearest whole number', () => {
    // Red: (138 + 200 × 2) ÷ 3 = 179.33 → 179; green: (98 + 194 × 2) ÷ 3 = 162; blue: (72 + 180 × 2) ÷ 3 = 144.
    expect(sheenOf({ ore1: 1, ore2: 2 })).toEqual([179, 162, 144]);
    // Red: (138 + 200) ÷ 2 = 169 exactly; green: (98 + 194) ÷ 2 = 146; blue: (72 + 180) ÷ 2 = 126.
    expect(sheenOf({ ore1: 1, ore2: 1 })).toEqual([169, 146, 126]);
    // Ore 1 + Ore 3: red (138 + 74) ÷ 2 = 106, green (98 + 122) ÷ 2 = 110, blue (72 + 224) ÷ 2 = 148.
    expect(sheenOf({ ore1: 1, ore3: 1 })).toEqual([106, 110, 148]);
    // A half rounds up: red (138 + 200 + 74 × 2) ÷ 4 = 121.5 → 122.
    expect(sheenOf({ ore1: 1, ore2: 1, ore3: 2 })).toEqual([122, 134, 175]);
  });

  it('throws on an unknown ore', () => {
    expect(() => sheenOf({ ore1: 1, ore9: 1 })).toThrow('Unknown ore: ore9');
  });
});

describe('shaded', () => {
  it('rounds each channel of colour × shade', () => {
    expect(shaded([188, 175, 158], 0.88)).toEqual([165, 154, 139]);
    expect(shaded([137, 146, 176], 0.88)).toEqual([121, 128, 155]);
    expect(shaded([100, 101, 102], 0.5)).toEqual([50, 51, 51]);
    expect(shaded([10, 20, 30], 1)).toEqual([10, 20, 30]);
  });
});

describe('the finished knife', () => {
  it("has 0.88 as its raster's most common shade", () => {
    // Measured by counting the shade of every piece pixel of worked(shapesFor('knife'), all targets hit twice), outline
    // excluded: 0.4 × 376, 0.62 × 690, 0.76 × 1298, 0.88 × 1344, 1 × 1060. e2e/depth.spec.ts (J6) uses the numbers below.
    const counts = new Map<number, number>();
    for (const v of worked(shapesFor('knife'), itemById('knife').targets.map(() => 2)).shade) if (v > 0) counts.set(Math.fround(v), (counts.get(Math.fround(v)) ?? 0) + 1);
    const [modal, n] = [...counts].sort((a, b) => b[1] - a[1])[0]!;
    expect(modal).toBe(Math.fround(0.88));
    expect(n).toBe(1344);
  });

  it('is drawn in (165,154,139) for the default mix and (121,128,155) for the 3-ore mix', () => {
    expect(shaded(sheenOf({ ore2: 4, ore1: 1 }), 0.88)).toEqual([165, 154, 139]);
    expect(shaded(sheenOf({ ore1: 1, ore2: 2, ore3: 2 }), 0.88)).toEqual([121, 128, 155]);
  });
});
