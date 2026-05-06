import { describe, expect, it } from 'vitest';
import {
  PHRASE_SNIPPET_CATEGORIES,
  findSnippetInCategory,
  phraseSnippetGlassesRowLabel,
} from './phraseSnippets';
import { phraseToSlides } from './signSlides';

describe('phrase snippets vs phraseToSlides', () => {
  it('resolves every glasses row back to the same snippet', () => {
    for (const cat of PHRASE_SNIPPET_CATEGORIES) {
      for (const s of cat.snippets) {
        const row = phraseSnippetGlassesRowLabel(s);
        const hit = findSnippetInCategory(cat.title, row);
        expect(hit?.phrase, `${cat.title} / ${row}`).toBe(s.phrase);
      }
    }
  });

  it('every snippet phrase yields at least one slide (compact and expanded)', () => {
    for (const cat of PHRASE_SNIPPET_CATEGORIES) {
      for (const s of cat.snippets) {
        const p = s.phrase.trim();
        const compact = phraseToSlides(p, { compactGlossary: true });
        const full = phraseToSlides(p, { compactGlossary: false });
        expect(compact.length, `compact: ${cat.title} / ${s.label}`).toBeGreaterThan(0);
        expect(full.length, `full: ${cat.title} / ${s.label}`).toBeGreaterThan(0);
        expect(compact.some((x) => x.kind === 'other' && x.title === '?'), p).toBe(false);
        expect(full.some((x) => x.kind === 'other' && x.title === '?'), p).toBe(false);
      }
    }
  });
});
