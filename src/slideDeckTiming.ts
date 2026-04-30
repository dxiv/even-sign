import type { SignSlide } from './signSlides';

/** Fingerspell trains faster than mixed letter + word slides. */
export function slideDeckStepMs(slides: SignSlide[]): number {
  if (slides.length <= 1) {
    return 720;
  }
  const allFingerspell = slides.every((s) => s.kind === 'letter' || s.kind === 'digit');
  return allFingerspell ? 520 : 780;
}

/** Dwell longer on word slides and add a gap before the next word (chat-style pacing). */
export function slideDeckDelayAfterSlide(slides: SignSlide[], indexShown: number): number {
  const s = slides[indexShown % slides.length];
  const base = slideDeckStepMs(slides);
  if (s.kind !== 'word') return base;
  const extraDwell = 1400;
  const next = slides[(indexShown + 1) % slides.length];
  const betweenWords = next.kind === 'word' ? 700 : 0;
  return base + extraDwell + betweenWords;
}
