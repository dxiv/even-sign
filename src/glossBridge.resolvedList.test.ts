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
    __testSetGlossBridgeState({
      menuMode: 'phrases',
      phraseScreen: { kind: 'root' },
      slides: [],
    });
    expect(resolvedListItemName({ currentSelectItemIndex: 0 })).toBe('__header__');
    expect(resolvedListItemName({ currentSelectItemIndex: 1 })).toBe('Browse');
    expect(resolvedListItemName({ currentSelectItemIndex: 2 })).toBe('Recents');
  });

  it('prefers in-range index over stale name (nav list)', () => {
    __testSetGlossBridgeState({
      menuMode: 'nav',
      phraseScreen: { kind: 'categories' },
      slides: [PLACEHOLDER_SLIDE],
    });
    expect(resolvedListItemName({ currentSelectItemName: 'Prev', currentSelectItemIndex: 1 })).toBe('Prev');
    expect(resolvedListItemName({ currentSelectItemName: 'Exit', currentSelectItemIndex: 1 })).toBe('Prev');
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
    __testSetGlossBridgeState({
      menuMode: 'phrases',
      phraseScreen: { kind: 'root' },
      slides: [],
    });
    expect(resolvedListItemName({ currentSelectItemIndex: '0' })).toBe('__header__');
    expect(resolvedListItemName({ CurrentSelect_ItemIndex: '1' })).toBe('Browse');
    expect(resolvedListItemName({ CurrentSelect_ItemIndex: '2' })).toBe('Recents');
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
    __testSetGlossBridgeState({
      menuMode: 'nav',
      phraseScreen: { kind: 'root' },
      slides: [PLACEHOLDER_SLIDE],
    });
    // nav list has header + 6 actions
    expect(resolvedListItemName({ currentSelectItemIndex: 7 })).toBe('Exit');
  });

  it('returns undefined for unknown index or empty payload', () => {
    expect(resolvedListItemName({})).toBeUndefined();
    expect(resolvedListItemName({ currentSelectItemIndex: 99 })).toBeUndefined();
    expect(resolvedListItemName({ currentSelectItemIndex: -1 })).toBeUndefined();
  });
});
