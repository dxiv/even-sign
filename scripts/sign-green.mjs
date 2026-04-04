// R/B → 0, G ← luminance; keep alpha.
import sharp from 'sharp';

export async function forceEvenGreenPngBuffer(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = new Uint8ClampedArray(data);
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
  return sharp(px, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}
