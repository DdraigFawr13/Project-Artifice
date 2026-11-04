import type { AlloyMix } from '../data/items';
import { browserStorage, loadSave, type LoadResult } from '../save/save';

/** State shared by the scenes for one page load. */
export interface GameContext {
  storage: Storage | null;
  load: LoadResult;
  /** The last mix started for each item, for the alloy screen; held for the page load, not saved (S5). */
  lastMix: Record<string, AlloyMix>;
}

export function createContext(): GameContext {
  const storage = browserStorage();
  return { storage, load: loadSave(storage), lastMix: {} };
}
