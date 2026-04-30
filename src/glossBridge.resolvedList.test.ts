import { describe, expect, it } from 'vitest';
import { resolvedListItemName } from './glossBridge';

describe('resolvedListItemName', () => {
  it('prefers currentSelectItemName when present', () => {
    expect(resolvedListItemName({ currentSelectItemName: 'Next', currentSelectItemIndex: 0 })).toBe('Next');
  });

  it('maps currentSelectItemIndex when name is missing (glasses swipe)', () => {
    expect(resolvedListItemName({ currentSelectItemIndex: 0 })).toBe('Prev');
    expect(resolvedListItemName({ currentSelectItemIndex: 1 })).toBe('Next');
    expect(resolvedListItemName({ currentSelectItemIndex: 2 })).toBe('Replay');
    expect(resolvedListItemName({ currentSelectItemIndex: 3 })).toBe('Clear');
    expect(resolvedListItemName({ currentSelectItemIndex: 4 })).toBe('Phrases');
    expect(resolvedListItemName({ currentSelectItemIndex: 5 })).toBe('Exit');
  });

  it('returns undefined for unknown index or empty payload', () => {
    expect(resolvedListItemName({})).toBeUndefined();
    expect(resolvedListItemName({ currentSelectItemIndex: 6 })).toBeUndefined();
    expect(resolvedListItemName({ currentSelectItemIndex: -1 })).toBeUndefined();
  });
});
