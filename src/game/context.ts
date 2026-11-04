import { browserStorage, loadSave, type LoadResult } from '../save/save';

/** State shared by the scenes for one page load. */
export interface GameContext {
  storage: Storage | null;
  load: LoadResult;
}

export function createContext(): GameContext {
  const storage = browserStorage();
  return { storage, load: loadSave(storage) };
}
