/**
 * The hot piece's outline per item, drawn in code (forge spec, Screens; D-003). Points are in game px around the
 * piece's centre, with the tip pointing right; the screen mirrors them when the tip points left.
 */
export type Outline = { x: number; y: number }[];

function blade(length: number, tang: number, width: number): Outline {
  const half = length / 2;
  const t = -half + tang; // where the tang meets the blade
  const w = width / 2;
  return [
    { x: -half, y: -1 },
    { x: t, y: -1 },
    { x: t, y: -w },
    { x: half - width * 1.5, y: -w },
    { x: half, y: 0 },
    { x: half - width * 1.5, y: w - 1 },
    { x: t, y: w },
    { x: t, y: 1 },
    { x: -half, y: 1 },
  ];
}

/** A flat bar bent into a U, lying on its side; open end towards the tip direction. */
function horseshoe(): Outline {
  const pts: Outline = [];
  const r = 14;
  const inner = 9;
  const leg = 10;
  for (let a = 90; a <= 270; a += 15) pts.push({ x: Math.cos((a * Math.PI) / 180) * r, y: Math.sin((a * Math.PI) / 180) * r });
  pts.push({ x: leg, y: -r }, { x: leg, y: -inner });
  for (let a = 270; a >= 90; a -= 15) pts.push({ x: Math.cos((a * Math.PI) / 180) * inner, y: Math.sin((a * Math.PI) / 180) * inner });
  pts.push({ x: leg, y: inner }, { x: leg, y: r });
  return pts;
}

const OUTLINES: Record<string, Outline> = {
  horseshoe: horseshoe(),
  knife: blade(96, 26, 8),
  sword: blade(150, 34, 10),
};

export function outlineFor(itemId: string): Outline {
  const o = OUTLINES[itemId];
  if (!o) throw new Error(`No outline for ${itemId}`);
  return o;
}

export function bounds(o: Outline): { minX: number; minY: number; maxX: number; maxY: number } {
  return {
    minX: Math.min(...o.map((p) => p.x)),
    minY: Math.min(...o.map((p) => p.y)),
    maxX: Math.max(...o.map((p) => p.x)),
    maxY: Math.max(...o.map((p) => p.y)),
  };
}
