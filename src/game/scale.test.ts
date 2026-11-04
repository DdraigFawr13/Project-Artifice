import { describe, expect, it } from 'vitest';
import { computeScale } from './scale';

describe('computeScale', () => {
  it('gives ×4 and about 336 × 748 game px on the J1 Pixel size', () => {
    expect(computeScale(414, 921, 3.25)).toEqual({ scale: 4, visibleWidth: 336, visibleHeight: 748 });
  });

  it('keeps the 336 × 640 safe zone on screen', () => {
    for (const [w, h, dpr] of [[360, 640, 1], [390, 844, 3], [412, 914, 3.5], [1280, 720, 1], [1920, 1080, 2]] as const) {
      const r = computeScale(w, h, dpr);
      expect(r.visibleWidth).toBeGreaterThanOrEqual(Math.min(336, Math.floor(w * dpr)));
      expect(r.visibleHeight).toBeGreaterThanOrEqual(Math.min(640, Math.floor(h * dpr)));
      expect(Number.isInteger(r.scale)).toBe(true);
    }
  });

  it('never goes below ×1', () => {
    expect(computeScale(200, 300, 1).scale).toBe(1);
  });
});
