import dims from './signDimensions.json';

/** G2 hub image container max (SDK): width ≤ 288, height ≤ 144. Keep in sync with `signDimensions.json` and build scripts. */
export const SIGN_IMAGE_WIDTH: number = dims.SIGN_IMAGE_WIDTH;
export const SIGN_IMAGE_HEIGHT: number = dims.SIGN_IMAGE_HEIGHT;

const G2_PANEL_W = 576;
const G2_PANEL_H = 288;

/** Must match nav row count in `glossBridge.ts` (`NAV_LIST_NAMES`). */
export const GLASSES_NAV_ITEM_COUNT = 6;

/** Display lens layout tokens (576×288): prioritize sign area; calm list vs status borders). */
const GLASSES_MARGIN_TOP = 3;
const GLASSES_LIST_X = 5;
const GLASSES_LIST_Y = GLASSES_MARGIN_TOP;
/** Narrower strip → more horizontal breathing room around the 288-wide sign. */
const GLASSES_LIST_W = 100;
const GLASSES_GAP_LIST_IMAGE = 5;
const GLASSES_GAP_ABOVE_TEXT = 4;
/** Minimal strip; status is secondary to the slide PNG. */
const GLASSES_TEXT_STRIP_H = 30;
const GLASSES_LIST_BORDER_W = 1;
const GLASSES_LIST_BORDER_COLOR = 4;
const GLASSES_LIST_RADIUS = 3;
const GLASSES_LIST_PAD = 4;
const GLASSES_TEXT_BORDER_W = 1;
/** Slightly brighter edge than list so the strip reads as a separate instrument. */
const GLASSES_TEXT_BORDER_COLOR = 6;
const GLASSES_TEXT_RADIUS = 3;
const GLASSES_TEXT_PAD = 5;
const GLASSES_TEXT_X = 6;
const GLASSES_TEXT_W = 564;

/**
 * G2 list containers are a **vertical** scrollable list: each `itemName` is one row.
 * `itemWidth` is the **row width** (full inner width of the list), not column width.
 *
 * Layout: **narrow list column on the left** so the **sign image** uses the wide
 * remaining area (minimal chrome, focus on the 288×144 slide).
 *
 * @see https://github.com/nickustinov/even-g2-notes/blob/main/docs/display.md
 *
 * Phrases list length is dynamic (categories → words); see `glossBridge` + `phraseSnippets`.
 */
export type GlassesPanelMode = 'nav' | 'phrases';

export type GlassesListRect = {
  x: number;
  y: number;
  w: number;
  h: number;
  borderWidth: number;
  borderColor: number;
  borderRadius: number;
  paddingLength: number;
};

export type GlassesTextRect = GlassesListRect;

export type GlassesImageRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Full inner width for list rows (`itemWidth` on PB). */
export function glassesListItemRowWidth(list: GlassesListRect): number {
  const inner = Math.max(0, list.w - 2 * list.paddingLength);
  return Math.max(36, inner);
}

/**
 * Single glasses layout: sidebar list + large sign + compact status strip.
 * Nav and Phrases share the same geometry (only list contents change on rebuild).
 */
export function glassesPanelLayout(): {
  list: GlassesListRect;
  text: GlassesTextRect;
  image: GlassesImageRect;
} {
  const textY = G2_PANEL_H - GLASSES_TEXT_STRIP_H;
  const listH = textY - GLASSES_GAP_ABOVE_TEXT - GLASSES_LIST_Y;

  const list: GlassesListRect = {
    x: GLASSES_LIST_X,
    y: GLASSES_LIST_Y,
    w: GLASSES_LIST_W,
    h: listH,
    borderWidth: GLASSES_LIST_BORDER_W,
    borderColor: GLASSES_LIST_BORDER_COLOR,
    borderRadius: GLASSES_LIST_RADIUS,
    paddingLength: GLASSES_LIST_PAD,
  };

  const imgW = SIGN_IMAGE_WIDTH;
  const imgH = SIGN_IMAGE_HEIGHT;
  const imgX = Math.round(
    GLASSES_LIST_X +
      GLASSES_LIST_W +
      GLASSES_GAP_LIST_IMAGE +
      (G2_PANEL_W - GLASSES_LIST_X - GLASSES_LIST_W - GLASSES_GAP_LIST_IMAGE - imgW) / 2,
  );
  const imgSlotTop = GLASSES_LIST_Y;
  const imgSlotBottom = textY - GLASSES_GAP_ABOVE_TEXT;
  const imgSlotH = imgSlotBottom - imgSlotTop;
  const imgY = Math.round(imgSlotTop + Math.max(0, (imgSlotH - imgH) / 2));

  const text: GlassesTextRect = {
    x: GLASSES_TEXT_X,
    y: textY,
    w: GLASSES_TEXT_W,
    h: GLASSES_TEXT_STRIP_H,
    borderWidth: GLASSES_TEXT_BORDER_W,
    borderColor: GLASSES_TEXT_BORDER_COLOR,
    borderRadius: GLASSES_TEXT_RADIUS,
    paddingLength: GLASSES_TEXT_PAD,
  };

  return {
    list,
    text,
    image: { x: imgX, y: imgY, width: imgW, height: imgH },
  };
}

/** @deprecated Use `glassesPanelLayout().list` */
export const GLASSES_LIST = glassesPanelLayout().list;

/** @deprecated Use `glassesPanelLayout().text` */
export const GLASSES_TEXT = glassesPanelLayout().text;

export function glassesImageBox(_mode?: GlassesPanelMode): GlassesImageRect {
  void _mode;
  return glassesPanelLayout().image;
}

export function assertGlassesLayout(): void {
  const { list, text, image } = glassesPanelLayout();
  const errs: string[] = [];
  const chk = (name: string, v: number, lo: number, hi: number) => {
    if (v < lo || v > hi) errs.push(`${name}=${v} not in [${lo},${hi}]`);
  };
  chk('list.x', list.x, 0, 576);
  chk('list.y', list.y, 0, 288);
  chk('list.w', list.w, 0, 576);
  chk('list.h', list.h, 0, 288);
  chk('list.borderColor', list.borderColor, 0, 15);
  chk('image.x', image.x, 0, 576);
  chk('image.y', image.y, 0, 288);
  chk('image.width', image.width, 20, 288);
  chk('image.height', image.height, 20, 144);
  chk('text.x', text.x, 0, 576);
  chk('text.y', text.y, 0, 288);
  chk('text.w', text.w, 0, 576);
  chk('text.h', text.h, 0, 288);
  chk('text.borderColor', text.borderColor, 0, 15);
  if (list.x + list.w > image.x) errs.push('list overlaps image horizontally');
  if (image.x + image.width > G2_PANEL_W + 1) errs.push('image extends past panel width');
  if (list.y + list.h > text.y) errs.push('list overlaps text vertically');
  if (image.y + image.height > text.y) errs.push('image overlaps text vertically');
  if (text.y + text.h > G2_PANEL_H) errs.push(`text bottom exceeds panel (${G2_PANEL_H})`);
  if (errs.length) {
    throw new Error(`Glasses layout validation failed:\n${errs.join('\n')}`);
  }
}
