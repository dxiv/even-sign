// Gallaudet alphabet SVG → public/signs/alphabet|numbers/*.png (280×120, green channel). Needs scripts/tmp-alphabet.svg.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { forceEvenGreenPngBuffer } from './sign-green.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SVG_PATH = path.join(ROOT, 'scripts', 'tmp-alphabet.svg');
const OUT_DIR = path.join(ROOT, 'public', 'signs');
const OUT_ALPHA = path.join(OUT_DIR, 'alphabet');
const OUT_NUM = path.join(OUT_DIR, 'numbers');

const TARGET_W = 280;
const TARGET_H = 120;
const RENDER_WIDTH = 3200;
const VB_W = 210;
const VB_H = 297;
const SCALE = RENDER_WIDTH / VB_W;

// Crop in root viewBox units (~one chart cell); label sits near bottom of box
const CROP_UW = 34;
const CROP_UH = 62;
const LABEL_BELOW_BASELINE = 5;

const IDENTITY = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

function parseMatrixFromGroup(chunk) {
  const m = chunk.match(
    /transform="matrix\s*\(\s*([0-9.-]+)\s*,\s*([0-9.-]+)\s*,\s*([0-9.-]+)\s*,\s*([0-9.-]+)\s*,\s*([0-9.-]+)\s*,\s*([0-9.-]+)\s*\)"/,
  );
  if (!m) return { ...IDENTITY };
  return {
    a: parseFloat(m[1]),
    b: parseFloat(m[2]),
    c: parseFloat(m[3]),
    d: parseFloat(m[4]),
    e: parseFloat(m[5]),
    f: parseFloat(m[6]),
  };
}

function applyMatrix(M, x, y) {
  return {
    x: M.a * x + M.c * y + M.e,
    y: M.b * x + M.d * y + M.f,
  };
}

function parseGlyphPlacements(svg) {
  const groups = svg.split(/(?=<g\s)/g).filter((chunk) => /id="g5\d+"/.test(chunk));
  const byChar = new Map();

  for (const g of groups) {
    const letter =
      g.match(/>([a-z0-9])<tspan[^>]*\/?>[\s\n]*<\/tspan><\/text>/i) ||
      g.match(/>([a-z0-9])<tspan/i) ||
      g.match(/>([a-z0-9])<\/tspan><\/tspan><\/text>/i) ||
      g.match(/>([a-z0-9])<\/tspan><\/text>/i);
    if (!letter) continue;

    const tx = g.match(/<text[^>]*\sx="([0-9.-]+)"/) || g.match(/\sx="([0-9.-]+)"[^>]*>\s*<tspan/);
    const ty = g.match(/<text[^>]*\sy="([0-9.-]+)"/);
    if (!tx || !ty) continue;

    const ch = letter[1].toUpperCase();
    const lx = parseFloat(tx[1]);
    const ly = parseFloat(ty[1]);
    const M = parseMatrixFromGroup(g);
    const { x, y } = applyMatrix(M, lx, ly);
    byChar.set(ch, { x, y });
  }
  return byChar;
}

function userCropRect(x, y) {
  const bottom = y + LABEL_BELOW_BASELINE;
  const top = bottom - CROP_UH;
  const left = x - CROP_UW / 2;
  const right = left + CROP_UW;

  const cl = Math.max(0, left);
  const cr = Math.min(VB_W, right);
  const ct = Math.max(0, top);
  const cb = Math.min(VB_H, bottom);

  const wu = cr - cl;
  const hu = cb - ct;
  return { cl, ct, wu, hu };
}

function toPixels(rect) {
  return {
    left: Math.round(rect.cl * SCALE),
    top: Math.round(rect.ct * SCALE),
    width: Math.max(1, Math.round(rect.wu * SCALE)),
    height: Math.max(1, Math.round(rect.hu * SCALE)),
  };
}

function clampExtract(box, imgW, imgH) {
  let { left, top, width, height } = box;
  left = Math.max(0, Math.min(left, imgW - 1));
  top = Math.max(0, Math.min(top, imgH - 1));
  width = Math.min(width, imgW - left);
  height = Math.min(height, imgH - top);
  return { left, top, width, height };
}

async function keyWhiteTransparent(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = new Uint8ClampedArray(data);
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const minc = Math.min(r, g, b);
    const maxc = Math.max(r, g, b);
    if (maxc < 18) continue;
    if (minc > 232 && maxc <= 255) {
      const t = (minc - 232) / 23;
      px[i + 3] = Math.round(px[i + 3] * (1 - t));
    } else if (r > 245 && g > 245 && b > 245) {
      px[i + 3] = 0;
    }
  }
  return sharp(px, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
}

async function compositeTransparentCanvas(signBuffer) {
  const pad = 20;
  const scaled = await sharp(signBuffer)
    .resize(TARGET_W - pad, TARGET_H - pad, {
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

  return sharp({
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
}

async function main() {
  if (!fs.existsSync(SVG_PATH)) {
    console.error('Missing', SVG_PATH);
    console.error('Download: https://upload.wikimedia.org/wikipedia/commons/c/c8/Asl_alphabet_gallaudet.svg');
    process.exit(1);
  }

  const svg = fs.readFileSync(SVG_PATH, 'utf8');
  const placements = parseGlyphPlacements(svg);

  const raster = await sharp(SVG_PATH, { density: 300 })
    .resize({ width: RENDER_WIDTH })
    .png()
    .toBuffer();

  const fullMeta = await sharp(raster).metadata();
  const imgW = fullMeta.width ?? RENDER_WIDTH;
  const imgH = fullMeta.height ?? Math.round(RENDER_WIDTH * (VB_H / VB_W));

  fs.mkdirSync(OUT_ALPHA, { recursive: true });
  fs.mkdirSync(OUT_NUM, { recursive: true });

  const needed = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'];

  for (const ch of needed) {
    const p = placements.get(ch);
    if (!p) {
      console.warn('skip (not in SVG):', ch);
      continue;
    }

    const u = userCropRect(p.x, p.y);
    if (u.wu < 4 || u.hu < 4) {
      console.warn('skip (degenerate crop):', ch);
      continue;
    }

    const box = clampExtract(toPixels(u), imgW, imgH);
    let tile = await sharp(raster).extract(box).png().toBuffer();

    tile = await keyWhiteTransparent(tile);
    let out = await compositeTransparentCanvas(tile);
    out = await forceEvenGreenPngBuffer(out);
    const sub = ch >= '0' && ch <= '9' ? OUT_NUM : OUT_ALPHA;
    fs.writeFileSync(path.join(sub, `${ch}.png`), out);
    console.log('wrote', path.relative(ROOT, path.join(sub, `${ch}.png`)));
  }

  console.log('Done →', OUT_ALPHA, '&', OUT_NUM);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
