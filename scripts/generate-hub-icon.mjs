/**
 * Even Hub: 24×24 — rounded badge with two-line “EVEN” / “SIGN” + thumbs-up accent.
 * Set USE_BRAND_BW for strict B/W if Hub rejects color.
 * Output: assets/hub-icon-24.png
 */
const USE_BRAND_BW = false;

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'assets');
const outFile = path.join(outDir, 'hub-icon-24.png');

const BG = USE_BRAND_BW ? '#000000' : '#001c00';
const FG = USE_BRAND_BW ? '#ffffff' : '#00d200';
const INK = USE_BRAND_BW ? '#000000' : '#000000';

/** 3×5 pixel glyphs (rows top → bottom). */
const GLYPHS = {
  E: ['111', '100', '111', '100', '111'],
  V: ['101', '101', '101', '010', '010'],
  N: ['110', '101', '101', '101', '101'],
  S: ['111', '100', '111', '001', '111'],
  I: ['010', '010', '010', '010', '010'],
  // G: add the inner connector pixel so it doesn't look broken at 24×24
  G: ['111', '100', '101', '101', '111'],
};

const GW = 3;

function letterRects(rows, ox, oy, cell) {
  const parts = [];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== '1') continue;
      const x = ox + c * cell;
      const y = oy + r * cell;
      parts.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}"/>`);
    }
  }
  return parts.join('\n    ');
}

function wordWidthPx(word, letterGapPx) {
  return word.length * GW + Math.max(0, word.length - 1) * letterGapPx;
}

function wordRects(word, ox, oy, cell, letterGapPx) {
  const parts = [];
  let x = ox;
  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    const g = GLYPHS[ch];
    if (!g) continue;
    parts.push(letterRects(g, x, oy, cell));
    x += GW * cell + (i < word.length - 1 ? letterGapPx : 0);
  }
  return parts.join('\n    ');
}

/** 1px cells: two lines + gap; badge leaves column 18 empty before hand (x≥19). */
const CELL = 1;
const LETTER_GAP = 1;
const LINE_GAP = 1;

const LINE1 = 'EVEN';
const LINE2 = 'SIGN';

const textW = Math.max(wordWidthPx(LINE1, LETTER_GAP), wordWidthPx(LINE2, LETTER_GAP));
const textH = 5 * CELL + LINE_GAP + 5 * CELL;

const BADGE = { x: 1, y: 2, w: 17, h: 20, r: 2 };
const textOx = BADGE.x + Math.floor((BADGE.w - textW) / 2);
const textOy = BADGE.y + Math.floor((BADGE.h - textH) / 2);

const line1 = wordRects(LINE1, textOx, textOy, CELL, LETTER_GAP);
const line2 = wordRects(LINE2, textOx, textOy + 5 * CELL + LINE_GAP, CELL, LETTER_GAP);

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" shape-rendering="crispEdges">
  <rect width="24" height="24" fill="${BG}"/>
  <g fill="${FG}">
    <rect x="${BADGE.x}" y="${BADGE.y}" width="${BADGE.w}" height="${BADGE.h}" rx="${BADGE.r}"/>
    <!-- thumbs-up: separated from badge (badge ends x≤17; hand x≥19) -->
    <rect x="19" y="14" width="5" height="9" rx="1"/>
    <rect x="19" y="11" width="3" height="4" rx="1"/>
    <rect x="20" y="7" width="2" height="5" rx="1"/>
  </g>
  <g fill="${INK}">
    ${line1}
    ${line2}
  </g>
</svg>`;

fs.mkdirSync(outDir, { recursive: true });

const png = await sharp(Buffer.from(svg))
  .resize(24, 24, { kernel: sharp.kernel.nearest })
  .png({ compressionLevel: 9 })
  .toBuffer();

const meta = await sharp(png).metadata();
if (meta.width !== 24 || meta.height !== 24) {
  throw new Error(`Expected 24x24, got ${meta.width}x${meta.height}`);
}

fs.writeFileSync(outFile, png);
console.log(`Wrote ${path.relative(root, outFile)} (${png.length} bytes)`);
