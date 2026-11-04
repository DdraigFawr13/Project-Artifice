import { describe, expect, it } from 'vitest';
import { items } from '../data/items';
import grading from '../data/grading.json';
import { closeOutlineFor, CLOSE_LINE_Y } from './closeLayout';

// Every target sits on its piece in the close view, and no two are within one reach of each other before the
// seed's ±3 px (S3 "Settled at S3 start").
const insidePoly = (pts: { x: number; y: number }[], x: number, y: number) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!;
    const b = pts[j]!;
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};

describe('close-view targets', () => {
  for (const item of items) {
    it(`${item.id}: targets lie on the piece, spaced more than the reach apart`, () => {
      const counts: Record<string, number> = { horseshoe: 5, knife: 9, sword: 15 };
      expect(item.targets).toHaveLength(counts[item.id]!);
      const outline = closeOutlineFor(item.id);
      for (const t of item.targets) {
        // Inside even after the seed moves it 3 px either way in x and y.
        for (const [dx, dy] of [[-3, -3], [3, -3], [-3, 3], [3, 3]] as const) {
          expect(insidePoly(outline, t.x + dx, t.y + dy), `${item.id} target ${t.x},${t.y} moved ${dx},${dy}`).toBe(true);
        }
      }
      for (let i = 1; i < item.targets.length; i++) {
        const a = item.targets[i - 1]!;
        const b = item.targets[i]!;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(2 * grading.strike.reachPx);
      }
    });
  }
  it('centres the pieces on the anvil face line', () => {
    expect(CLOSE_LINE_Y).toBe(390);
  });
});
