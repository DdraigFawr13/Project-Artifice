import itemsJson from './items.json';

/** Ore parts per ore id. 2 or 3 ores, each at least 1 part, summing to the item's parts (forge spec, Engine). */
export type AlloyMix = Record<string, number>;

/** An item the smith can forge. Strike targets are added in slice S3. */
export interface Item {
  id: string;
  name: string;
  /** Ore parts the item takes. */
  parts: number;
  /** About how long a craft takes for a practised player. */
  minutes: number;
  /** The alloy used until the alloy screen lands in S5. */
  defaultAlloy: AlloyMix;
}

export const items: readonly Item[] = itemsJson as Item[];

export function itemById(id: string): Item {
  const item = items.find((i) => i.id === id);
  if (!item) throw new Error(`Unknown item: ${id}`);
  return item;
}
