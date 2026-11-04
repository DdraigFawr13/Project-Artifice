import { describe, expect, it } from 'vitest';
import grading from '../data/grading.json';
import { items } from '../data/items';
import { CLOSE_LINE_Y } from './closeLayout';
import { onRaster, outline, scaled, shapesFor, worked } from './shapes';

// The piece starts as bar stock and each strike shapes its own target's stretch (forge spec S3; Morgan 2026-11-04).
describe('piece shapes', () => {
  for (const item of items) {
    const s = shapesFor(item.id);
    const n = item.targets.length;
    const none = Array<boolean>(n).fill(false);

    it(`${item.id}: every target is on both the bar and the finished piece, even after the seed moves it 3 px`, () => {
      expect(n).toBe({ horseshoe: 5, knife: 9, sword: 15 }[item.id]);
      for (const t of item.targets) {
        for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) {
          expect(onRaster(s.bar, t.x + dx, t.y + dy), `${item.id} bar at ${t.x + dx},${t.y + dy}`).toBe(true);
          expect(onRaster(s.final, t.x + dx, t.y + dy), `${item.id} finished at ${t.x + dx},${t.y + dy}`).toBe(true);
        }
      }
    });

    it(`${item.id}: unworked it is the bar, fully worked it is the finished shape`, () => {
      expect(worked(s, none).shade).toEqual(s.bar.shade);
      expect(worked(s, Array<boolean>(n).fill(true)).shade).toEqual(s.final.shade);
    });

    it(`${item.id}: a strike changes only its own target's stretch, and does change it`, () => {
      for (let k = 0; k < n; k++) {
        const one = none.map((_, i) => i === k);
        const a = worked(s, none).shade;
        const b = worked(s, one).shade;
        let changed = 0;
        for (let i = 0; i < a.length; i++) {
          if (a[i] !== b[i]) {
            changed++;
            expect(s.region[i]).toBe(k);
          }
        }
        expect(changed, `${item.id} target ${k}`).toBeGreaterThan(0);
      }
    });

    it(`${item.id}: each pixel's stretch belongs to its nearest target`, () => {
      const { x, y, w } = s.final;
      for (let i = 0; i < s.region.length; i++) {
        const px = x + (i % w);
        const py = y + Math.floor(i / w);
        const d = (k: number) => Math.hypot(px - item.targets[k]!.x, py - item.targets[k]!.y);
        const own = d(s.region[i]!);
        for (let k = 0; k < n; k++) expect(own).toBeLessThanOrEqual(d(k));
      }
    });

        it(`${item.id}: the hammer spreads the metal, so the finished piece covers more than the bar`, () => {
      const count = (r: Float32Array) => r.reduce((a, v) => a + (v > 0 ? 1 : 0), 0);
      expect(count(s.final.shade)).toBeGreaterThan(count(s.bar.shade));
    });

    it(`${item.id}: neighbouring targets stay out of reach of each other after the seed moves them`, () => {
      for (let i = 1; i < n; i++) {
        const a = item.targets[i - 1]!;
        const b = item.targets[i]!;
        // Each target can move 3 px in x and y, so two neighbours can close by up to 2 × 3√2 px.
        expect(Math.hypot(a.x - b.x, a.y - b.y) - 6 * Math.SQRT2).toBeGreaterThan(grading.strike.reachPx);
      }
    });
  }

  it('outlines the piece just outside it, and scales it for the wide view', () => {
    const r = worked(shapesFor('knife'), Array<boolean>(9).fill(false));
    const o = outline(r);
    for (let i = 0; i < o.length; i++) if (o[i]) expect(r.shade[i]).toBe(0);
    expect(o.some((v) => v === 1)).toBe(true);
    const w = scaled(r, 0.45);
    expect(w.w).toBe(Math.round(r.w * 0.45));
  });

  it('lays the pieces on the anvil face line', () => {
    expect(CLOSE_LINE_Y).toBe(390);
  });
});
