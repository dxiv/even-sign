import dims from './signDimensions.json';

/** G2 hub image container max (SDK): width ≤ 288, height ≤ 144. Keep in sync with `signDimensions.json` and build scripts. */
export const SIGN_IMAGE_WIDTH: number = dims.SIGN_IMAGE_WIDTH;
export const SIGN_IMAGE_HEIGHT: number = dims.SIGN_IMAGE_HEIGHT;

const G2_PANEL_W = 576;
const G2_PANEL_H = 288;

/**
 * List + status on the 576×288 glasses panel (SDK ranges).
 * Near full-width top row so nav actions sit in one horizontal strip (host maps swipe along that row).
 */
export const GLASSES_LIST = {
  x: 8,
  y: 12,
  w: 560,
  h: 56,
  borderWidth: 2,
  borderColor: 5,
  borderRadius: 6,
  paddingLength: 6,
} as const;

export const GLASSES_TEXT = {
  x: 8,
  y: 224,
  w: 560,
  h: 58,
  borderWidth: 1,
  borderColor: 3,
  borderRadius: 6,
  paddingLength: 8,
} as const;

export function glassesImageBox(): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.round((G2_PANEL_W - SIGN_IMAGE_WIDTH) / 2),
    y: 78,
    width: SIGN_IMAGE_WIDTH,
    height: SIGN_IMAGE_HEIGHT,
  };
}

export function assertGlassesLayout(): void {
  const list = GLASSES_LIST;
  const text = GLASSES_TEXT;
  const img = glassesImageBox();
  const errs: string[] = [];
  const chk = (name: string, v: number, lo: number, hi: number) => {
    if (v < lo || v > hi) errs.push(`${name}=${v} not in [${lo},${hi}]`);
  };
  chk('list.x', list.x, 0, 576);
  chk('list.y', list.y, 0, 288);
  chk('list.w', list.w, 0, 576);
  chk('list.h', list.h, 0, 288);
  chk('list.borderColor', list.borderColor, 0, 15);
  chk('image.x', img.x, 0, 576);
  chk('image.y', img.y, 0, 288);
  chk('image.width', img.width, 20, 288);
  chk('image.height', img.height, 20, 144);
  chk('text.x', text.x, 0, 576);
  chk('text.y', text.y, 0, 288);
  chk('text.w', text.w, 0, 576);
  chk('text.h', text.h, 0, 288);
  chk('text.borderColor', text.borderColor, 0, 16);
  if (list.y + list.h > img.y) errs.push('list overlaps image vertically');
  if (img.y + img.height > text.y) errs.push('image overlaps text vertically');
  if (text.y + text.h > G2_PANEL_H) errs.push(`text bottom exceeds panel (${G2_PANEL_H})`);
  if (errs.length) {
    throw new Error(`Glasses layout validation failed:\n${errs.join('\n')}`);
  }
}
