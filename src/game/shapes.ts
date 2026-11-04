/**
 * How a piece looks as it is worked (forge spec S3; Morgan 2026-11-04): it starts as bar stock, and each target owns its
 * stretch of the piece (the pixels nearer to it than to any other target). Striking a target turns its stretch into
 * the finished shape. The hammer spreads the metal, so the bar is narrower than the finished piece.
 *
 * Shapes are rasters in close-view game px (assets/close.png). Each pixel holds a shading value: 0 empty, otherwise
 * 0.4–1, which the screen tints with the heat colour. The screen only draws these; struck flags come from the engine.
 */
import { itemById } from '../data/items';
import { CLOSE_LINE_Y, closeOutlineFor, SHOE, type Pt } from './closeLayout';
import knifeArt from './sprites/knife-close.json';

export interface Raster {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Row by row, w × h values: 0 empty, else the shading 0.4–1. */
  shade: Float32Array;
}

export interface PieceShapes {
  bar: Raster;
  final: Raster;
  /** For each pixel of the shared box, the index of the target whose stretch it is in. */
  region: Int16Array;
}

const RIM = 0.4;
const STEPS: Record<string, number> = { r: RIM, '1': 0.62, '2': 0.76, '3': 0.88, '4': 1 };
/** Half the bar's thickness in game px, by item. */
const BAR_HALF: Record<string, number> = { knife: 5, sword: 5, horseshoe: 6 };

/** Wide-view size of each piece, as a share of its close-view size. */
export const WIDE_SCALE: Record<string, number> = { knife: 0.45, sword: 0.45, horseshoe: 0.35 };

function insidePoly(pts: Pt[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!;
    const b = pts[j]!;
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Distance from (x, y) to the piece's centre path. */
function pathDistance(itemId: string, x: number, y: number, ends: { x0: number; x1: number; y: number }): number {
  if (itemId === 'horseshoe') {
    const { cx, radius, leg } = SHOE;
    // Left of the arc's centre: the half circle; right of it: the two straight legs.
    if (x <= cx) return Math.abs(Math.hypot(x - cx, y - CLOSE_LINE_Y) - radius);
    if (x > cx + leg) return Infinity;
    return Math.min(Math.abs(y - (CLOSE_LINE_Y - radius)), Math.abs(y - (CLOSE_LINE_Y + radius)));
  }
  if (x < ends.x0 || x > ends.x1) return Infinity;
  return Math.abs(y - ends.y);
}

function emptyRaster(x: number, y: number, w: number, h: number): Raster {
  return { x, y, w, h, shade: new Float32Array(w * h) };
}

/** Rim pixels (on, with an empty 4-neighbour) take the rim shade. */
function addRim(r: Raster): void {
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < r.w && y < r.h && r.shade[y * r.w + x]! > 0;
  const rim: number[] = [];
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
    if (on(x, y) && (!on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1))) rim.push(y * r.w + x);
  }
  for (const i of rim) r.shade[i] = RIM;
}

function finalRaster(itemId: string): Raster {
  if (itemId === 'knife') {
    const r = emptyRaster(knifeArt.x, knifeArt.y, knifeArt.w, knifeArt.h);
    knifeArt.rows.forEach((row, y) => [...row].forEach((c, x) => (r.shade[y * r.w + x] = STEPS[c] ?? 0)));
    return r;
  }
  const pts = closeOutlineFor(itemId);
  const x0 = Math.floor(Math.min(...pts.map((p) => p.x)));
  const y0 = Math.floor(Math.min(...pts.map((p) => p.y)));
  const r = emptyRaster(x0, y0, Math.ceil(Math.max(...pts.map((p) => p.x))) - x0 + 1, Math.ceil(Math.max(...pts.map((p) => p.y))) - y0 + 1);
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (insidePoly(pts, r.x + x + 0.5, r.y + y + 0.5)) r.shade[y * r.w + x] = 0.88;
  addRim(r);
  return r;
}

/** Bar stock along the piece's centre path, as long as the finished piece; the top face catches more heat light. */
function barRaster(itemId: string, final: Raster): Raster {
  const half = BAR_HALF[itemId] ?? 5;
  const targets = itemById(itemId).targets;
  const ends = { x0: final.x, x1: final.x + final.w - 1, y: Math.round(targets.reduce((a, t) => a + t.y, 0) / targets.length) };
  const r = emptyRaster(final.x - half, final.y - half, final.w + 2 * half, final.h + 2 * half);
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
    const gx = r.x + x;
    const gy = r.y + y;
    const d = pathDistance(itemId, gx, gy, ends);
    if (d <= half) r.shade[y * r.w + x] = d <= half - 2 && gy < (itemId === 'horseshoe' ? Infinity : ends.y) ? 0.88 : 0.76;
  }
  addRim(r);
  return r;
}

/** Re-box a raster onto a larger box. */
function rebox(r: Raster, x: number, y: number, w: number, h: number): Raster {
  const out = emptyRaster(x, y, w, h);
  for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) out.shade[(j + r.y - y) * w + (i + r.x - x)] = r.shade[j * r.w + i]!;
  return out;
}

const cache = new Map<string, PieceShapes>();

export function shapesFor(itemId: string): PieceShapes {
  const hit = cache.get(itemId);
  if (hit) return hit;
  const f = finalRaster(itemId);
  const b = barRaster(itemId, f);
  // The shared box, with 1 px spare all round for the outline.
  const x = Math.min(f.x, b.x) - 1;
  const y = Math.min(f.y, b.y) - 1;
  const w = Math.max(f.x + f.w, b.x + b.w) - x + 1;
  const h = Math.max(f.y + f.h, b.y + b.h) - y + 1;
  const final = rebox(f, x, y, w, h);
  const bar = rebox(b, x, y, w, h);
  const targets = itemById(itemId).targets;
  const region = new Int16Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let best = 0;
    let bestD = Infinity;
    targets.forEach((t, k) => {
      const d = Math.hypot(x + i - t.x, y + j - t.y);
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    });
    region[j * w + i] = best;
  }
  const s = { bar, final, region };
  cache.set(itemId, s);
  return s;
}

/** The piece as worked so far: each struck target's stretch is the finished shape, the rest is still bar. */
export function worked(s: PieceShapes, struck: readonly boolean[]): Raster {
  const { x, y, w, h } = s.final;
  const out = emptyRaster(x, y, w, h);
  for (let i = 0; i < w * h; i++) out.shade[i] = (struck[s.region[i]!] ? s.final : s.bar).shade[i]!;
  return out;
}

/** Sample a raster at scale k (nearest pixel), for the wide view. */
export function scaled(r: Raster, k: number): Raster {
  const w = Math.max(1, Math.round(r.w * k));
  const h = Math.max(1, Math.round(r.h * k));
  const out = emptyRaster(0, 0, w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    out.shade[j * w + i] = r.shade[Math.min(r.h - 1, Math.floor((j + 0.5) / k)) * r.w + Math.min(r.w - 1, Math.floor((i + 0.5) / k))]!;
  }
  return out;
}

/** True where a pixel is empty but touches the piece (8 neighbours): the dark outline. */
export function outline(r: Raster): Uint8Array {
  const out = new Uint8Array(r.w * r.h);
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < r.w && y < r.h && r.shade[y * r.w + x]! > 0;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
    if (on(x, y)) continue;
    for (let dy = -1; dy <= 1 && !out[y * r.w + x]; dy++) for (let dx = -1; dx <= 1; dx++) if (on(x + dx, y + dy)) out[y * r.w + x] = 1;
  }
  return out;
}

/** Whether close-view px (x, y) is on a raster. */
export function onRaster(r: Raster, x: number, y: number): boolean {
  const i = Math.round(x) - r.x;
  const j = Math.round(y) - r.y;
  return i >= 0 && j >= 0 && i < r.w && j < r.h && r.shade[j * r.w + i]! > 0;
}
