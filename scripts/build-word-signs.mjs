// Compose public/signs/words/{slug}.png from alphabet/numbers PNGs. Run build:signs first.
// Layout favors legibility on the G2 slide size in src/signDimensions.json.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { forceEvenGreenPngBuffer } from './sign-green.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SIGNS_DIR = path.join(ROOT, 'public', 'signs');
const WORDS_DIR = path.join(SIGNS_DIR, 'words');
const SLIDES_TS = path.join(ROOT, 'src', 'signSlides.ts');

const SIGN_DIMS = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'signDimensions.json'), 'utf8'));
const TARGET_W = SIGN_DIMS.SIGN_IMAGE_WIDTH;
const TARGET_H = SIGN_DIMS.SIGN_IMAGE_HEIGHT;
const HSCALE = TARGET_H / 120;
/** Slightly tighter than old 20px so long words keep larger glyphs while staying framed. */
const WORD_STRIP_PAD = Math.round(14 * HSCALE);
const GAP = 4;
const ROW_GAP = 6;

/** Minimum resized letter height (px) — below this, glasses are hard to read. */
function minGlyphHForRows(rowCount) {
  const base = rowCount <= 1 ? 40 : rowCount === 2 ? 28 : rowCount === 3 ? 24 : 22;
  return Math.round(base * HSCALE);
}

/** Prefer more rows for long strings so we do not shrink hands to illegible size. */
function rowCountForGlyphCount(n) {
  if (n <= 5) return 1;
  if (n <= 10) return 2;
  if (n <= 16) return 3;
  return 4;
}

function splitIntoRows(paths, rowCount) {
  if (rowCount <= 1) return [paths];
  const n = paths.length;
  const base = Math.floor(n / rowCount);
  const rem = n % rowCount;
  const rows = [];
  let i = 0;
  for (let r = 0; r < rowCount; r++) {
    const len = base + (r < rem ? 1 : 0);
    if (len === 0) continue;
    rows.push(paths.slice(i, i + len));
    i += len;
  }
  return rows.length > 0 ? rows : [paths];
}

function glyphPath(c) {
  if (c >= '0' && c <= '9') return path.join(SIGNS_DIR, 'numbers', `${c}.png`);
  return path.join(SIGNS_DIR, 'alphabet', `${c}.png`);
}

function resolveGlyphPath(c) {
  const p = glyphPath(c);
  if (fs.existsSync(p)) return p;
  throw new Error(`Missing glyph for "${c}" (${p}) — run "npm run build:signs" first`);
}

function titleToSlug(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseGlossary(ts) {
  const start = ts.indexOf('const WORDS');
  if (start < 0) throw new Error('const WORDS not found in signSlides.ts');
  const end = ts.indexOf('\n};', start);
  if (end < 0) throw new Error('WORDS block end not found');
  const block = ts.slice(start, end);
  const re =
    /\b[a-z]+:\s*\{\s*title:\s*'([^']+)',\s*line:\s*'[^']*'(?:\s*,\s*wordKey:\s*'([^']+)')?\s*\}/g;
  const rows = [];
  let m;
  while ((m = re.exec(block)) !== null) {
    rows.push({ title: m[1], wordKey: m[2] || null });
  }
  if (rows.length === 0) throw new Error('No WORDS entries parsed — check regex vs signSlides.ts');
  return rows;
}

/** slug -> canonical title (for spelling) */
function slugMapFromRows(rows) {
  const map = new Map();
  for (const { title, wordKey } of rows) {
    const slug = wordKey
      ? wordKey
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9-]+/g, '')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
      : titleToSlug(title);
    if (!slug) continue;
    if (!map.has(slug)) map.set(slug, title);
  }
  return map;
}

function lettersForTitle(title) {
  return title
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .split('')
    .filter(Boolean);
}

async function compositeTransparentFrame(innerBuffer) {
  const innerW = TARGET_W - WORD_STRIP_PAD;
  const innerH = TARGET_H - WORD_STRIP_PAD;
  const scaled = await sharp(innerBuffer)
    .resize(innerW, innerH, {
      fit: 'contain',
      kernel: sharp.kernel.lanczos3,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .png()
    .toBuffer();

  const meta = await sharp(scaled).metadata();
  const iw = meta.width ?? 0;
  const ih = meta.height ?? 0;
  const ox = Math.round((TARGET_W - iw) / 2);
  const oy = Math.round((TARGET_H - ih) / 2);

  const borderSvg = `<svg width="${TARGET_W}" height="${TARGET_H}" xmlns="http://www.w3.org/2000/svg">
  <rect x="2" y="2" width="${TARGET_W - 4}" height="${TARGET_H - 4}" fill="none" stroke="#1a5c2e" stroke-width="2" rx="4"/>
</svg>`;

  const frame = await sharp({
    create: {
      width: TARGET_W,
      height: TARGET_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: scaled, left: ox, top: oy },
      { input: Buffer.from(borderSvg), left: 0, top: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();

  return forceEvenGreenPngBuffer(frame);
}

async function layoutRowFromPaths(rowPaths, glyphH) {
  const parts = [];
  for (const p of rowPaths) {
    const buf = await sharp(p).ensureAlpha().png().toBuffer();
    const resized = await sharp(buf)
      .resize({ height: glyphH, kernel: sharp.kernel.lanczos3 })
      .png()
      .toBuffer();
    const m = await sharp(resized).metadata();
    parts.push({ input: resized, w: m.width ?? 1, h: m.height ?? 1 });
  }
  const totalW = parts.reduce((s, p) => s + p.w, 0) + GAP * Math.max(0, parts.length - 1);
  const rowH = Math.max(...parts.map((p) => p.h), 1);
  return { parts, totalW, rowH };
}

async function layoutAllRowPaths(rowArrays, glyphH) {
  const bundles = [];
  for (const rowPaths of rowArrays) {
    bundles.push(await layoutRowFromPaths(rowPaths, glyphH));
  }
  return bundles;
}

async function compositeRowBundlesStacked(rowBundles, rowGap) {
  const canvasW = Math.max(...rowBundles.map((r) => r.totalW), 1);
  let y = 0;
  const composites = [];
  for (let ri = 0; ri < rowBundles.length; ri++) {
    const rb = rowBundles[ri];
    let x = Math.round((canvasW - rb.totalW) / 2);
    for (const p of rb.parts) {
      composites.push({
        input: p.input,
        left: x,
        top: y + Math.round((rb.rowH - p.h) / 2),
      });
      x += p.w + GAP;
    }
    y += rb.rowH;
    if (ri < rowBundles.length - 1) y += rowGap;
  }
  return sharp({
    create: {
      width: canvasW,
      height: y,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

function layoutFits(innerW, innerH, meta) {
  const cw = meta.width ?? 0;
  const ch = meta.height ?? 0;
  return cw <= innerW && ch <= innerH;
}

function maxStartGlyphH(rowCount, innerH) {
  const gapTotal = (rowCount - 1) * ROW_GAP;
  const per = Math.floor((innerH - gapTotal) / rowCount);
  if (rowCount === 1) return Math.min(80, innerH - 4, per + 12);
  return Math.min(52, per + 6);
}

async function composeRawAtGlyphHeight(paths, rowCount, glyphH) {
  const rowArrays = splitIntoRows(paths, rowCount);
  const bundles = await layoutAllRowPaths(rowArrays, glyphH);
  return compositeRowBundlesStacked(bundles, ROW_GAP);
}

/** Largest glyphH in [minH, maxH] that still fits inner box (binary search). */
async function bestGlyphHeightForRows(paths, rowCount, innerW, innerH) {
  const minH = minGlyphHForRows(rowCount);
  let lo = minH;
  let hi = maxStartGlyphH(rowCount, innerH);
  if (hi < lo) hi = lo;
  let best = lo;
  let bestRaw = await composeRawAtGlyphHeight(paths, rowCount, lo);
  let meta = await sharp(bestRaw).metadata();
  if (!layoutFits(innerW, innerH, meta)) {
    return { raw: bestRaw, glyphH: lo, fits: false };
  }
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const raw = await composeRawAtGlyphHeight(paths, rowCount, mid);
    meta = await sharp(raw).metadata();
    if (layoutFits(innerW, innerH, meta)) {
      best = mid;
      bestRaw = raw;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return { raw: bestRaw, glyphH: best, fits: true };
}

async function composeWordStrip(chars) {
  const innerW = TARGET_W - WORD_STRIP_PAD;
  const innerH = TARGET_H - WORD_STRIP_PAD;
  const paths = chars.map((c) => resolveGlyphPath(c));
  const n = paths.length;

  const startRows = rowCountForGlyphCount(n);
  let chosenRaw = null;
  let chosenFits = false;

  for (let rowCount = startRows; rowCount <= 4; rowCount++) {
    const { raw, fits } = await bestGlyphHeightForRows(paths, rowCount, innerW, innerH);
    if (fits) {
      chosenRaw = raw;
      chosenFits = true;
      break;
    }
    chosenRaw = raw;
  }

  let raw = chosenRaw;
  if (!chosenFits && raw) {
    const meta = await sharp(raw).metadata();
    console.warn(
      '[build-word-signs] strip still larger than frame; soft resize (',
      chars.join(''),
      ') ·',
      meta.width,
      '×',
      meta.height,
      '→',
      innerW,
      '×',
      innerH,
    );
    raw = await sharp(raw)
      .resize({
        width: innerW,
        height: innerH,
        fit: 'inside',
        kernel: sharp.kernel.lanczos3,
      })
      .png()
      .toBuffer();
  }

  return compositeTransparentFrame(raw);
}

async function main() {
  const ts = fs.readFileSync(SLIDES_TS, 'utf8');
  const rows = parseGlossary(ts);
  const slugMap = slugMapFromRows(rows);

  fs.mkdirSync(WORDS_DIR, { recursive: true });

  for (const [slug, title] of slugMap) {
    if (slug.length === 0) continue;
    if (title.length === 1 && /^[A-Z0-9]$/i.test(title)) {
      continue;
    }
    if (title === '?') continue;

    const chars = lettersForTitle(title);
    if (chars.length === 0) {
      console.warn('skip (no letters):', slug, title);
      continue;
    }

    const out = await composeWordStrip(chars);
    fs.writeFileSync(path.join(WORDS_DIR, `${slug}.png`), out);
    console.log('wrote', `words/${slug}.png`, `(${chars.join('')})`);
  }

  console.log('Done →', WORDS_DIR);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
