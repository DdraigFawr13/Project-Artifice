import { heatRules as H } from '../data/heatBands';

export type Place = 'fire' | 'anvil' | 'held' | 'done';

/** One fixed step of heat (forge spec, Data → Heat). Pure: no clock, no randomness. */
export function heatStep(tempC: number, place: Place, bellows: boolean, coolRate: number, dtS: number): number {
  if (place === 'done') return tempC;
  if (place === 'fire') {
    if (bellows) return Math.min(H.maxC, tempC + H.bellowsRate * dtS);
    // Without the bellows the fire pulls the bar towards its idle heat, from either side, and stops there.
    const d = H.idleTargetC - tempC;
    const move = H.idleRate * dtS;
    return Math.abs(d) <= move ? H.idleTargetC : tempC + Math.sign(d) * move;
  }
  return Math.max(H.floorC, tempC - coolRate * dtS);
}
