import wordSignManifest from './wordSignManifest.json';

/**
 * In-memory copy of every packaged sign PNG (alphabet, numbers, glossary words).
 * Hub packages cannot execute at OS install time; we warm this on first page load so slide
 * rendering avoids per-slide fetch latency and the browser cache stays hot.
 */
const warmedBytes = new Map<string, Uint8Array>();

let warmFinished = false;

function signPublicUrl(relativePath: string): string {
  return `${import.meta.env.BASE_URL}${relativePath}`;
}

function storeIfOk(key: string, u8: Uint8Array): void {
  if (u8.length > 0) warmedBytes.set(key, u8);
}

/** Single-letter / digit slides use `glyph:{char}` (matches `glyphAssetUrl` layout). */
export function warmedGlyphPng(char: string): Uint8Array | null {
  const u = warmedBytes.get(`glyph:${char}`);
  return u && u.length > 0 ? u : null;
}

/** Whole-word art: `word:{slug}` */
export function warmedWordPng(slug: string): Uint8Array | null {
  const u = warmedBytes.get(`word:${slug}`);
  return u && u.length > 0 ? u : null;
}

let warmInFlight: Promise<void> | null = null;

/**
 * Fetches all packaged sign assets in parallel (best-effort). Safe to call once at startup.
 * Does not throw — missing files are skipped (e.g. dev without `public/signs`).
 */
export async function warmSignAssetCache(): Promise<void> {
  if (warmFinished) return;
  if (!warmInFlight) {
    warmInFlight = (async () => {
      const fetches: Promise<void>[] = [];

      for (let c = 65; c <= 90; c++) {
        const ch = String.fromCharCode(c);
        const path = `signs/alphabet/${ch}.png`;
        const key = `glyph:${ch}`;
        fetches.push(
          (async () => {
            try {
              const res = await fetch(signPublicUrl(path), { cache: 'force-cache' });
              if (!res.ok) return;
              const buf = new Uint8Array(await res.arrayBuffer());
              storeIfOk(key, buf);
            } catch {
              /* offline / missing in dev */
            }
          })(),
        );
      }

      for (const d of '0123456789') {
        const path = `signs/numbers/${d}.png`;
        const key = `glyph:${d}`;
        fetches.push(
          (async () => {
            try {
              const res = await fetch(signPublicUrl(path), { cache: 'force-cache' });
              if (!res.ok) return;
              const buf = new Uint8Array(await res.arrayBuffer());
              storeIfOk(key, buf);
            } catch {
              /* ignore */
            }
          })(),
        );
      }

      for (const slug of wordSignManifest.slugs) {
        const path = `signs/words/${slug}.png`;
        const key = `word:${slug}`;
        fetches.push(
          (async () => {
            try {
              const res = await fetch(signPublicUrl(path), { cache: 'force-cache' });
              if (!res.ok) return;
              const buf = new Uint8Array(await res.arrayBuffer());
              storeIfOk(key, buf);
            } catch {
              /* ignore */
            }
          })(),
        );
      }

      await Promise.all(fetches);
      warmFinished = true;
    })();
  }
  await warmInFlight;
}
