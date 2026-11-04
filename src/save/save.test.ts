import { describe, expect, it } from 'vitest';
import { SAVE_KEY, UNREADABLE_KEY, freshSave, loadSave, writeSave, type Save } from './save';

/** An in-memory Storage, so the save module is tested without a browser. */
function memoryStorage(initial: Record<string, string> = {}, opts: { failWrites?: boolean } = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => {
      if (opts.failWrites) throw new Error('QuotaExceededError');
      data.set(k, String(v));
    },
  };
}

const sample: Save = { version: 1, best: { knife: 74 }, scrap: 2, hintsSeen: { heat: 1 } };

describe('loadSave', () => {
  it('starts a fresh save when there is none', () => {
    const r = loadSave(memoryStorage());
    expect(r).toEqual({ save: freshSave(), saving: true, recovered: false });
    expect(freshSave()).toEqual({ version: 1, best: {}, scrap: 0, hintsSeen: {} });
  });

  it('reads a version 1 save', () => {
    const r = loadSave(memoryStorage({ [SAVE_KEY]: JSON.stringify(sample) }));
    expect(r.save).toEqual(sample);
    expect(r.recovered).toBe(false);
  });

  it.each([
    ['an unknown version', JSON.stringify({ ...sample, version: 99 })],
    ['bad JSON', '{"version": 1, best'],
    ['a version 1 save with the wrong shape', JSON.stringify({ version: 1, best: 'knife', scrap: 0, hintsSeen: {} })],
    ['a best score over 100', JSON.stringify({ ...sample, best: { knife: 101 } })],
    ['a fractional best score', JSON.stringify({ ...sample, best: { knife: 74.5 } })],
    ['negative scrap', JSON.stringify({ ...sample, scrap: -1 })],
    ['fractional scrap', JSON.stringify({ ...sample, scrap: 2.5 })],
    ['a negative hint count', JSON.stringify({ ...sample, hintsSeen: { heat: -1 } })],
  ])('keeps %s aside and starts fresh (GAME-05)', (_label, raw) => {
    const storage = memoryStorage({ [SAVE_KEY]: raw });
    const r = loadSave(storage);
    expect(r.save).toEqual(freshSave());
    expect(r.recovered).toBe(true);
    expect(storage.getItem(UNREADABLE_KEY)).toBe(raw);
  });

  it('never overwrites an earlier unreadable copy', () => {
    const storage = memoryStorage({ [UNREADABLE_KEY]: 'first', [SAVE_KEY]: 'second' });
    expect(loadSave(storage).recovered).toBe(true);
    expect(storage.getItem(UNREADABLE_KEY)).toBe('first');
    expect(storage.getItem(`${UNREADABLE_KEY}.2`)).toBe('second');
  });

  it('runs without storage and says progress is not saved', () => {
    const r = loadSave(null);
    expect(r).toEqual({ save: freshSave(), saving: false, recovered: false });
  });
});

describe('writeSave', () => {
  it('round-trips through storage', () => {
    const storage = memoryStorage();
    expect(writeSave(storage, sample)).toBe(true);
    expect(loadSave(storage).save).toEqual(sample);
  });

  it('reports failure when storage refuses the write', () => {
    expect(writeSave(memoryStorage({}, { failWrites: true }), sample)).toBe(false);
    expect(writeSave(null, sample)).toBe(false);
  });
});
