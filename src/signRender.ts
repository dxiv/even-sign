import { wordAssetSlug, type SignSlide } from './signSlides';

/** G2 image area (~288×144 max in SDK). */
export const SIGN_IMAGE_WIDTH = 280;
export const SIGN_IMAGE_HEIGHT = 120;

const SINGLE_GLYPH = /^[A-Z0-9]$/;

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

async function pngFromWordAsset(slide: SignSlide): Promise<Uint8Array | null> {
  const slug = wordAssetSlug(slide);
  if (!slug) {
    return null;
  }
  try {
    const res = await fetch(`/signs/words/${slug}.png`, { cache: 'force-cache' });
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

/** PNG for `updateImageRawData`; assets from `build:signs`, else green-on-clear canvas. */
export async function slideToPngBytes(slide: SignSlide): Promise<Uint8Array> {
  const fromGlyph = await pngFromSignAsset(slide.title);
  if (fromGlyph && fromGlyph.length > 0) {
    return fromGlyph;
  }

  const fromWord = await pngFromWordAsset(slide);
  if (fromWord && fromWord.length > 0) {
    return fromWord;
  }

  const w = SIGN_IMAGE_WIDTH;
  const h = SIGN_IMAGE_HEIGHT;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d');
  if (!c) {
    return Promise.resolve(new Uint8Array());
  }

  c.clearRect(0, 0, w, h);
  c.strokeStyle = '#00ff00';
  c.lineWidth = 3;
  c.strokeRect(2, 2, w - 4, h - 4);

  c.fillStyle = '#00ff00';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const main = slide.title.length <= 14 ? 44 : slide.title.length <= 20 ? 34 : 28;
  c.font = `700 ${main}px system-ui, Segoe UI, sans-serif`;
  c.fillText(slide.title, w / 2, h / 2 - 10);

  c.font = '500 13px JetBrains Mono, ui-monospace, monospace';
  c.globalAlpha = 0.85;
  c.fillText(slide.line.slice(0, 42), w / 2, h / 2 + 28);
  c.globalAlpha = 1;

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
