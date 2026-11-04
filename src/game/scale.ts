/** Whole-number scale that keeps the 336 × 640 safe zone on screen (forge spec, Scale and screen; D-003). */
export const SAFE_WIDTH = 336;
export const SAFE_HEIGHT = 640;
/** Backgrounds are 400 × 800 game px, so any visible area up to that size is covered. */
export const WORLD_WIDTH = 400;
export const WORLD_HEIGHT = 800;

export interface ScaleInfo {
  scale: number;
  visibleWidth: number;
  visibleHeight: number;
}

export function computeScale(cssWidth: number, cssHeight: number, devicePixelRatio: number): ScaleInfo {
  const physicalWidth = Math.floor(cssWidth * devicePixelRatio);
  const physicalHeight = Math.floor(cssHeight * devicePixelRatio);
  const scale = Math.max(1, Math.min(Math.floor(physicalWidth / SAFE_WIDTH), Math.floor(physicalHeight / SAFE_HEIGHT)));
  return {
    scale,
    visibleWidth: Math.floor(physicalWidth / scale),
    visibleHeight: Math.floor(physicalHeight / scale),
  };
}
