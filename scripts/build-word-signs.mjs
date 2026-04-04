// Compose public/signs/words/{slug}.png from alphabet/numbers PNGs. Run build:signs first.
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

const TARGET_W = 280;
const TARGET_H = 120;
const PAD = 20;
const GAP = 4;
const ROW_GAP = 6;

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
  const innerW = TARGET_W - PAD;
  const innerH = TARGET_H - PAD;
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

function splitRowPaths(paths) {
  if (paths.length <= 5) return [paths];
  const n1 = Math.ceil(paths.length / 2);
  return [paths.slice(0, n1), paths.slice(n1)];
}

async function layoutRowsAtHeight(paths, glyphH) {
  const rows = splitRowPaths(paths);
  const rowBundles = [];
  for (const rowPaths of rows) {
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
    rowBundles.push({ parts, totalW, rowH });
  }
  return rowBundles;
}

async function compositeRowBundles(rowBundles, rowGap) {
  if (rowBundles.length === 1) {
    const { parts, totalW, rowH } = rowBundles[0];
    const composites = [];
    let x = 0;
    for (const p of parts) {
      composites.push({ input: p.input, left: x, top: Math.round((rowH - p.h) / 2) });
      x += p.w + GAP;
    }
    return sharp({
      create: {
        width: totalW,
        height: rowH,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(composites)
      .png()
      .toBuffer();
  }

  const r0 = rowBundles[0];
  const r1 = rowBundles[1];
  const canvasW = Math.max(r0.totalW, r1.totalW);
  const canvasH = r0.rowH + rowGap + r1.rowH;
  const composites = [];

  let x0 = Math.round((canvasW - r0.totalW) / 2);
  for (const p of r0.parts) {
    composites.push({ input: p.input, left: x0, top: Math.round((r0.rowH - p.h) / 2) });
    x0 += p.w + GAP;
  }

  let x1 = Math.round((canvasW - r1.totalW) / 2);
  for (const p of r1.parts) {
    composites.push({
      input: p.input,
      left: x1,
      top: r0.rowH + rowGap + Math.round((r1.rowH - p.h) / 2),
    });
    x1 += p.w + GAP;
  }

  return sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

async function composeWordStrip(chars) {
  const innerW = TARGET_W - PAD;
  const innerH = TARGET_H - PAD;
  const paths = chars.map((c) => resolveGlyphPath(c));

  const twoRows = paths.length > 5;
  let glyphH = twoRows ? 34 : 72;
  let raw = await compositeRowBundles(await layoutRowsAtHeight(paths, glyphH), ROW_GAP);

  for (let attempt = 0; attempt < 14; attempt++) {
    const meta = await sharp(raw).metadata();
    const cw = meta.width ?? 0;
    const ch = meta.height ?? 0;
    if (cw <= innerW && ch <= innerH) break;
    const next = Math.max(twoRows ? 16 : 24, Math.floor(glyphH * 0.88));
    if (next >= glyphH) {
      raw = await sharp(raw)
        .resize({
          width: innerW,
          height: innerH,
          fit: 'inside',
          kernel: sharp.kernel.lanczos3,
        })
        .png()
        .toBuffer();
      break;
    }
    glyphH = next;
    raw = await compositeRowBundles(await layoutRowsAtHeight(paths, glyphH), ROW_GAP);
  }

  const meta2 = await sharp(raw).metadata();
  const cw2 = meta2.width ?? 0;
  const ch2 = meta2.height ?? 0;
  if (cw2 > innerW || ch2 > innerH) {
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
