import { describe, expect, it } from 'vitest';
import { phraseToSlides, wordAssetSlug, type SignSlide } from './signSlides';

describe('phraseToSlides', () => {
  it('returns placeholder when phrase is empty', () => {
    const s = phraseToSlides('  ');
    expect(s).toHaveLength(1);
    expect(s[0].title).toBe('GLOSS');
    expect(s[0].kind).toBe('placeholder');
  });

  it('fingerspells unknown words', () => {
    const s = phraseToSlides('ab');
    expect(s.map((x) => x.title).join('')).toBe('AB');
    expect(s.every((x) => x.kind === 'letter')).toBe(true);
    expect(s[0].spellOf).toBe('AB');
    expect(s[0].spellIndex).toBe(1);
    expect(s[0].spellOfLen).toBe(2);
  });

  it('expands glossary word to letters when not compact', () => {
    const s = phraseToSlides('hello');
    expect(s.length).toBeGreaterThan(1);
    expect(s[0].title).toBe('H');
    expect(s[0].kind).toBe('letter');
    expect(s[0].spellOf).toBe('HELLO');
    expect(s[0].spellIndex).toBe(1);
    expect(s[0].spellOfLen).toBe(5);
  });

  it('uses one slide per glossary word when compact', () => {
    const s = phraseToSlides('hello', { compactGlossary: true });
    expect(s).toHaveLength(1);
    expect(s[0].title).toBe('HELLO');
    expect(s[0].kind).toBe('word');
    expect(s[0].wordToken).toBe('hello');
  });

  it('stores typed token for multi-word gloss titles', () => {
    const s = phraseToSlides('thanks', { compactGlossary: true });
    expect(s[0].title).toBe('THANK YOU');
    expect(s[0].wordToken).toBe('thanks');
  });
});

describe('wordAssetSlug', () => {
  it('returns null for single glyph slides', () => {
    const slide: SignSlide = { title: 'A', line: 'letter', kind: 'letter' };
    expect(wordAssetSlug(slide)).toBeNull();
  });

  it('derives slug from multi-char title', () => {
    const slide: SignSlide = { title: 'THANK YOU', line: 'x', kind: 'word' };
    expect(wordAssetSlug(slide)).toBe('thank-you');
  });

  it('uses wordKey when set', () => {
    const slide: SignSlide = { title: 'HELLO', line: 'x', kind: 'word', wordKey: 'custom-key' };
    expect(wordAssetSlug(slide)).toBe('custom-key');
  });
});
