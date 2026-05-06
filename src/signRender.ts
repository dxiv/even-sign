import { wordAssetSlug, type SignSlide } from './signSlides';
import { SIGN_IMAGE_HEIGHT, SIGN_IMAGE_WIDTH } from './signConstants';

export { SIGN_IMAGE_HEIGHT, SIGN_IMAGE_WIDTH };

const SINGLE_GLYPH = /^[A-Z0-9]$/;

/** Learning bar height scales slightly with slide height (G2-safe greens). */
const BAR_H = Math.round(14 * (SIGN_IMAGE_HEIGHT / 120));
const BAR_PAD_X = 5;

export type SlideToPngOptions = {
  /** Letter / word captions on the slide (G2-safe green). Off = full sign area for the hand only. */
  showCaptions?: boolean;
  /**
   * Optional 1px inset stroke inside the slide PNG (under hand art, above flatten).
   * Default off — 4‑bit panels can show banding; verify on hardware before enabling in product UI.
   */
  lensInsetFrame?: boolean;
};

/** Match `scripts/sign-green.mjs`: R/B → 0, G ← luminance (safe for G2). */
function flattenToEvenGreen(imageData: ImageData): void {
  const px = imageData.data;
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3];
    if (a < 4) {
      px[i] = 0;
      px[i + 1] = 0;
      px[i + 2] = 0;
      px[i + 3] = 0;
      continue;
    }
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const L = Math.min(255, Math.round(0.299 * r + 0.587 * g + 0.114 * b));
    px[i] = 0;
    px[i + 1] = L;
    px[i + 2] = 0;
  }
}

function badgeCaption(slide: SignSlide): string {
  switch (slide.kind) {
    case 'word': {
      const gloss = slide.title.replace(/\s+/g, ' ').slice(0, 16);
      if (slide.wordToken) {
        const tok = slide.wordToken.replace(/\s+/g, ' ').slice(0, 10);
        return `WORD  ${tok} · ${gloss}`;
      }
      return `WORD  ${gloss}`;
    }
    case 'letter': {
      const t = slide.title;
      if (slide.spellOf && slide.spellIndex && slide.spellOfLen) {
        return `SPELL  ${slide.spellOf}  ${slide.spellIndex}/${slide.spellOfLen}  ${t}`;
      }
      return `LETTER  ${t}`;
    }
    case 'digit': {
      const t = slide.title;
      if (slide.spellOf && slide.spellIndex && slide.spellOfLen) {
        return `NUM  ${slide.spellOf}  ${slide.spellIndex}/${slide.spellOfLen}  ${t}`;
      }
      return `NUMBER  ${t}`;
    }
    case 'placeholder':
      return 'GLOSS';
    case 'other':
      return slide.title.slice(0, 24);
    default:
      return slide.title;
  }
}

function drawLearningBar(c: CanvasRenderingContext2D, w: number, h: number, slide: SignSlide): void {
  const y0 = h - BAR_H;
  c.fillStyle = 'rgb(0,28,0)';
  c.fillRect(0, y0, w, BAR_H);
  c.fillStyle = 'rgb(0,210,0)';
  c.font = '600 9px JetBrains Mono, ui-monospace, monospace';
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  let cap = badgeCaption(slide);
  const maxW = w - BAR_PAD_X * 2;
  while (cap.length > 3 && c.measureText(cap).width > maxW) {
    cap = cap.slice(0, -2) + '…';
  }
  c.fillText(cap, BAR_PAD_X, y0 + BAR_H / 2);
}

export function glyphAssetUrl(char: string): string {
  if (char >= '0' && char <= '9') {
    return `/signs/numbers/${char}.png`;
  }
  return `/signs/alphabet/${char}.png`;
}

async function pngFromSignAsset(title: string): Promise<Uint8Array | null> {
  if (!SINGLE_GLYPH.test(title)) {
    return null;
  }
  try {
    const res = await fetch(glyphAssetUrl(title), { cache: 'force-cache' });
    if (!res.ok) {
      return null;
    }
    const buf = await res.arrayBuffer();
    const u8 = new Uint8Array(buf);
    return u8.length > 0 ? u8 : null;
  } catch {
    return null;
  }
}

function tokenToWordAssetSlug(token: string): string | null {
  const s = token
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s.length > 0 ? s : null;
}

/** Try primary slug, then `wordToken` / `wordKey` forms so word art still loads if one path mismatches the file name. */
async function pngFromWordAsset(slide: SignSlide): Promise<Uint8Array | null> {
  const slugs: string[] = [];
  const add = (s: string | null | undefined) => {
    if (!s) return;
    if (!slugs.includes(s)) slugs.push(s);
  };
  add(wordAssetSlug(slide));
  if (slide.wordToken) add(tokenToWordAssetSlug(slide.wordToken));
  if (slide.wordKey) {
    add(
      slide.wordKey
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]+/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, ''),
    );
  }
  for (const slug of slugs) {
    if (!slug) continue;
    try {
      const res = await fetch(`/signs/words/${slug}.png`, { cache: 'force-cache' });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      const u8 = new Uint8Array(buf);
      if (u8.length > 0) return u8;
    } catch {
      /* try next slug */
    }
  }
  return null;
}

async function bitmapFromPngBytes(u8: Uint8Array): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(new Blob([u8], { type: 'image/png' }));
  } catch {
    return null;
  }
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(new Uint8Array());
          return;
        }
        void blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf))).catch(() => resolve(new Uint8Array()));
      },
      'image/png',
      0.92,
    );
  });
}

/** Composite asset (or fallback art), optional learning bar, then G2 green flatten. */
async function finalizeSlideCanvas(
  slide: SignSlide,
  draw: (c: CanvasRenderingContext2D, w: number, h: number, contentH: number) => void,
  showCaptions: boolean,
  lensInsetFrame: boolean,
): Promise<Uint8Array> {
  const w = SIGN_IMAGE_WIDTH;
  const h = SIGN_IMAGE_HEIGHT;
  const contentH = showCaptions ? h - BAR_H : h;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d');
  if (!c) {
    return new Uint8Array();
  }
  c.clearRect(0, 0, w, h);
  if (lensInsetFrame && contentH > 4) {
    c.strokeStyle = 'rgb(0, 72, 0)';
    c.lineWidth = 1;
    c.strokeRect(1.5, 1.5, w - 3, contentH - 3);
  }
  draw(c, w, h, contentH);
  if (showCaptions) {
    drawLearningBar(c, w, h, slide);
  }
  const id = c.getImageData(0, 0, w, h);
  flattenToEvenGreen(id);
  c.putImageData(id, 0, 0);
  return canvasToPngBytes(canvas);
}

/** PNG for `updateImageRawData`; assets from `build:signs`, else green-on-clear canvas. */
export async function slideToPngBytes(
  slide: SignSlide,
  opts: SlideToPngOptions = {},
): Promise<Uint8Array> {
  const showCaptions = opts.showCaptions !== false;
  const lensInsetFrame = opts.lensInsetFrame === true;
  const fromGlyph = await pngFromSignAsset(slide.title);
  if (fromGlyph && fromGlyph.length > 0) {
    const bmp = await bitmapFromPngBytes(fromGlyph);
    if (bmp) {
      const out = await finalizeSlideCanvas(
        slide,
        (c, w, _h, ch) => {
          c.drawImage(bmp, 0, 0, bmp.width, bmp.height, 0, 0, w, ch);
          bmp.close();
        },
        showCaptions,
        lensInsetFrame,
      );
      return out;
    }
  }

  const fromWord = await pngFromWordAsset(slide);
  if (fromWord && fromWord.length > 0) {
    const bmp = await bitmapFromPngBytes(fromWord);
    if (bmp) {
      const out = await finalizeSlideCanvas(
        slide,
        (c, w, _h, ch) => {
          c.drawImage(bmp, 0, 0, bmp.width, bmp.height, 0, 0, w, ch);
          bmp.close();
        },
        showCaptions,
        lensInsetFrame,
      );
      return out;
    }
  }

  return finalizeSlideCanvas(
    slide,
    (c, w, _h, ch) => {
    c.strokeStyle = 'rgb(0, 140, 0)';
    c.lineWidth = 3;
    c.strokeRect(2, 2, w - 4, ch - 4);

    c.fillStyle = 'rgb(0, 200, 0)';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const main = slide.title.length <= 14 ? 40 : slide.title.length <= 20 ? 30 : 24;
    c.font = `700 ${main}px system-ui, "Segoe UI", sans-serif`;
    c.fillText(slide.title, w / 2, ch / 2 - 8);

    c.font = '500 11px JetBrains Mono, ui-monospace, monospace';
    c.globalAlpha = 0.85;
    c.fillStyle = 'rgb(0, 160, 0)';
    c.fillText(slide.line.slice(0, 42), w / 2, ch / 2 + 22);
    c.globalAlpha = 1;
  },
    showCaptions,
    lensInsetFrame,
  );
}
