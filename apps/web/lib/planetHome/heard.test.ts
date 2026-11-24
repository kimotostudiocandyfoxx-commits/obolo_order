import { afterEach, describe, expect, it } from 'vitest';
import { loadHeard, saveHeard } from './heard';

const store = new Map<string, string>();
const fake = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };

describe('M-R259: heard kororins survive a reload (this device)', () => {
  afterEach(() => {
    store.clear();
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });
  it('kept per member and planet; only ids still on the record are kept', () => {
    (globalThis as { localStorage?: unknown }).localStorage = fake;
    saveHeard('me', 'saturn', new Set(['a', 'b', 'gone']), new Set(['a', 'b', 'c']));
    expect([...loadHeard('me', 'saturn')].sort()).toEqual(['a', 'b']);
    expect(loadHeard('me', 'jupiter').size).toBe(0);
    expect(loadHeard('someone', 'saturn').size).toBe(0);
  });
  it('no browser storage: nothing remembered, no error', () => {
    expect(() => saveHeard('me', 'saturn', new Set(['a']))).not.toThrow();
    expect(loadHeard('me', 'saturn').size).toBe(0);
  });
});
