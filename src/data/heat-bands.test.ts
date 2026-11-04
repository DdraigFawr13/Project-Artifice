import { describe, expect, it } from 'vitest';
import { bands, look, relativeLuminance } from './heatBands';

// J2 Heat: readable without colour (D-003). Each anchor is brighter, by at least 0.04, with a bigger glow.
describe('heat bands', () => {
  it('has the 6 named bands in order', () => {
    expect(bands.map((b) => b.id)).toEqual(['black', 'dull-red', 'cherry', 'orange', 'yellow', 'white']);
  });

  it('rises in luminance (by 0.04 or more) and glow radius at every anchor', () => {
    const at = bands.map((b) => look(b.anchorC));
    for (let i = 1; i < at.length; i++) {
      expect(at[i]!.luminance - at[i - 1]!.luminance).toBeGreaterThanOrEqual(0.04);
      expect(at[i]!.glow).toBeGreaterThan(at[i - 1]!.glow);
    }
  });

  it('uses the listed colour at each anchor', () => {
    for (const b of bands) expect(look(b.anchorC).color).toBe(b.color);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 6);
  });

  it('changes continuously between anchors and holds beyond the ends', () => {
    const mid = look((825 + 975) / 2);
    expect(mid.luminance).toBeGreaterThan(look(825).luminance);
    expect(mid.luminance).toBeLessThan(look(975).luminance);
    expect(mid.glow).toBeCloseTo(10, 6);
    const shown = (c: number) => { const l = look(c); return [l.color, l.luminance, l.glow]; };
    expect(shown(20)).toEqual(shown(285));
    expect(shown(1350)).toEqual(shown(1275));
  });

  it('names the band by its °C range', () => {
    expect(look(549).band).toBe('black');
    expect(look(550).band).toBe('dull-red');
    expect(look(1199).band).toBe('yellow');
    expect(look(1200).band).toBe('white');
  });

  it('sparks from 900 °C up to 30 a second at 1350, and hums from 550 °C (80 to 220 Hz)', () => {
    expect(look(899).sparksPerSecond).toBe(0);
    expect(look(1350).sparksPerSecond).toBe(30);
    expect(look(1125).sparksPerSecond).toBeCloseTo(15, 6);
    expect(look(549).humHz).toBeNull();
    expect(look(550).humHz).toBe(80);
    expect(look(1350).humHz).toBe(220);
  });
});
