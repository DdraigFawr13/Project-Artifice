import { itemById } from '../data/items';
import { step, type CraftState } from './craft';

/** One stroke straight along the item's edge line, `dy` px off it on alternate points (test fixture). */
export function strokePoints(itemId: string, dy = 0): { x: number; y: number }[] {
  const e = itemById(itemId).edgeLine!;
  // One point per px along the edge, so the steps are exactly equal.
  const n = Math.round(e.x1 - e.x0) + 1;
  return Array.from({ length: n }, (_, i) => ({ x: e.x0 + ((e.x1 - e.x0) * i) / (n - 1), y: e.y0 + (i % 2 === 0 ? dy : -dy) }));
}

/** Finishes a craft that waits in the grind with two straight, even strokes; any other craft is returned as it is. */
export function grindOut(s: CraftState): CraftState {
  if (s.location !== 'grind') return s;
  for (let i = 0; i < 2; i++) s = step(s, { stroke: strokePoints(s.itemId) });
  return s;
}
