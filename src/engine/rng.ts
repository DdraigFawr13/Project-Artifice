/** Seeded random numbers for the engine (GAME-01): the engine never reads Math.random. */
export interface Rng {
  /** A number in [0, 1). */
  next(): number;
}

/** mulberry32: a small, fast 32-bit generator. The same seed always gives the same sequence. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}
