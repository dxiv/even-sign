import { describe, expect, it, beforeEach } from 'vitest';
import { addRecent, clearRecents, loadUserPrefs, toggleFavorite } from './userPrefs';

class MemoryStorage {
  #m = new Map<string, string>();
  clear() {
    this.#m.clear();
  }
  getItem(key: string) {
    return this.#m.has(key) ? this.#m.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.#m.set(key, String(value));
  }
  removeItem(key: string) {
    this.#m.delete(key);
  }
}

describe('userPrefs', () => {
  beforeEach(() => {
    if (typeof localStorage === 'undefined') {
      // Vitest runs in a non-DOM environment for this repo; provide a tiny storage polyfill.
      (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
    }
    localStorage.clear();
  });

  it('starts empty', () => {
    const p = loadUserPrefs();
    expect(p.favorites).toEqual([]);
    expect(p.recents).toEqual([]);
  });

  it('toggles favorites and persists', () => {
    let p = loadUserPrefs();
    p = toggleFavorite(p, 'thank you');
    expect(p.favorites).toEqual(['thank you']);
    p = loadUserPrefs();
    expect(p.favorites).toEqual(['thank you']);
    p = toggleFavorite(p, 'thank you');
    expect(p.favorites).toEqual([]);
  });

  it('adds recents (deduped, newest first) and persists', () => {
    let p = loadUserPrefs();
    p = addRecent(p, 'hello', 10);
    p = addRecent(p, 'thanks', 11);
    p = addRecent(p, 'hello', 12);
    expect(p.recents.map((r) => r.phrase)).toEqual(['hello', 'thanks']);
    p = loadUserPrefs();
    expect(p.recents.map((r) => r.phrase)).toEqual(['hello', 'thanks']);
  });

  it('clears recents', () => {
    let p = loadUserPrefs();
    p = addRecent(p, 'hello', 1);
    p = clearRecents(p);
    expect(p.recents).toEqual([]);
  });
});

