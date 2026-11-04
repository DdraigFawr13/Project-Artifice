import { describe, expect, it } from 'vitest';
import { itemById } from '../data/items';
import { alloyProps, checkMix, materialQuality, ores } from './alloy';
import { createCraft } from './craft';

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
    expect(checkMix(knife, { ore2: 4, ore1: 1 })).toEqual({ ok: true });
    expect(checkMix(knife, { ore1: 1, ore2: 2, ore3: 2 })).toEqual({ ok: true });
  });

  it('refuses a 1-ore mix, even at the right total', () => {
    expect(checkMix(knife, { ore2: 5 })).toEqual({ ok: false, refusal: 'one-ore' });
  });

  it('refuses an empty mix', () => {
    expect(checkMix(knife, {})).toEqual({ ok: false, refusal: 'empty' });
  });

  it('refuses a mix under or over the item total', () => {
    expect(checkMix(knife, { ore1: 1, ore2: 3 })).toEqual({ ok: false, refusal: 'short' });
    expect(checkMix(knife, { ore1: 1 })).toEqual({ ok: false, refusal: 'short' });
    expect(checkMix(knife, { ore1: 3, ore2: 3 })).toEqual({ ok: false, refusal: 'over' });
  });

  it('refuses unknown ores and parts that are not a whole number of at least 1', () => {
    expect(checkMix(knife, { ore1: 1, mithril: 4 })).toEqual({ ok: false, refusal: 'bad' });
    expect(checkMix(knife, { ore1: 0, ore2: 5 })).toEqual({ ok: false, refusal: 'bad' });
    expect(checkMix(knife, { ore1: 1.5, ore2: 3.5 })).toEqual({ ok: false, refusal: 'bad' });
  });

  it('createCraft refuses a mix checkMix refuses', () => {
    expect(() => createCraft(1, 'knife', { ore2: 5 })).toThrow();
    expect(() => createCraft(1, 'knife', { ore1: 1, ore2: 2, ore3: 2 })).not.toThrow();
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
