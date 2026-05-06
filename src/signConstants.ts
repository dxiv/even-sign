import dims from './signDimensions.json';

/**
 * Slide PNG size (G2-safe green pipeline). Keep in sync with `signDimensions.json` and
 * build scripts. Hub / glasses **image containers** are validated at this size; the lens
 * layout centers that box in the space left of the list and status chrome.
 */
export const SIGN_IMAGE_WIDTH: number = dims.SIGN_IMAGE_WIDTH;
export const SIGN_IMAGE_HEIGHT: number = dims.SIGN_IMAGE_HEIGHT;

const G2_PANEL_W = 576;
const G2_PANEL_H = 288;

/** Max nav list rows when a deck is on-screen (`NAV_LIST_NAMES_FULL` in `glossBridge.ts`). Home uses phrase categories, not this count. */
export const GLASSES_NAV_ITEM_COUNT = 6;

/** Display lens layout tokens (576×288): prioritize sign area; balance list vs status borders. */
const GLASSES_MARGIN_TOP = 3;
const GLASSES_LIST_X = 5;
const GLASSES_LIST_Y = GLASSES_MARGIN_TOP;
/** Nav + phrase rows: wide enough for labels like “Phrases” / “appointment” without clipping. */
const GLASSES_LIST_W = 100;
/** Space between list chrome and sign area so borders do not visually crowd the image. */
const GLASSES_GAP_LIST_IMAGE = 5;
const GLASSES_GAP_ABOVE_TEXT = 3;
/** Status strip under the sign when visible — extra height for descenders + firmware line metrics. */
const GLASSES_TEXT_STRIP_H = 34;
/** Right margin from image area to panel edge (px). */
const GLASSES_IMAGE_RIGHT_PAD = 4;
const GLASSES_LIST_BORDER_W = 1;
const GLASSES_LIST_BORDER_COLOR = 4;
const GLASSES_LIST_RADIUS = 3;
/** Inner padding so row labels clear the list border on G2. */
const GLASSES_LIST_PAD = 6;
/** Reserved for optional compact nav layout (`compactNavList`); home uses full phrase category list. */
const GLASSES_NAV_IDLE_ROW_COUNT = 2;
/** Approximate list row height for layout math (G2 firmware may differ slightly). */
const GLASSES_LIST_ROW_APPROX_PX = 34;
const GLASSES_TEXT_BORDER_W = 1;
/** Slightly brighter edge than list so the strip reads as a separate instrument. */
const GLASSES_TEXT_BORDER_COLOR = 6;
const GLASSES_TEXT_RADIUS = 3;
const GLASSES_TEXT_PAD = 7;

/**
 * G2 list containers are a **vertical** scrollable list: each `itemName` is one row.
 * `itemWidth` is the **row width** (full inner width of the list), not column width.
 *
 * Layout: **narrow list column on the left**; the **image container** is the largest
 * 2∶1 rect that fits the slot, **capped** at `SIGN_IMAGE_WIDTH`×`SIGN_IMAGE_HEIGHT`
 * (Hub / simulator limit), and centered in the slot.
 *
 * @see https://github.com/nickustinov/even-g2-notes/blob/main/docs/display.md
 *
 * Phrases list length is dynamic (categories → words); see `glossBridge` + `phraseSnippets`.
 */
export type GlassesPanelMode = 'nav' | 'phrases';

/** When `omitBottomStatusStrip` is true, the idle placeholder uses the full panel height for the sign (no “Gloss” bar). */
export type GlassesPanelLayoutOptions = {
  omitBottomStatusStrip?: boolean;
  /**
   * When `true`, caps nav list height and vertically centers it (optional). Gloss keeps this off for reliable G2 taps.
   * Category/word lists should use `false` so the column stays scrollable.
   */
  compactNavList?: boolean;
};

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
 * Single glasses layout: sidebar list + sign + optional bottom status strip.
 * Nav and Phrases share the same geometry (only list contents change on rebuild).
 */
export function glassesPanelLayout(opts?: GlassesPanelLayoutOptions): {
  list: GlassesListRect;
  text: GlassesTextRect;
  image: GlassesImageRect;
} {
  const omit = opts?.omitBottomStatusStrip === true;
  const stripH = omit ? 0 : GLASSES_TEXT_STRIP_H;
  const contentBottom = G2_PANEL_H - stripH;
  /** Top/bottom of the left column (aligned with the image slot — compact nav centers in this band). */
  const listColumnTop = GLASSES_LIST_Y;
  const listColumnBottom = contentBottom - GLASSES_GAP_ABOVE_TEXT;
  const fullListH = Math.max(1, listColumnBottom - listColumnTop);
  let listH = fullListH;
  if (opts?.compactNavList === true) {
    const body =
      GLASSES_NAV_IDLE_ROW_COUNT * GLASSES_LIST_ROW_APPROX_PX +
      2 * GLASSES_LIST_PAD +
      2 * GLASSES_LIST_BORDER_W +
      10;
    listH = Math.min(fullListH, Math.max(58, body));
  }

  let listY = listColumnTop;
  if (opts?.compactNavList === true) {
    listY = Math.round(listColumnTop + Math.max(0, (fullListH - listH) / 2));
  }

  const list: GlassesListRect = {
    x: GLASSES_LIST_X,
    y: listY,
    w: GLASSES_LIST_W,
    h: listH,
    borderWidth: GLASSES_LIST_BORDER_W,
    borderColor: GLASSES_LIST_BORDER_COLOR,
    borderRadius: GLASSES_LIST_RADIUS,
    paddingLength: GLASSES_LIST_PAD,
  };

  const imgSlotLeft = GLASSES_LIST_X + GLASSES_LIST_W + GLASSES_GAP_LIST_IMAGE;
  const imgSlotTop = GLASSES_LIST_Y;
  const imgSlotBottom = contentBottom - GLASSES_GAP_ABOVE_TEXT;
  const imgSlotH = Math.max(1, imgSlotBottom - imgSlotTop);
  const imgSlotW = Math.max(1, G2_PANEL_W - imgSlotLeft - GLASSES_IMAGE_RIGHT_PAD);
  const aspect = SIGN_IMAGE_WIDTH / SIGN_IMAGE_HEIGHT;
  let dispW = imgSlotW;
  let dispH = dispW / aspect;
  if (dispH > imgSlotH) {
    dispH = imgSlotH;
    dispW = dispH * aspect;
  }
  /** Hub + `evenhub-simulator` reject image containers above native slide size. */
  const capScale = Math.min(SIGN_IMAGE_WIDTH / dispW, SIGN_IMAGE_HEIGHT / dispH, 1);
  dispW *= capScale;
  dispH *= capScale;
  const imgW = Math.max(20, Math.round(dispW));
  const imgH = Math.max(20, Math.round(dispH));
  const imgX = Math.round(imgSlotLeft + Math.max(0, (imgSlotW - imgW) / 2));
  const imgY = Math.round(imgSlotTop + Math.max(0, (imgSlotH - imgH) / 2));

  const text: GlassesTextRect = omit
    ? {
        x: 0,
        y: G2_PANEL_H - 1,
        w: G2_PANEL_W,
        h: 1,
        borderWidth: 0,
        borderColor: GLASSES_TEXT_BORDER_COLOR,
        borderRadius: 0,
        paddingLength: 0,
      }
    : (() => {
        const textY = contentBottom;
        const textW = Math.min(240, imgW, G2_PANEL_W - imgSlotLeft - 4);
        let textX = Math.round(imgX + (imgW - textW) / 2);
        const minX = imgSlotLeft;
        if (textX < minX) textX = minX;
        const maxR = G2_PANEL_W - 2;
        if (textX + textW > maxR) textX = Math.max(minX, maxR - textW);
        return {
          x: textX,
          y: textY,
          w: textW,
          h: stripH,
          borderWidth: GLASSES_TEXT_BORDER_W,
          borderColor: GLASSES_TEXT_BORDER_COLOR,
          borderRadius: GLASSES_TEXT_RADIUS,
          paddingLength: GLASSES_TEXT_PAD,
        } satisfies GlassesTextRect;
      })();

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

function validateGlassesPlane(layout: ReturnType<typeof glassesPanelLayout>, label: string): void {
  const { list, text, image } = layout;
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
  chk('image.width', image.width, 20, SIGN_IMAGE_WIDTH);
  chk('image.height', image.height, 20, SIGN_IMAGE_HEIGHT);
  chk('text.x', text.x, 0, 576);
  chk('text.y', text.y, 0, 288);
  chk('text.w', text.w, 1, 576);
  chk('text.h', text.h, 1, 288);
  chk('text.borderColor', text.borderColor, 0, 15);
  if (list.x + list.w > image.x) errs.push('list overlaps image horizontally');
  if (image.x + image.width > G2_PANEL_W + 1) errs.push('image extends past panel width');
  if (list.y + list.h > text.y) errs.push('list overlaps text vertically');
  if (image.y + image.height > text.y) errs.push('image overlaps text vertically');
  if (text.y + text.h > G2_PANEL_H) errs.push(`text bottom exceeds panel (${G2_PANEL_H})`);
  if (errs.length) {
    throw new Error(`Glasses layout validation failed (${label}):\n${errs.join('\n')}`);
  }
}

export function assertGlassesLayout(): void {
  validateGlassesPlane(glassesPanelLayout({ omitBottomStatusStrip: false }), 'status on');
  validateGlassesPlane(glassesPanelLayout({ omitBottomStatusStrip: true }), 'idle strip off');
  validateGlassesPlane(
    glassesPanelLayout({ omitBottomStatusStrip: true, compactNavList: true }),
    'idle compact nav list',
  );
}
