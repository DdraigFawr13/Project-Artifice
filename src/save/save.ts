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

const isCount = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0;
const isScore = (n: unknown): n is number => isCount(n) && n <= 100;

function isRecordOf(v: unknown, ok: (n: unknown) => boolean): v is Record<string, number> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && Object.values(v).every(ok);
}

/** The first free key for an unreadable save, so an earlier unreadable copy is never overwritten. */
function unreadableKey(storage: Storage): string {
  if (storage.getItem(UNREADABLE_KEY) === null) return UNREADABLE_KEY;
  for (let n = 2; ; n++) if (storage.getItem(`${UNREADABLE_KEY}.${n}`) === null) return `${UNREADABLE_KEY}.${n}`;
}

function parseSave(raw: string): Save | null {
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null) return null;
    const o = v as Record<string, unknown>;
    // Only version 1 exists. A later version adds its upgrade step here (GAME-05).
    if (o.version !== 1) return null;
    // Scores are whole numbers 0–100; scrap and hint counts are whole numbers from 0.
    if (!isRecordOf(o.best, isScore) || !isRecordOf(o.hintsSeen, isCount) || !isCount(o.scrap)) return null;
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
    storage.setItem(unreadableKey(storage), raw);
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
