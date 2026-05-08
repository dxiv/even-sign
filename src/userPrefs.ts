export type RecentEntry = {
  phrase: string;
  at: number;
};

export type UserPrefs = {
  favorites: string[];
  recents: RecentEntry[];
};

const LS_KEY = 'gloss_user_prefs_v1';
const MAX_RECENTS = 12;
const MAX_FAVORITES = 32;

function nowMs(): number {
  return Date.now();
}

function normalizePhrase(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

function uniqKeepOrder(xs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of xs) {
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}

function safeParse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function coercePrefs(o: unknown): UserPrefs {
  const rec = o && typeof o === 'object' ? (o as Record<string, unknown>) : {};
  const favRaw = Array.isArray(rec.favorites) ? rec.favorites : [];
  const favorites = uniqKeepOrder(
    favRaw
      .filter((s) => typeof s === 'string')
      .map((s) => normalizePhrase(s))
      .filter(Boolean),
  ).slice(0, MAX_FAVORITES);

  const recRaw = Array.isArray(rec.recents) ? rec.recents : [];
  const recents = recRaw
    .map((r) => (r && typeof r === 'object' ? (r as Record<string, unknown>) : null))
    .filter(Boolean)
    .map((r) => {
      const phrase = typeof r!.phrase === 'string' ? normalizePhrase(r!.phrase) : '';
      const at = typeof r!.at === 'number' && Number.isFinite(r!.at) ? r!.at : 0;
      return { phrase, at } satisfies RecentEntry;
    })
    .filter((r) => r.phrase.length > 0)
    .sort((a, b) => b.at - a.at);

  // De-dupe recents by phrase (keep newest).
  const seen = new Set<string>();
  const deduped: RecentEntry[] = [];
  for (const r of recents) {
    if (seen.has(r.phrase)) continue;
    seen.add(r.phrase);
    deduped.push(r);
    if (deduped.length >= MAX_RECENTS) break;
  }

  return { favorites, recents: deduped };
}

export function loadUserPrefs(): UserPrefs {
  const ls =
    typeof localStorage !== 'undefined' && localStorage
      ? localStorage
      : null;
  const parsed = safeParse(ls?.getItem(LS_KEY) ?? null);
  return coercePrefs(parsed);
}

export function saveUserPrefs(prefs: UserPrefs): void {
  try {
    if (typeof localStorage === 'undefined' || !localStorage) return;
    localStorage.setItem(LS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

export function isFavorite(prefs: UserPrefs, phrase: string): boolean {
  const p = normalizePhrase(phrase);
  if (!p) return false;
  return prefs.favorites.includes(p);
}

export function toggleFavorite(prefs: UserPrefs, phrase: string): UserPrefs {
  const p = normalizePhrase(phrase);
  if (!p) return prefs;
  const nextFavs = prefs.favorites.includes(p)
    ? prefs.favorites.filter((x) => x !== p)
    : uniqKeepOrder([p, ...prefs.favorites]).slice(0, MAX_FAVORITES);
  const next: UserPrefs = { ...prefs, favorites: nextFavs };
  saveUserPrefs(next);
  return next;
}

export function addRecent(prefs: UserPrefs, phrase: string, at = nowMs()): UserPrefs {
  const p = normalizePhrase(phrase);
  if (!p) return prefs;
  const nextRecents = [{ phrase: p, at }, ...prefs.recents.filter((r) => r.phrase !== p)].slice(0, MAX_RECENTS);
  const next: UserPrefs = { ...prefs, recents: nextRecents };
  saveUserPrefs(next);
  return next;
}

export function clearRecents(prefs: UserPrefs): UserPrefs {
  const next: UserPrefs = { ...prefs, recents: [] };
  saveUserPrefs(next);
  return next;
}

