/**
 * Hub insert chips + G2 **Phrases** menu: categories (A–Z) → words (A–Z per category).
 * Row labels on glasses stay short (≤12 chars, enforced in `assertPhraseSnippetData`);
 * `phrase` is what we pass to `phraseToSlides`.
 */

export type PhraseSnippet = {
  /** List row on G2 (unique within its category). */
  label: string;
  /** G2 word list row when `label` is long for the narrow column; hub chips still use `label`. */
  glassesRowLabel?: string;
  /** Text inserted / sent to gloss. */
  phrase: string;
};

export type PhraseSnippetCategory = {
  /** Stable id (logs / tests); not shown on G2 list. */
  id: string;
  /** Shown on glasses category list; unique across categories; sorted A–Z with other titles. */
  title: string;
  /** If true, omit this category from all UI lists (glasses + hub quick chips). */
  hidden?: boolean;
  /**
   * G2 phrase picker row (~100px wide). Omit to use `title`. When set, must stay unique among
   * all picker rows and short enough to render fully on the list.
   */
  glassesRowLabel?: string;
  snippets: PhraseSnippet[];
};

/** Row string on the G2 word list (may differ from hub chip `label`). */
export function phraseSnippetGlassesRowLabel(s: PhraseSnippet): string {
  return s.glassesRowLabel ?? s.label;
}

function sortSnippets(s: PhraseSnippet[]): PhraseSnippet[] {
  return [...s].sort((a, b) => a.label.localeCompare(b.label, 'en'));
}

function sortCategories(c: PhraseSnippetCategory[]): PhraseSnippetCategory[] {
  return [...c]
    .map((cat) => ({ ...cat, snippets: sortSnippets(cat.snippets) }))
    .sort((a, b) => a.title.localeCompare(b.title, 'en'));
}

/** Source rows (order ignored — exported categories are sorted). */
const PHRASE_SNIPPET_CATEGORIES_RAW: PhraseSnippetCategory[] = [
  {
    id: 'basics',
    title: 'Basics',
    hidden: true,
    snippets: [
      { label: 'again', phrase: 'again' },
      { label: 'bad', phrase: 'bad' },
      { label: 'bye', phrase: 'goodbye' },
      { label: 'fine', phrase: 'fine' },
      { label: 'good', phrase: 'good' },
      { label: 'hello', phrase: 'hello' },
      { label: 'hey', phrase: 'hey' },
      { label: 'hi', phrase: 'hi' },
      { label: 'maybe', phrase: 'maybe' },
      { label: 'no', phrase: 'no' },
      { label: 'ok', phrase: 'ok' },
      { label: 'please', phrase: 'please' },
      { label: 'sorry', phrase: 'sorry' },
      { label: 'stop', phrase: 'stop' },
      { label: 'thanks', phrase: 'thank you' },
      { label: 'wait', phrase: 'wait' },
      { label: 'yes', phrase: 'yes' },
    ],
  },
  {
    id: 'directions',
    title: 'Directions',
    glassesRowLabel: 'Travel',
    snippets: [
      { label: 'airport', phrase: 'airport' },
      { label: 'bus', phrase: 'bus' },
      { label: 'car', phrase: 'car' },
      { label: 'elevator', glassesRowLabel: 'Lift', phrase: 'elevator' },
      { label: 'here', phrase: 'here' },
      { label: 'hotel', phrase: 'hotel' },
      { label: 'left', phrase: 'left' },
      { label: 'lost', phrase: 'lost' },
      { label: 'map', phrase: 'map' },
      { label: 'right', phrase: 'right' },
      { label: 'straight', phrase: 'straight' },
      { label: 'taxi', phrase: 'taxi' },
      { label: 'there', phrase: 'there' },
      { label: 'train', phrase: 'train' },
      { label: 'walk', phrase: 'walk' },
    ],
  },
  {
    id: 'feelings',
    title: 'Feelings',
    glassesRowLabel: 'Mood',
    snippets: [
      { label: 'afraid', phrase: 'afraid' },
      { label: 'angry', phrase: 'angry' },
      { label: 'anxious', phrase: 'anxious' },
      { label: 'calm', phrase: 'calm' },
      { label: 'excited', phrase: 'excited' },
      { label: 'frustrated', glassesRowLabel: 'Annoyed', phrase: 'frustrated' },
      { label: 'happy', phrase: 'happy' },
      { label: 'love', phrase: 'love' },
      { label: 'nervous', phrase: 'nervous' },
      { label: 'sad', phrase: 'sad' },
      { label: 'scared', phrase: 'scared' },
      { label: 'tired', phrase: 'tired' },
      { label: 'worried', phrase: 'worried' },
    ],
  },
  {
    id: 'food',
    title: 'Food',
    snippets: [
      { label: 'breakfast', glassesRowLabel: 'Bfast', phrase: 'breakfast' },
      { label: 'coffee', phrase: 'coffee' },
      { label: 'dinner', phrase: 'dinner' },
      { label: 'drink', phrase: 'drink' },
      { label: 'eat', phrase: 'eat' },
      { label: 'food', phrase: 'food' },
      { label: 'hungry', phrase: 'hungry' },
      { label: 'lunch', phrase: 'lunch' },
      { label: 'milk', phrase: 'milk' },
      { label: 'restaurant', glassesRowLabel: 'Eatery', phrase: 'restaurant' },
      { label: 'thirsty', phrase: 'thirsty' },
      { label: 'water', phrase: 'water' },
    ],
  },
  {
    id: 'health',
    title: 'Health',
    snippets: [
      { label: 'allergy', phrase: 'allergy' },
      { label: 'ambulance', glassesRowLabel: 'EMS', phrase: 'ambulance' },
      { label: 'appointment', glassesRowLabel: 'Appt', phrase: 'appointment' },
      { label: 'cold', phrase: 'cold' },
      { label: 'cough', phrase: 'cough' },
      { label: 'doctor', phrase: 'doctor' },
      { label: 'emergency', glassesRowLabel: 'Urgent', phrase: 'emergency' },
      { label: 'fever', phrase: 'fever' },
      { label: 'headache', phrase: 'headache' },
      { label: 'hospital', phrase: 'hospital' },
      { label: 'hurt', phrase: 'hurt' },
      { label: 'medicine', glassesRowLabel: 'Meds', phrase: 'medicine' },
      { label: 'pain', phrase: 'pain' },
      { label: 'sick', phrase: 'sick' },
    ],
  },
  {
    id: 'home',
    title: 'Home',
    snippets: [
      { label: 'bathroom', phrase: 'bathroom' },
      { label: 'bedroom', phrase: 'bedroom' },
      { label: 'door', phrase: 'door' },
      { label: 'home', phrase: 'home' },
      { label: 'inside', phrase: 'inside' },
      { label: 'keys', phrase: 'keys' },
      { label: 'kitchen', phrase: 'kitchen' },
      { label: 'light', phrase: 'light' },
      { label: 'outside', phrase: 'outside' },
      { label: 'room', phrase: 'room' },
      { label: 'sleep', phrase: 'sleep' },
      { label: 'stay', phrase: 'stay' },
    ],
  },
  {
    id: 'questions',
    title: 'Questions',
    glassesRowLabel: 'Ask',
    snippets: [
      { label: 'how', phrase: 'how' },
      { label: 'how much', glassesRowLabel: 'Amount', phrase: 'how much' },
      { label: 'what', phrase: 'what' },
      { label: 'when', phrase: 'when' },
      { label: 'where', phrase: 'where' },
      { label: 'which', phrase: 'which' },
      { label: 'who', phrase: 'who' },
      { label: 'why', phrase: 'why' },
    ],
  },
  {
    id: 'social',
    title: 'Social',
    snippets: [
      { label: 'deaf', phrase: 'deaf' },
      { label: 'family', phrase: 'family' },
      { label: 'friend', phrase: 'friend' },
      { label: 'hearing', phrase: 'hearing' },
      { label: 'meet', phrase: 'meet' },
      { label: 'my name', glassesRowLabel: 'Intro', phrase: 'my name is' },
      { label: 'name', phrase: 'name' },
      { label: 'nice meet', glassesRowLabel: 'Greet', phrase: 'nice to meet you' },
      { label: 'sign', phrase: 'sign' },
      { label: 'you', phrase: 'you' },
    ],
  },
  {
    id: 'time',
    title: 'Time',
    snippets: [
      { label: 'afternoon', glassesRowLabel: 'Midday', phrase: 'afternoon' },
      { label: 'evening', phrase: 'evening' },
      { label: 'later', phrase: 'later' },
      { label: 'morning', phrase: 'morning' },
      { label: 'night', phrase: 'night' },
      { label: 'noon', phrase: 'noon' },
      { label: 'now', phrase: 'now' },
      { label: 'today', phrase: 'today' },
      { label: 'tomorrow', phrase: 'tomorrow' },
      { label: 'yesterday', phrase: 'yesterday' },
    ],
  },
  {
    id: 'work',
    title: 'Work',
    snippets: [
      { label: 'busy', phrase: 'busy' },
      { label: 'call', phrase: 'call' },
      { label: 'computer', glassesRowLabel: 'PC', phrase: 'computer' },
      { label: 'email', phrase: 'email' },
      { label: 'free', phrase: 'free' },
      { label: 'help', phrase: 'help' },
      { label: 'learn', phrase: 'learn' },
      { label: 'meeting', phrase: 'meeting' },
      { label: 'phone', phrase: 'phone' },
      { label: 'schedule', glassesRowLabel: 'Plan', phrase: 'schedule' },
      { label: 'slow', phrase: 'slow' },
      { label: 'text', phrase: 'text' },
      { label: 'understand', glassesRowLabel: 'Got it', phrase: 'understand' },
      { label: 'wifi', phrase: 'wifi' },
      { label: 'work', phrase: 'work' },
    ],
  },
];

export const PHRASE_SNIPPET_CATEGORIES: PhraseSnippetCategory[] = sortCategories(
  PHRASE_SNIPPET_CATEGORIES_RAW.filter((c) => c.hidden !== true),
);

const RESERVED_LABELS = new Set(['Back', 'Up']);

function assertPhraseSnippetData(): void {
  const titles = PHRASE_SNIPPET_CATEGORIES.map((c) => c.title);
  if (new Set(titles).size !== titles.length) {
    throw new Error('phraseSnippets: duplicate category title');
  }
  const pickerLabels = PHRASE_SNIPPET_CATEGORIES.map((c) => c.glassesRowLabel ?? c.title);
  if (new Set(pickerLabels).size !== pickerLabels.length) {
    throw new Error('phraseSnippets: duplicate category glasses row / picker label');
  }
  let n = 0;
  for (const c of PHRASE_SNIPPET_CATEGORIES) {
    const labels = c.snippets.map((s) => s.label);
    if (new Set(labels).size !== labels.length) {
      throw new Error(`phraseSnippets: duplicate label in category ${c.title}`);
    }
    const glassRows = c.snippets.map((s) => phraseSnippetGlassesRowLabel(s));
    if (new Set(glassRows).size !== glassRows.length) {
      throw new Error(`phraseSnippets: duplicate glasses row in category ${c.title}`);
    }
    for (const s of c.snippets) {
      if (RESERVED_LABELS.has(s.label)) {
        throw new Error(`phraseSnippets: reserved label ${s.label}`);
      }
      if (!s.phrase.trim()) throw new Error(`phraseSnippets: empty phrase for ${s.label}`);
    }
    const sorted = [...labels].sort((a, b) => a.localeCompare(b, 'en'));
    if (!labels.every((l, i) => l === sorted[i])) {
      throw new Error(`phraseSnippets: snippets not sorted A–Z in ${c.title}`);
    }
    n += c.snippets.length;
  }
  const sortedTitles = [...titles].sort((a, b) => a.localeCompare(b, 'en'));
  if (!titles.every((t, i) => t === sortedTitles[i])) {
    throw new Error('phraseSnippets: categories not sorted A–Z');
  }
  if (n < 100) {
    throw new Error(`phraseSnippets: expected at least 100 snippets, got ${n}`);
  }
  const maxWordRows = Math.max(...PHRASE_SNIPPET_CATEGORIES.map((c) => c.snippets.length), 0);
  const categoryRows = PHRASE_SNIPPET_CATEGORIES.length;
  if (maxWordRows > 20 || categoryRows > 20) {
    throw new Error('phraseSnippets: G2 list supports at most 20 rows per list (see Hub list docs)');
  }
  const maxRowLen = 12;
  for (const c of PHRASE_SNIPPET_CATEGORIES) {
    const prow = phraseCategoryPickerRowLabel(c);
    if (prow.length > maxRowLen) {
      throw new Error(`phraseSnippets: category glasses row too long (${prow.length}): ${prow}`);
    }
    for (const s of c.snippets) {
      const row = phraseSnippetGlassesRowLabel(s);
      if (row.length > maxRowLen) {
        throw new Error(`phraseSnippets: snippet row too long in ${c.title} (${row.length}): ${row}`);
      }
    }
  }
}

assertPhraseSnippetData();

export const PHRASE_SNIPPET_COUNT = PHRASE_SNIPPET_CATEGORIES.reduce((a, c) => a + c.snippets.length, 0);

/** Longest glasses list when browsing words in one category (no separate nav rows — double-tap goes up). */
export const PHRASE_GLASSES_MAX_LIST_ITEMS = Math.max(
  ...PHRASE_SNIPPET_CATEGORIES.map((c) => c.snippets.length),
);

/** Category picker row count (every row opens that topic; double-tap returns to main nav). */
export const PHRASE_GLASSES_CATEGORY_LIST_ITEMS = PHRASE_SNIPPET_CATEGORIES.length;

export function getPhraseCategoryTitles(): readonly string[] {
  return PHRASE_SNIPPET_CATEGORIES.map((c) => c.title);
}

/** Row text on the G2 Phrases category list (short labels on a narrow column). */
export function phraseCategoryPickerRowLabel(cat: PhraseSnippetCategory): string {
  return cat.glassesRowLabel ?? cat.title;
}

export function getPhraseCategoryPickerRowLabels(): readonly string[] {
  return PHRASE_SNIPPET_CATEGORIES.map(phraseCategoryPickerRowLabel);
}

export function findPhraseCategoryByPickerRowLabel(label: string): PhraseSnippetCategory | undefined {
  const t = label.trim();
  const pick = (c: PhraseSnippetCategory) => phraseCategoryPickerRowLabel(c);
  const exact = PHRASE_SNIPPET_CATEGORIES.find((c) => pick(c) === t);
  if (exact) return exact;
  const tl = t.toLowerCase();
  return PHRASE_SNIPPET_CATEGORIES.find((c) => pick(c).toLowerCase() === tl);
}

export function findPhraseCategoryByTitle(title: string): PhraseSnippetCategory | undefined {
  return PHRASE_SNIPPET_CATEGORIES.find((c) => c.title === title);
}

export function findSnippetInCategory(
  categoryTitle: string,
  label: string,
): PhraseSnippet | undefined {
  const cat = findPhraseCategoryByTitle(categoryTitle);
  if (!cat) return undefined;
  const t = label.trim();
  const tl = t.toLowerCase();
  return cat.snippets.find((s) => {
    const row = phraseSnippetGlassesRowLabel(s);
    return row === t || s.label === t || row.toLowerCase() === tl || s.label.toLowerCase() === tl;
  });
}
