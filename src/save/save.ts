/** The save between crafts (forge spec, Save). Storage is passed in so tests run without a browser. */
export const SAVE_KEY = 'artifice.save';
export const UNREADABLE_KEY = 'artifice.save.unreadable';

export interface Save {
  version: 1;
  /** Best craft score per item id. */
  best: Record<string, number>;
  /** Mixed-metal parts returned from ruins. */
  scrap: number;
  /** How many times each step's hint has been shown. */
  hintsSeen: Record<string, number>;
}

export interface LoadResult {
  save: Save;
  /** False when storage is unavailable: the game runs but progress is not kept. */
  saving: boolean;
  /** True when an unreadable save was kept aside under UNREADABLE_KEY. */
  recovered: boolean;
}

export function freshSave(): Save {
  return { version: 1, best: {}, scrap: 0, hintsSeen: {} };
}

/** The browser's localStorage, or null when it is missing or refuses writes (private modes, blocked storage). */
export function browserStorage(): Storage | null {
  try {
    const s = globalThis.localStorage;
    const probe = `${SAVE_KEY}.probe`;
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

function isNumberRecord(v: unknown): v is Record<string, number> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && Object.values(v).every((n) => typeof n === 'number' && Number.isFinite(n));
}

function parseSave(raw: string): Save | null {
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null) return null;
    const o = v as Record<string, unknown>;
    // Only version 1 exists. A later version adds its upgrade step here (GAME-05).
    if (o.version !== 1) return null;
    if (!isNumberRecord(o.best) || !isNumberRecord(o.hintsSeen)) return null;
    if (typeof o.scrap !== 'number' || !Number.isFinite(o.scrap) || o.scrap < 0) return null;
    return { version: 1, best: { ...o.best }, scrap: o.scrap, hintsSeen: { ...o.hintsSeen } };
  } catch {
    return null;
  }
}

/** Read the save. An unreadable one is copied aside, never silently overwritten (GAME-05). */
export function loadSave(storage: Storage | null): LoadResult {
  if (!storage) return { save: freshSave(), saving: false, recovered: false };
  let raw: string | null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return { save: freshSave(), saving: false, recovered: false };
  }
  if (raw === null) return { save: freshSave(), saving: true, recovered: false };
  const save = parseSave(raw);
  if (save) return { save, saving: true, recovered: false };
  try {
    storage.setItem(UNREADABLE_KEY, raw);
    storage.removeItem(SAVE_KEY);
  } catch {
    // The original stays where it was; nothing is overwritten.
    return { save: freshSave(), saving: false, recovered: false };
  }
  return { save: freshSave(), saving: true, recovered: true };
}

/** Write the save. Returns false when storage is missing or refuses the write. */
export function writeSave(storage: Storage | null, save: Save): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
