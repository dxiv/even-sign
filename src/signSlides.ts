/** How this slide should read on glasses — drives frame badges and pacing hints. */
export type SignSlideKind = 'letter' | 'digit' | 'word' | 'placeholder' | 'other';

export type SignSlide = {
  title: string;
  line: string;
  /** If set, load `words/{wordKey}.png` instead of deriving from title. */
  wordKey?: string;
  /** Phrase token that mapped to this sign (compact glossary), for captions. */
  wordToken?: string;
  kind: SignSlideKind;
  /**
   * When spelling a multi-character token (glossary expansion or unknown word),
   * the full token and position (for status + learning badges).
   */
  spellOf?: string;
  spellIndex?: number;
  spellOfLen?: number;
};

type WordDef = { title: string; line: string; wordKey?: string };

const WORDS: Record<string, WordDef> = {
  hello: { title: 'HELLO', line: 'greeting' },
  hi: { title: 'HELLO', line: 'greeting' },
  hey: { title: 'HELLO', line: 'greeting' },
  yes: { title: 'YES', line: 'affirm' },
  no: { title: 'NO', line: 'negate' },
  please: { title: 'PLEASE', line: 'polite' },
  thanks: { title: 'THANK YOU', line: 'gratitude' },
  thank: { title: 'THANK YOU', line: 'gratitude' },
  you: { title: 'YOU', line: 'point / refer' },
  sorry: { title: 'SORRY', line: 'apology' },
  good: { title: 'GOOD', line: 'positive' },
  bad: { title: 'BAD', line: 'negative' },
  name: { title: 'NAME', line: 'intro' },
  what: { title: 'WHAT', line: 'question' },
  help: { title: 'HELP', line: 'assist' },
  sign: { title: 'SIGN', line: 'signing' },
  morning: { title: 'GOOD MORNING', line: 'time' },
  night: { title: 'GOOD NIGHT', line: 'time' },
  bye: { title: 'GOODBYE', line: 'parting' },
  love: { title: 'LOVE', line: 'emotion' },
  learn: { title: 'LEARN', line: 'study' },
  water: { title: 'WATER', line: 'drink' },
  food: { title: 'FOOD', line: 'eat' },
  eat: { title: 'EAT', line: 'meal' },
  drink: { title: 'DRINK', line: 'beverage' },
  bathroom: { title: 'BATHROOM', line: 'restroom' },
  friend: { title: 'FRIEND', line: 'person' },
  family: { title: 'FAMILY', line: 'relatives' },
  work: { title: 'WORK', line: 'job' },
  home: { title: 'HOME', line: 'place' },
  today: { title: 'TODAY', line: 'day' },
  tomorrow: { title: 'TOMORROW', line: 'future' },
  now: { title: 'NOW', line: 'time' },
  later: { title: 'LATER', line: 'delay' },
  understand: { title: 'UNDERSTAND', line: 'comprehend' },
  know: { title: 'KNOW', line: 'familiar' },
  deaf: { title: 'DEAF', line: 'identity' },
  hearing: { title: 'HEARING', line: 'can hear' },
  slow: { title: 'SLOW', line: 'repeat' },
  again: { title: 'AGAIN', line: 'repeat' },
  stop: { title: 'STOP', line: 'halt' },
  wait: { title: 'WAIT', line: 'pause' },
  fine: { title: 'FINE', line: 'okay' },
  tired: { title: 'TIRED', line: 'rest' },
  happy: { title: 'HAPPY', line: 'mood' },
  sad: { title: 'SAD', line: 'mood' },
  doctor: { title: 'DOCTOR', line: 'health' },
  hospital: { title: 'HOSPITAL', line: 'health' },
  pain: { title: 'PAIN', line: 'hurt' },
  medicine: { title: 'MEDICINE', line: 'health' },
};

const SINGLE_DISPLAY_GLYPH = /^[A-Z0-9]$/;

function titleToWordSlug(title: string): string | null {
  const s = title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s.length > 0 ? s : null;
}

/** `words/{slug}.png` slug, or null for single A–Z / 0–9 slides. */
export function wordAssetSlug(slide: SignSlide): string | null {
  if (SINGLE_DISPLAY_GLYPH.test(slide.title)) {
    return null;
  }
  if (slide.wordKey) {
    const k = slide.wordKey
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]+/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return k.length > 0 ? k : null;
  }
  return titleToWordSlug(slide.title);
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export type PhraseToSlidesOptions = {
  /** One slide per glossary word (`words/*.png`) instead of spelling. */
  compactGlossary?: boolean;
};

export function phraseToSlides(phrase: string, opts?: PhraseToSlidesOptions): SignSlide[] {
  const compact = opts?.compactGlossary === true;
  const raw = phrase.trim();
  if (!raw) {
    return [{ title: 'EVENSIGN', line: 'type or speak a phrase', kind: 'placeholder' }];
  }

  const slides: SignSlide[] = [];
  for (const w of tokenize(raw)) {
    const hit = WORDS[w];
    if (hit) {
      if (compact) {
        const slide: SignSlide = { title: hit.title, line: hit.line, kind: 'word', wordToken: w };
        if (hit.wordKey) slide.wordKey = hit.wordKey;
        slides.push(slide);
      } else {
        const letters = hit.title.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const n = letters.length;
        let i = 0;
        for (const ch of letters) {
          i += 1;
          if (ch >= 'A' && ch <= 'Z') {
            slides.push({
              title: ch,
              line: hit.line,
              kind: 'letter',
              spellOf: hit.title,
              spellIndex: i,
              spellOfLen: n,
            });
          } else if (ch >= '0' && ch <= '9') {
            slides.push({
              title: ch,
              line: hit.line,
              kind: 'digit',
              spellOf: hit.title,
              spellIndex: i,
              spellOfLen: n,
            });
          }
        }
      }
      continue;
    }
    const tok = w.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const spellOf = tok.length > 1 ? tok : undefined;
    const n = tok.length;
    let i = 0;
    for (const ch of w.toUpperCase()) {
      if (ch >= 'A' && ch <= 'Z') {
        i += 1;
        slides.push({
          title: ch,
          line: 'letter',
          kind: 'letter',
          spellOf,
          spellIndex: spellOf ? i : undefined,
          spellOfLen: spellOf ? n : undefined,
        });
      } else if (ch >= '0' && ch <= '9') {
        i += 1;
        slides.push({
          title: ch,
          line: 'digit',
          kind: 'digit',
          spellOf,
          spellIndex: spellOf ? i : undefined,
          spellOfLen: spellOf ? n : undefined,
        });
      }
    }
  }

  if (slides.length === 0) {
    return [{ title: '?', line: 'use letters A–Z', kind: 'other' }];
  }
  return slides;
}
