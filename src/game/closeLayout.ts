/**
 * The close-up anvil view, in the background image's own game px (assets/close.png, 400 × 800), like wideLayout.ts
 * for the wide shot. Pieces lie along the anvil face, tip right (forge spec S3, "Settled at S3 start").
 * Targets in src/data/items.json sit on these pieces' centre lines; closeLayout.test.ts checks they stay on them.
 */
import knifeMask from './sprites/knife-close.json';

export type Pt = { x: number; y: number };

/**
 * A piece cut from the close-up concept (tools/art/knife_close.py): a grey shading layer tinted with the heat colour,
 * a dark outline that is never tinted, and its mask, all at the spot it was painted, in close.png px.
 */
export interface CloseSprite {
  fill: string;
  edge: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** One string per row, '#' where the piece is. */
  rows: string[];
}

const SPRITES: Record<string, CloseSprite> = {
  knife: { fill: 'knife-close', edge: 'knife-close-edge', ...knifeMask },
};

/** The piece's sprite in the close view, if it has one; otherwise it is drawn from its outline. */
export function closeSpriteFor(itemId: string): CloseSprite | null {
  return SPRITES[itemId] ?? null;
}

/** Whether close.png px (x, y) is on a sprite piece. */
export function onSprite(s: CloseSprite, x: number, y: number): boolean {
  const r = s.rows[Math.round(y) - s.y];
  return r !== undefined && r[Math.round(x) - s.x] === '#';
}

/** The anvil face's blade line, kept centred between the top bar and the panel. */
export const CLOSE_LINE_Y = 390;

/** A blade from `x0` to `x1` on the blade line: a tang, then the blade, tapering to the tip over 1.5 × its width. */
function blade(x0: number, x1: number, tang: number, tangHalf: number, half: number): Pt[] {
  const y = CLOSE_LINE_Y;
  const t = x0 + tang;
  const taper = x1 - half * 3;
  return [
    { x: x0, y: y - tangHalf }, { x: t, y: y - tangHalf }, { x: t, y: y - half }, { x: taper, y: y - half },
    { x: x1, y }, { x: taper, y: y + half }, { x: t, y: y + half }, { x: t, y: y + tangHalf }, { x: x0, y: y + tangHalf },
  ];
}

/** The horseshoe: a U lying on its side, open to the right, its centre line a half circle and two legs. */
export const SHOE = { cx: 205, radius: 36, half: 8, leg: 34 };

function horseshoe(): Pt[] {
  const { cx, radius, half, leg } = SHOE;
  const y = CLOSE_LINE_Y;
  const ro = radius + half;
  const ri = radius - half;
  const pts: Pt[] = [];
  const at = (r: number, deg: number) => ({ x: cx + Math.cos((deg * Math.PI) / 180) * r, y: y + Math.sin((deg * Math.PI) / 180) * r });
  for (let a = 270; a >= 90; a -= 10) pts.push(at(ro, a));
  pts.push({ x: cx + leg, y: y + ro }, { x: cx + leg, y: y + ri });
  for (let a = 90; a <= 270; a += 10) pts.push(at(ri, a));
  pts.push({ x: cx + leg, y: y - ri }, { x: cx + leg, y: y - ro });
  return pts;
}

/** Pieces with no concept art yet are drawn from these outlines. */
const OUTLINES: Record<string, Pt[]> = {
  horseshoe: horseshoe(),
  sword: blade(40, 360, 70, 5, 12),
};

/** The piece's outline in the close view, in close.png px (pieces without a sprite). */
export function closeOutlineFor(itemId: string): Pt[] {
  const o = OUTLINES[itemId];
  if (!o) throw new Error(`No close outline for ${itemId}`);
  return o;
}
