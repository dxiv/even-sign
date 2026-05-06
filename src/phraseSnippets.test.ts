import { describe, expect, it } from 'vitest';
import {
  PHRASE_SNIPPET_CATEGORIES,
  PHRASE_SNIPPET_COUNT,
  findPhraseCategoryByPickerRowLabel,
  findPhraseCategoryByTitle,
  findSnippetInCategory,
  getPhraseCategoryPickerRowLabels,
  getPhraseCategoryTitles,
  phraseCategoryPickerRowLabel,
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

  it('G2 phrase picker row labels are unique and map back to the same category as title', () => {
    const rows = getPhraseCategoryPickerRowLabels();
    expect(new Set(rows).size).toBe(rows.length);
    for (const c of PHRASE_SNIPPET_CATEGORIES) {
      const row = phraseCategoryPickerRowLabel(c);
      expect(findPhraseCategoryByPickerRowLabel(row)?.title).toBe(c.title);
    }
  });

  it('resolves category picker rows case-insensitively (G2 may not preserve string casing)', () => {
    expect(findPhraseCategoryByPickerRowLabel('travel')?.title).toBe('Directions');
    expect(findPhraseCategoryByPickerRowLabel('  TRAVEL ')?.title).toBe('Directions');
  });

  it('resolves phrase rows case-insensitively within a category', () => {
    expect(findSnippetInCategory('Directions', 'AIRPORT')?.phrase).toBe('airport');
    expect(findSnippetInCategory('Directions', '  Lift ')?.phrase).toBe('elevator');
  });
});
