import { describe, expect, it } from 'vitest';
import { itemById } from '../data/items';
import { alloyProps, checkMix, materialQuality, ores } from './alloy';
import { createCraft, step, STEP_MS } from './craft';

const knife = itemById('knife');

describe('alloy means (forge spec, Data → ores.json)', () => {
  it('a 2-ore mix takes the parts-weighted means of its ores', () => {
    // ore2 ×4 + ore1 ×1: quality (240 + 40) / 5, band (3400 + 800) / 5 to (4400 + 1150) / 5, cool (240 + 45) / 5.
    expect(alloyProps({ ore2: 4, ore1: 1 })).toEqual({ quality: 56, bandLowC: 840, bandHighC: 1110, cool: 57 });
  });

  it('a 3-ore mix takes the parts-weighted means of its ores', () => {
    // ore1 ×1 + ore2 ×2 + ore3 ×2: quality (40 + 120 + 170) / 5, band (800 + 1700 + 1800) / 5 to (1150 + 2200 + 2100) / 5.
    expect(alloyProps({ ore1: 1, ore2: 2, ore3: 2 })).toEqual({ quality: 66, bandLowC: 860, bandHighC: 1090, cool: 65 });
  });

  it('material quality is the alloy quality rounded, not floored', () => {
    // ore3 ×2 + ore2 ×1 (horseshoe): (170 + 60) / 3 = 76.67 → 77.
    expect(materialQuality({ ore3: 2, ore2: 1 })).toBe(77);
  });
});

describe('checkMix (S5 "Settled at S5 start")', () => {
  it('accepts 2- and 3-ore mixes that add up to the item', () => {
    expect(checkMix(knife, { ore2: 4, ore1: 1 })).toMatchObject({ ok: true });
    expect(checkMix(knife, { ore1: 1, ore2: 2, ore3: 2 })).toMatchObject({ ok: true });
  });

  it('refuses a 1-ore mix, even at the right total', () => {
    expect(checkMix(knife, { ore2: 5 })).toMatchObject({ ok: false, refusal: 'one-ore' });
  });

  it('refuses an empty mix', () => {
    expect(checkMix(knife, {})).toMatchObject({ ok: false, refusal: 'empty' });
  });

  it('refuses a mix under or over the item total', () => {
    expect(checkMix(knife, { ore1: 1, ore2: 3 })).toMatchObject({ ok: false, refusal: 'short' });
    expect(checkMix(knife, { ore1: 1 })).toMatchObject({ ok: false, refusal: 'short' });
    expect(checkMix(knife, { ore1: 3, ore2: 3 })).toMatchObject({ ok: false, refusal: 'over' });
  });

  it('refuses unknown ores and parts that are not a whole number of at least 1', () => {
    expect(checkMix(knife, { ore1: 1, mithril: 4 })).toMatchObject({ ok: false, refusal: 'bad' });
    expect(checkMix(knife, { ore1: 0, ore2: 5 })).toMatchObject({ ok: false, refusal: 'bad' });
    expect(checkMix(knife, { ore1: 1.5, ore2: 3.5 })).toMatchObject({ ok: false, refusal: 'bad' });
  });

  it('gives the parts still to add, negative when over', () => {
    expect(checkMix(knife, {}).room).toBe(5);
    expect(checkMix(knife, { ore1: 1, ore2: 2 }).room).toBe(2);
    expect(checkMix(knife, { ore1: 3, ore2: 3 }).room).toBe(-1);
    expect(checkMix(knife, { ore1: 1, ore2: 4 }).room).toBe(0);
  });

  it('createCraft refuses a mix checkMix refuses', () => {
    expect(() => createCraft(1, 'knife', { ore2: 5 })).toThrow();
    expect(() => createCraft(1, 'knife', { ore1: 1, ore2: 2, ore3: 2 })).not.toThrow();
  });
});

describe('the mix changes the craft', () => {
  it('the same heat on the anvil is in band for an Ore 1-heavy mix and out of band for an Ore 3-heavy one', () => {
    // Ore 1 ×4 + Ore 2 ×1: band 810–1140. Ore 3 ×4 + Ore 2 ×1: band 890–1060. Hold 870 °C on the anvil for 1 s.
    const onAnvil = (alloy: Record<string, number>) => {
      let s = { ...createCraft(1, 'knife', alloy), temp: 870 };
      s = step(s, { grab: true });
      s = step({ ...s, temp: 870 }, { drop: 'anvil' });
      for (let i = 0; i < 1000 / STEP_MS; i++) s = step({ ...s, temp: 870 }, { none: true });
      return s.lost['out-of-band'] ?? 0;
    };
    expect(onAnvil({ ore1: 4, ore2: 1 })).toBe(0);
    expect(onAnvil({ ore3: 4, ore2: 1 })).toBeGreaterThan(1.5);
  });
});

describe('ore notes describe the data', () => {
  it('better ore is harder to work: by rising quality, the band narrows and the cool rate rises', () => {
    const byQuality = [...ores].sort((a, b) => a.quality - b.quality);
    for (let i = 1; i < byQuality.length; i++) {
      const lo = byQuality[i - 1]!;
      const hi = byQuality[i]!;
      expect(hi.bandHighC - hi.bandLowC).toBeLessThan(lo.bandHighC - lo.bandLowC);
      expect(hi.cool).toBeGreaterThan(lo.cool);
    }
    for (const o of ores) expect(o.note.length).toBeGreaterThan(0);
  });
});
