import { describe, expect, it } from 'vitest';
import { computeScale } from './scale';

describe('computeScale', () => {
  it('gives ×4 and about 336 × 748 game px on the J1 Pixel size', () => {
    expect(computeScale(414, 921, 3.25)).toEqual({ scale: 4, visibleWidth: 336, visibleHeight: 748 });
  });

  it.each([
    [360, 640, 1, 1],
    [390, 844, 3, 3],
    [412, 914, 3.5, 4],
    [1280, 720, 1, 1],
    [1920, 1080, 2, 3],
  ])('picks the largest whole scale that keeps the 336 × 640 safe zone: %i × %i at %f → ×%i', (w, h, dpr, scale) => {
    const r = computeScale(w, h, dpr);
    expect(r.scale).toBe(scale);
    expect(r.visibleWidth).toBeGreaterThanOrEqual(336);
    expect(r.visibleHeight).toBeGreaterThanOrEqual(640);
  });

  it('never goes below ×1', () => {
    expect(computeScale(200, 300, 1).scale).toBe(1);
  });
});
