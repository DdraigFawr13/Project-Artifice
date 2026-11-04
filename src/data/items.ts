import itemsJson from './items.json';

/** An item the smith can forge. Strike targets are added in slice S3. */
export interface Item {
  id: string;
  name: string;
  /** Ore parts the item takes. */
  parts: number;
  /** About how long a craft takes for a practised player. */
  minutes: number;
}

export const items: readonly Item[] = itemsJson;
