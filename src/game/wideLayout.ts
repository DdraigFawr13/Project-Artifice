/**
 * Where things sit in the wide shot, in the background image's own game px (assets/wide.png, 400 × 800).
 * Measured from the image on 2026-11-04. The screen adds the background's offset (Forge.layout()).
 */
export interface Rect { x: number; y: number; w: number; h: number }

/** The middle of the fire-to-tub area, which is kept centred between the top bar and the panel (mock-up frame 3). */
export const CONTENT_MID_Y = 470;
/** Where the painted floor ends; below it the image fades to `--night-0`. Kept at or below the panel's top edge. */
export const CONTENT_BOTTOM_Y = 712;

/** Where the bar rests: its centre, and which way its tip points (−1 left, 1 right). */
export const REST = {
  fire: { x: 100, y: 384, dir: -1 },
  anvil: { x: 252, y: 450, dir: 1 },
} as const;

/** Drop zones for a held bar. A drop anywhere else returns the bar to where it was. */
export const ZONES: Record<'fire' | 'anvil' | 'tub', Rect> = {
  fire: { x: 20, y: 300, w: 140, h: 115 },
  anvil: { x: 145, y: 415, w: 165, h: 85 },
  tub: { x: 292, y: 480, w: 100, h: 180 },
};

/** The forge glow's centre and size. */
export const FIRE_GLOW = { x: 85, y: 350, size: 230 };

export const inside = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
