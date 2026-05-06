import { describe, expect, it, beforeEach } from 'vitest';
import { __testSetGlossBridgeState, resolvedListItemName } from './glossBridge';
import { getPhraseCategoryPickerRowLabels } from './phraseSnippets';

const PLACEHOLDER_SLIDE = {
  title: 'GLOSS',
  line: 'type or speak a phrase',
  kind: 'placeholder' as const,
};

describe('resolvedListItemName', () => {
  beforeEach(() => {
    __testSetGlossBridgeState({
      menuMode: 'phrases',
      phraseScreen: { kind: 'categories' },
      slides: [],
    });
  });

  it('resolves category rows on home (default phrases + categories)', () => {
    const cats = getPhraseCategoryPickerRowLabels();
    expect(cats.length).toBeGreaterThan(1);
    expect(resolvedListItemName({ currentSelectItemIndex: 0 })).toBe(cats[0]);
    expect(resolvedListItemName({ currentSelectItemIndex: 1 })).toBe(cats[1]);
  });

  it('prefers in-range index over stale name (nav list)', () => {
    __testSetGlossBridgeState({
      menuMode: 'nav',
      phraseScreen: { kind: 'categories' },
      slides: [PLACEHOLDER_SLIDE],
    });
    expect(resolvedListItemName({ currentSelectItemName: 'Prev', currentSelectItemIndex: 0 })).toBe('Prev');
    expect(resolvedListItemName({ currentSelectItemName: 'Exit', currentSelectItemIndex: 0 })).toBe('Prev');
  });

  it('falls back to currentSelectItemName when index is missing', () => {
    __testSetGlossBridgeState({
      menuMode: 'nav',
      phraseScreen: { kind: 'categories' },
      slides: [PLACEHOLDER_SLIDE],
    });
    expect(resolvedListItemName({ currentSelectItemName: 'Exit' })).toBe('Exit');
  });

  it('coerces string index from host JSON (G2 / simulator)', () => {
    const cats = getPhraseCategoryPickerRowLabels();
    expect(resolvedListItemName({ currentSelectItemIndex: '0' })).toBe(cats[0]);
    expect(resolvedListItemName({ CurrentSelect_ItemIndex: '1' })).toBe(cats[1]);
  });

  it('maps truncated Phrases row labels on nav (G2 list firmware)', () => {
    __testSetGlossBridgeState({
      menuMode: 'nav',
      phraseScreen: { kind: 'categories' },
      slides: [PLACEHOLDER_SLIDE],
    });
    expect(resolvedListItemName({ currentSelectItemName: 'Phrase' })).toBe('Phrases');
    expect(resolvedListItemName({ currentSelectItemName: 'Phras' })).toBe('Phrases');
    expect(resolvedListItemName({ currentSelectItemName: 'Sn' })).toBeUndefined();
  });

  it('treats 1-based last-row index when host sends n instead of n-1', () => {
    const cats = getPhraseCategoryPickerRowLabels();
    const n = cats.length;
    expect(resolvedListItemName({ currentSelectItemIndex: n })).toBe(cats[n - 1]);
  });

  it('returns undefined for unknown index or empty payload', () => {
    const cats = getPhraseCategoryPickerRowLabels();
    expect(resolvedListItemName({})).toBeUndefined();
    expect(resolvedListItemName({ currentSelectItemIndex: cats.length + 1 })).toBeUndefined();
    expect(resolvedListItemName({ currentSelectItemIndex: -1 })).toBeUndefined();
  });
});
