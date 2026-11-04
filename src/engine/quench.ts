import grading from '../data/grading.json';
import type { Line } from './strike';

const Q = grading.quench;

/** The quench's points lost at the metal's temperature in the water: 1 per 25 °C outside 780–880 °C, in fractions (forge spec, Data). */
export function quenchLines(tempC: number): Line[] {
  if (tempC < Q.lowC) return [{ cause: 'quench-cold', points: (Q.lowC - tempC) / Q.degreesPerPoint }];
  if (tempC > Q.highC) return [{ cause: 'quench-hot', points: (tempC - Q.highC) / Q.degreesPerPoint }];
  return [];
}

/** A quench this hot cracks the piece (forge spec, Data → Ruin). */
export const isWhiteQuench = (tempC: number) => tempC >= grading.ruin.whiteQuenchC;
