import { describe, expect, it } from 'vitest';
import {
  PHRASE_SNIPPET_CATEGORIES,
  PHRASE_SNIPPET_COUNT,
  findPhraseCategoryByTitle,
  getPhraseCategoryTitles,
} from './phraseSnippets';

describe('phraseSnippets', () => {
  it('exports at least 100 snippets in sorted categories', () => {
    expect(PHRASE_SNIPPET_COUNT).toBeGreaterThanOrEqual(100);
    const titles = PHRASE_SNIPPET_CATEGORIES.map((c) => c.title);
    const sorted = [...titles].sort((a, b) => a.localeCompare(b, 'en'));
    expect(titles).toEqual(sorted);
    for (const c of PHRASE_SNIPPET_CATEGORIES) {
      const labels = c.snippets.map((s) => s.label);
      const ls = [...labels].sort((a, b) => a.localeCompare(b, 'en'));
      expect(labels).toEqual(ls);
    }
  });

  it('category titles are unique and resolve from getPhraseCategoryTitles', () => {
    const t = getPhraseCategoryTitles();
    expect(new Set(t).size).toBe(t.length);
    for (const title of t) {
      expect(findPhraseCategoryByTitle(title)?.title).toBe(title);
    }
  });
});
