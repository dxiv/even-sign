import {
  type EvenAppBridge,
  type EvenHubEvent,
  CreateStartUpPageContainer,
  ImageContainerProperty,
  ImageRawDataUpdate,
  ImageRawDataUpdateResult,
  ListContainerProperty,
  ListItemContainerProperty,
  OsEventTypeList,
  RebuildPageContainer,
  StartUpPageCreateResult,
  TextContainerProperty,
  TextContainerUpgrade,
  evenHubEventFromJson,
  readNumber,
  readString,
  toObjectRecord,
} from '@evenrealities/even_hub_sdk';
import {
  SIGN_IMAGE_HEIGHT,
  SIGN_IMAGE_WIDTH,
  assertGlassesLayout,
  glassesPanelLayout,
  type GlassesPanelLayoutOptions,
} from './signConstants';
import {
  PHRASE_GLASSES_CATEGORY_LIST_ITEMS,
  PHRASE_GLASSES_MAX_LIST_ITEMS,
  findPhraseCategoryByPickerRowLabel,
  findPhraseCategoryByTitle,
  findSnippetInCategory,
  getPhraseCategoryPickerRowLabels,
  phraseSnippetGlassesRowLabel,
} from './phraseSnippets';
import { slideToPngBytes, type SlideToPngOptions } from './signRender';
import { phraseToSlides, type PhraseToSlidesOptions, type SignSlide } from './signSlides';
import { slideDeckDelayAfterSlide } from './slideDeckTiming';

/** G2 list labels: short readable English (row width is tight; clarity beats opaque glyphs). */
const ITEM_PREV = 'Prev';
const ITEM_NEXT = 'Next';
/** From first slide; restarts glasses autoplay when enabled. */
const ITEM_REPLAY = 'Replay';
const ITEM_CLEAR = 'Clear';
/** Opens quick phrases (same snippets as phone quick-insert). */
const ITEM_PHRASES = 'Phrases';
const ITEM_EXIT = 'Exit';

/** Full nav when a phrase deck is on-screen (Prev … Exit). Idle/home uses phrase categories instead of this list. */
const NAV_LIST_NAMES_FULL = [
  ITEM_PREV,
  ITEM_NEXT,
  ITEM_REPLAY,
  ITEM_CLEAR,
  ITEM_PHRASES,
  ITEM_EXIT,
] as const;

/** Max nav rows (full deck). Keep in sync with `GLASSES_NAV_ITEM_COUNT` in `signConstants.ts`. */
export const GLASSES_NAV_LIST_LEN = NAV_LIST_NAMES_FULL.length;

function glassesNavListNames(): readonly string[] {
  return NAV_LIST_NAMES_FULL;
}

/** Longest list the glasses phrases UI builds (scrollable vertical list). */
export const GLASSES_PHRASE_MAX_LIST_LEN = Math.max(
  PHRASE_GLASSES_CATEGORY_LIST_ITEMS,
  PHRASE_GLASSES_MAX_LIST_ITEMS,
);

type GlassesMenuMode = 'nav' | 'phrases';

/** Two-step phrases UI: pick a category, then a snippet (A–Z within each). */
type GlassesPhraseScreen =
  | { kind: 'categories' }
  | { kind: 'words'; categoryTitle: string };

let glassesMenuMode: GlassesMenuMode = 'phrases';
let glassesPhraseScreen: GlassesPhraseScreen = { kind: 'categories' };

function eqGlassesName(name: string, literal: string): boolean {
  return name.trim().toLowerCase() === literal.trim().toLowerCase();
}

/**
 * Map host-reported row text to our `itemName` string. G2 often truncates long labels
 * (e.g. "Phrase" vs "Phrases") while short rows like "Exit" still match exactly.
 */
function matchGlassesListRowLabel(trimmed: string, names: readonly string[]): string | undefined {
  const exact = names.find((n) => eqGlassesName(n, trimmed));
  if (exact) return exact;
  const tl = trimmed.toLowerCase();
  if (tl.length >= 3) {
    const byPrefix = names.filter((n) => n.toLowerCase().startsWith(tl));
    if (byPrefix.length === 1) return byPrefix[0];
  }
  const phrasesRow = names.find((n) => eqGlassesName(n, ITEM_PHRASES));
  if (phrasesRow && (tl === 'phrase' || tl === 'phras')) return phrasesRow;
  return undefined;
}

/**
 * Ring / temple double-press, or list double-tap when the list captures input.
 * Steps back: phrase words → categories; nav with a deck → category home (clear).
 * On home (placeholder + category list), double-tap opens the system exit flow.
 */
function handleGlobalDoubleTap(): void {
  const b = bridgeRef;
  if (!b) return;
  glassesForceReplayAutoplay = false;
  stopGlassesAutoplay();

  if (isGlassesHomeState()) {
    void b.shutDownPageContainer(1);
    return;
  }

  if (glassesMenuMode === 'phrases') {
    if (glassesPhraseScreen.kind === 'words') {
      glassesPhraseScreen = { kind: 'categories' };
      void (async () => {
        const ok = await rebuildGlassesMenu('phrases');
        if (ok) void showSlide(slideIndex);
      })();
      return;
    }
    void displayPhraseOnGlasses('');
    return;
  }

  void displayPhraseOnGlasses('');
}

/**
 * Glasses list selection is sometimes reported by index only (e.g. vertical swipe /
 * scroll events), without `currentSelectItemName`. Map index to the same labels as
 * `itemName` on the list container.
 */
function glassesPhraseListItemNames(): string[] {
  if (glassesPhraseScreen.kind === 'categories') {
    return [...getPhraseCategoryPickerRowLabels()];
  }
  const cat = findPhraseCategoryByTitle(glassesPhraseScreen.categoryTitle);
  if (!cat) {
    glassesPhraseScreen = { kind: 'categories' };
    return [...getPhraseCategoryPickerRowLabels()];
  }
  return [...cat.snippets.map((s) => phraseSnippetGlassesRowLabel(s))];
}

function glassesListNames(): readonly string[] {
  return glassesMenuMode === 'nav' ? glassesNavListNames() : glassesPhraseListItemNames();
}

export function resolvedListItemName(list: unknown): string | undefined {
  const rec =
    list && typeof list === 'object' && typeof (list as { toJson?: () => unknown }).toJson === 'function'
      ? toObjectRecord((list as { toJson: () => unknown }).toJson())
      : toObjectRecord(list);
  const names = glassesListNames();

  const trimmed = readListSelectName(rec);
  const idx = readListSelectIndex(rec);

  /**
   * Prefer index when it refers to a real row on the **current** list. The host often keeps a
   * stale `currentSelectItemName` from a previous layout (e.g. “Exit” while row 0 is Phrases).
   */
  if (typeof idx === 'number' && Number.isFinite(idx)) {
    if (idx >= 0 && idx < names.length) return names[idx];
    /** Some builds use 1-based indices; last row is often `n` instead of `n - 1`. */
    if (names.length > 0 && idx === names.length) return names[idx - 1];
  }

  if (trimmed) {
    const byLabel = matchGlassesListRowLabel(trimmed, names);
    if (byLabel) return byLabel;
  }

  return undefined;
}

function readListSelectName(rec: Record<string, unknown>): string | undefined {
  const s = readString(rec, 'currentSelectItemName', 'CurrentSelect_ItemName', 'Current_Select_ItemName');
  if (s?.trim()) return s.trim();
  return readString(rec, 'selectItemName', 'Select_ItemName', 'itemName', 'ItemName')?.trim();
}

function readListSelectIndex(rec: Record<string, unknown>): number | undefined {
  const a = readNumber(
    rec,
    'currentSelectItemIndex',
    'CurrentSelect_ItemIndex',
    'Current_Select_ItemIndex',
    'CurrentSelectItemIndex',
  );
  if (typeof a === 'number') return a;
  return readNumber(
    rec,
    'selectItemIndex',
    'Select_ItemIndex',
    'selectIndex',
    'SelectIndex',
    'itemIndex',
    'ItemIndex',
  );
}

const CONTAINER_LIST = 'list-1';
const CONTAINER_TEXT = 'text-1';
const CONTAINER_IMG = 'img-1';

function parseHubListEventType(rec: Record<string, unknown>): OsEventTypeList | undefined {
  return OsEventTypeList.fromJson(rec.eventType ?? rec.Event_Type);
}

function normalizeEvenHubEvent(incoming: unknown): EvenHubEvent {
  try {
    return evenHubEventFromJson(incoming as Record<string, unknown>) as EvenHubEvent;
  } catch {
    return toObjectRecord(incoming) as EvenHubEvent;
  }
}

/** Deep scan: cold-start / glasses-only taps sometimes nest row fields outside `listEvent`. */
function scanForListRowPayload(o: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 10 || o == null || typeof o !== 'object') return null;
  const rec = toObjectRecord(o);
  const hasName = !!readListSelectName(rec);
  const hasIdx = readListSelectIndex(rec) !== undefined;
  if (hasName || hasIdx) return rec;
  for (const v of Object.values(rec)) {
    if (v != null && typeof v === 'object') {
      const hit = scanForListRowPayload(v, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

/** Resolves list row fields whether the host sends `listEvent`, `jsonData`, or a flat map (simulator). */
function extractListEventRecord(event: EvenHubEvent, incoming: unknown): Record<string, unknown> | null {
  if (event.listEvent) {
    const le = event.listEvent as { toJson?: () => Record<string, unknown> };
    if (typeof le.toJson === 'function') return toObjectRecord(le.toJson());
    return toObjectRecord(event.listEvent as unknown as Record<string, unknown>);
  }
  const jd = event.jsonData;
  if (jd) {
    const rec = toObjectRecord(jd);
    if (readListSelectName(rec) || readListSelectIndex(rec) !== undefined) {
      return rec;
    }
    const nested = scanForListRowPayload(jd, 0);
    if (nested) return nested;
    const cid = readNumber(rec, 'containerID', 'Container_ID');
    const cname = readString(rec, 'containerName', 'Container_Name');
    if (cid === 1 || cname === CONTAINER_LIST) return rec;
  }
  const flat = toObjectRecord(incoming);
  if (readListSelectName(flat) || readListSelectIndex(flat) !== undefined) {
    return flat;
  }
  return scanForListRowPayload(incoming, 0) ?? scanForListRowPayload(event, 0);
}

/** Last glasses status line (raw). On idle home the strip is hidden — not shown on the lens. */
let lastGlassesStatusText = '';

let bridgeRef: EvenAppBridge | null = null;
let slides: SignSlide[] = [];
let slideIndex = 0;
const pngCache: Uint8Array[] = [];
let sendChain: Promise<void> = Promise.resolve();

/** Bumped on each new phrase so stale image uploads are ignored. */
let activePhraseEpoch = 0;

let phraseSlideOptions: PhraseToSlidesOptions = {};

/** Passed to `slideToPngBytes` (invalidates slide PNG cache when changed). */
let slideToPngOptions: SlideToPngOptions = { showCaptions: true };

/** Mirrors phone UI “Animate preview” — auto-advance slides on glasses with the same timings. */
let glassesAutoplayPreference = false;
/** User stepped slides (glasses list or hub Alt+arrows) — pause auto until the next Send. */
let glassesAutoplaySessionPaused = false;
/**
 * After **Replay** on glasses: loop the current deck with autoplay even if Animate is off on the phone.
 * Cleared on the next **Send** from the app or **Clear**.
 */
let glassesForceReplayAutoplay = false;

/** Idle / empty deck: omit bottom strip so the sign uses full height (no clipped “Gloss” bar). */
function currentOmitBottomStatusStrip(): boolean {
  if (slides.length === 0) return true;
  return slides.length === 1 && slides[0]?.kind === 'placeholder';
}

let lastLayoutOmitBottomStrip: boolean | null = null;

function layoutOpts(_ctxMode: GlassesMenuMode = glassesMenuMode): GlassesPanelLayoutOptions {
  void _ctxMode;
  return {
    omitBottomStatusStrip: currentOmitBottomStatusStrip(),
    /** Use full-height list column for reliable G2 taps (categories home + phrases use the same slot). */
    compactNavList: false,
  };
}

function layoutSnapshot(ctxMode: GlassesMenuMode = glassesMenuMode) {
  return glassesPanelLayout(layoutOpts(ctxMode));
}

function lensStatusTargetColumns(): number {
  const w = layoutSnapshot().text.w;
  return Math.min(48, Math.max(14, Math.floor(w / 10)));
}

function lensPadCenterShortLabel(label: string, targetCols: number): string {
  const t = label.trim();
  if (t.length >= targetCols) return t;
  const pad = targetCols - t.length;
  const left = Math.floor(pad / 2);
  return ' '.repeat(left) + t;
}

/** Strip hidden on idle — send a blank line so the 1px placeholder container stays valid. */
function lensStatusDisplayString(raw: string): string {
  if (currentOmitBottomStatusStrip()) return ' ';
  const trimmed = raw.trim();
  if (trimmed.toLowerCase() === 'gloss') {
    return lensPadCenterShortLabel('Gloss', lensStatusTargetColumns());
  }
  return raw;
}

async function ensureLayoutMatchesDeck(): Promise<boolean> {
  const next = currentOmitBottomStatusStrip();
  if (lastLayoutOmitBottomStrip === next) return true;
  if (!bridgeRef) return false;
  pngCache.length = 0;
  const ok = await rebuildGlassesMenu(glassesMenuMode);
  if (ok) lastLayoutOmitBottomStrip = next;
  return ok;
}

let glassesAutoplayTimer: ReturnType<typeof setTimeout> | 0 = 0;

export function setGlassesAutoplayPreference(on: boolean): void {
  glassesAutoplayPreference = on;
}

export function stopGlassesAutoplay(): void {
  if (glassesAutoplayTimer) {
    clearTimeout(glassesAutoplayTimer);
    glassesAutoplayTimer = 0;
  }
}

function scheduleGlassesAutoplayAfterDwell(epoch: number): void {
  const wantsAutoplay =
    (glassesAutoplayPreference || glassesForceReplayAutoplay) &&
    !glassesAutoplaySessionPaused &&
    slides.length > 1;
  if (!wantsAutoplay || !bridgeRef) {
    return;
  }
  if (glassesAutoplayTimer) {
    clearTimeout(glassesAutoplayTimer);
    glassesAutoplayTimer = 0;
  }
  const delay = slideDeckDelayAfterSlide(slides, slideIndex);
  const epochWhenScheduled = epoch;
  const indexWhenScheduled = slideIndex;
  glassesAutoplayTimer = window.setTimeout(() => {
    glassesAutoplayTimer = 0;
    if (epochWhenScheduled !== activePhraseEpoch) return;
    if (glassesAutoplaySessionPaused) return;
    if (slideIndex !== indexWhenScheduled) return;
    const next = (indexWhenScheduled + 1) % slides.length;
    void showSlide(next);
  }, delay);
}

export type GlassesUiInitResult = { ok: true } | { ok: false; error: string };

export type GlassesPushResult = { ok: true } | { ok: false; error: string };

export type DisplayPhraseOnGlassesOpts = {
  /**
   * Phrase chosen on-glasses (Phrases row): auto-advance the deck like Replay/Animate when there is more than one slide.
   * Skipped when the trimmed phrase is a single character (nothing to “step” meaningfully).
   */
  glassesPhraseAutoplay?: boolean;
};

export function setPhraseSlideOptions(opts: PhraseToSlidesOptions): void {
  phraseSlideOptions = { ...opts };
}

export function getPhraseSlideOptions(): PhraseToSlidesOptions {
  return { ...phraseSlideOptions };
}

export function setSlideToPngOptions(opts: SlideToPngOptions): void {
  slideToPngOptions = { ...slideToPngOptions, ...opts };
  pngCache.length = 0;
}

export function getSlideToPngOptions(): SlideToPngOptions {
  return { ...slideToPngOptions };
}

function startupFailureMessage(code: StartUpPageCreateResult): string {
  switch (code) {
    case StartUpPageCreateResult.invalid:
      return 'Glasses rejected the UI layout. Reload this hub page in the Even app, then open Gloss again.';
    case StartUpPageCreateResult.oversize:
      return 'Glasses UI layout too large for the device.';
    case StartUpPageCreateResult.outOfMemory:
      return 'Glasses out of memory creating the UI.';
    default:
      return `Could not start glasses UI (code ${String(code)}).`;
  }
}

function navList(): ListContainerProperty {
  const L = layoutSnapshot('nav').list;
  const names = [...glassesNavListNames()];
  return new ListContainerProperty({
    xPosition: L.x,
    yPosition: L.y,
    width: L.w,
    height: L.h,
    borderWidth: L.borderWidth,
    borderColor: L.borderColor,
    borderRadius: L.borderRadius,
    paddingLength: L.paddingLength,
    containerID: 1,
    containerName: CONTAINER_LIST,
    itemContainer: new ListItemContainerProperty({
      itemCount: names.length,
      /** `0` = firmware auto-fill row width (G2 list docs); avoids swipe/selection glitches with some fixed widths. */
      itemWidth: 0,
      isItemSelectBorderEn: 1,
      itemName: names,
    }),
    isEventCapture: 1,
  });
}

function phrasesList(): ListContainerProperty {
  const L = layoutSnapshot('phrases').list;
  const names = glassesPhraseListItemNames();
  return new ListContainerProperty({
    xPosition: L.x,
    yPosition: L.y,
    width: L.w,
    height: L.h,
    borderWidth: L.borderWidth,
    borderColor: L.borderColor,
    borderRadius: L.borderRadius,
    paddingLength: L.paddingLength,
    containerID: 1,
    containerName: CONTAINER_LIST,
    itemContainer: new ListItemContainerProperty({
      itemCount: names.length,
      itemWidth: 0,
      isItemSelectBorderEn: 1,
      itemName: names,
    }),
    isEventCapture: 1,
  });
}

/** Home: empty placeholder sign + phrase category list (ASL entry). Double-tap exits the hub page. */
function isGlassesHomeState(): boolean {
  if (!(slides.length === 1 && slides[0]?.kind === 'placeholder')) return false;
  return (
    glassesMenuMode === 'phrases' &&
    glassesPhraseScreen.kind === 'categories'
  );
}

async function rebuildGlassesMenu(mode: GlassesMenuMode): Promise<boolean> {
  const b = bridgeRef;
  if (!b) return false;
  const list = mode === 'nav' ? navList() : phrasesList();
  const ok = await b.rebuildPageContainer(
    new RebuildPageContainer({
      containerTotalNum: 3,
      listObject: [list],
      textObject: [textStatusContainer(mode)],
      imageObject: [imageContainer(mode)],
    }),
  );
  if (!ok) {
    if (import.meta.env.DEV) console.warn('rebuildPageContainer returned false');
    await pushStatus('Menu failed');
    return false;
  }
  glassesMenuMode = mode;
  return true;
}

function imageContainer(ctxMode: GlassesMenuMode = glassesMenuMode): ImageContainerProperty {
  const I = layoutSnapshot(ctxMode).image;
  return new ImageContainerProperty({
    xPosition: I.x,
    yPosition: I.y,
    width: I.width,
    height: I.height,
    containerID: 3,
    containerName: CONTAINER_IMG,
  });
}

function textStatusContainer(ctxMode: GlassesMenuMode = glassesMenuMode): TextContainerProperty {
  const T = layoutSnapshot(ctxMode).text;
  return new TextContainerProperty({
    xPosition: T.x,
    yPosition: T.y,
    width: T.w,
    height: T.h,
    borderWidth: T.borderWidth,
    borderColor: T.borderColor,
    borderRadius: T.borderRadius,
    paddingLength: T.paddingLength,
    containerID: 2,
    containerName: CONTAINER_TEXT,
    content: lensStatusDisplayString(lastGlassesStatusText),
    isEventCapture: 0,
  });
}

function mainLayout(): CreateStartUpPageContainer {
  return new CreateStartUpPageContainer({
    containerTotalNum: 3,
    listObject: [phrasesList()],
    textObject: [textStatusContainer('phrases')],
    imageObject: [imageContainer('phrases')],
  });
}

/** Full-width text strip can show a long status line; keep under typical Hub limits. */
const GLASSES_STATUS_MAX = 200;

/** Scale slide PNG to match the current glasses image container (taller list ⇒ shorter image area). */
async function scalePngIfNeeded(bytes: Uint8Array, targetW: number, targetH: number): Promise<Uint8Array> {
  if (bytes.length === 0) return bytes;
  if (targetW === SIGN_IMAGE_WIDTH && targetH === SIGN_IMAGE_HEIGHT) return bytes;
  try {
    const blob = new Blob([bytes], { type: 'image/png' });
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = targetW;
    c.height = targetH;
    const ctx = c.getContext('2d');
    if (!ctx) {
      bmp.close();
      return bytes;
    }
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(bmp, 0, 0, targetW, targetH);
    bmp.close();
    const out = await new Promise<Uint8Array | null>((resolve) => {
      c.toBlob((b) => {
        if (!b) {
          resolve(null);
          return;
        }
        void b.arrayBuffer().then((ab) => resolve(new Uint8Array(ab)));
      }, 'image/png');
    });
    return out ?? bytes;
  } catch {
    return bytes;
  }
}

async function pushStatus(text: string) {
  const b = bridgeRef;
  if (!b) return;
  const content =
    text.length > GLASSES_STATUS_MAX ? text.slice(0, GLASSES_STATUS_MAX - 1) + '…' : text;
  lastGlassesStatusText = content;
  const display = lensStatusDisplayString(content);
  await b.textContainerUpgrade(
    new TextContainerUpgrade({
      containerID: 2,
      containerName: CONTAINER_TEXT,
      contentOffset: 0,
      contentLength: display.length,
      content: display,
    }),
  );
}

function enqueueImage(bytes: Uint8Array, epoch: number): Promise<void> {
  const b = bridgeRef;
  if (!b || bytes.length === 0) return Promise.resolve();
  sendChain = sendChain.then(async () => {
    if (epoch !== activePhraseEpoch) return;
    const box = layoutSnapshot().image;
    const payload = await scalePngIfNeeded(bytes, box.width, box.height);
    const res = await b.updateImageRawData(
      new ImageRawDataUpdate({
        containerID: 3,
        containerName: CONTAINER_IMG,
        imageData: payload,
      }),
    );
    if (epoch !== activePhraseEpoch) return;
    if (!ImageRawDataUpdateResult.isSuccess(res)) {
      console.warn('updateImageRawData', res);
      await pushStatus('Image failed');
    }
  });
  return sendChain;
}

function clipStatus(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** One short line for the glasses text strip — sign image stays the focus. */
function compactGlassesStatus(slide: SignSlide, idx: number, total: number): string {
  const captionsOn = slideToPngOptions.showCaptions !== false;
  const head = `${idx + 1}/${total}`;

  if (captionsOn) {
    switch (slide.kind) {
      case 'word':
        return `${head} · W`;
      case 'letter': {
        if (slide.spellOf && slide.spellIndex && slide.spellOfLen) {
          return `${head} · L · ${slide.spellIndex}/${slide.spellOfLen}`;
        }
        return `${head} · L`;
      }
      case 'digit': {
        if (slide.spellOf && slide.spellIndex && slide.spellOfLen) {
          return `${head} · # · ${slide.spellIndex}/${slide.spellOfLen}`;
        }
        return `${head} · #`;
      }
      case 'placeholder':
        return 'Gloss';
      default:
        return `${head}`;
    }
  }

  switch (slide.kind) {
    case 'word':
      return `${head} · ${clipStatus(slide.title, 22)}`;
    case 'letter': {
      let s = `${head} · ${slide.title}`;
      if (slide.spellOf && slide.spellIndex && slide.spellOfLen) {
        s += ` · ${slide.spellIndex}/${slide.spellOfLen} ${clipStatus(slide.spellOf, 16)}`;
      }
      return s;
    }
    case 'digit': {
      let s = `${head} · ${slide.title}`;
      if (slide.spellOf && slide.spellIndex && slide.spellOfLen) {
        s += ` · ${slide.spellIndex}/${slide.spellOfLen}`;
      }
      return s;
    }
    case 'placeholder':
      return 'Gloss';
    default:
      return `${head} · ${clipStatus(slide.title, 20)}`;
  }
}

async function showSlide(i: number) {
  if (slides.length === 0) return;
  if (!(await ensureLayoutMatchesDeck())) return;
  const epoch = activePhraseEpoch;
  const clamped = Math.max(0, Math.min(i, slides.length - 1));
  slideIndex = clamped;
  const slide = slides[slideIndex];

  if (!pngCache[slideIndex]) {
    pngCache[slideIndex] = await slideToPngBytes(slide, slideToPngOptions);
  }
  const bytes = pngCache[slideIndex];
  if (bytes.length === 0) {
    stopGlassesAutoplay();
    await pushStatus(`! ${clipStatus(slide.title, 20)}`);
    return;
  }
  await enqueueImage(bytes, epoch);
  if (epoch !== activePhraseEpoch) return;
  await pushStatus(compactGlassesStatus(slide, slideIndex, slides.length));
  scheduleGlassesAutoplayAfterDwell(epoch);
}

export async function displayPhraseOnGlasses(
  phrase: string,
  opts?: DisplayPhraseOnGlassesOpts,
): Promise<GlassesPushResult> {
  if (!bridgeRef) {
    return { ok: false, error: 'No glasses bridge.' };
  }
  await sendChain;
  stopGlassesAutoplay();
  glassesAutoplaySessionPaused = false;
  const t = phrase.trim();
  const forceGlassesPhraseDeck =
    opts?.glassesPhraseAutoplay === true && t.length > 1;
  glassesForceReplayAutoplay = forceGlassesPhraseDeck;

  activePhraseEpoch++;
  slides = phraseToSlides(phrase, phraseSlideOptions);
  slideIndex = 0;
  pngCache.length = 0;
  sendChain = Promise.resolve();

  if (t.length === 0) {
    glassesPhraseScreen = { kind: 'categories' };
    await rebuildGlassesMenu('phrases');
  } else if (glassesMenuMode !== 'nav') {
    await rebuildGlassesMenu('nav');
  }
  await showSlide(0);
  return { ok: true };
}

/** Current slide index on glasses (after a successful send). For hub keyboard shortcuts. */
export function getGlassesSlideIndex(): number {
  return slideIndex;
}

/** Step glasses slides when the bridge is active (mirrors Prev / Next on G2). */
export async function glassesNavRelative(delta: number): Promise<void> {
  if (!bridgeRef || slides.length === 0) return;
  glassesAutoplaySessionPaused = true;
  glassesForceReplayAutoplay = false;
  stopGlassesAutoplay();
  await showSlide(slideIndex + delta);
}

export async function runGlossOnBridge(bridge: EvenAppBridge): Promise<GlassesUiInitResult> {
  bridgeRef = bridge;
  assertGlassesLayout();
  if (import.meta.env.DEV) {
    console.info(`[Gloss] G2 slide PNG ${SIGN_IMAGE_WIDTH}×${SIGN_IMAGE_HEIGHT}`);
  }
  const created = await bridge.createStartUpPageContainer(mainLayout());
  if (created !== StartUpPageCreateResult.success) {
    if (import.meta.env.DEV) {
      console.error('createStartUpPageContainer', created);
    }
    stopGlassesAutoplay();
    bridgeRef = null;
    return { ok: false, error: startupFailureMessage(created) };
  }

  lastLayoutOmitBottomStrip = currentOmitBottomStatusStrip();

  bridge.onEvenHubEvent((incoming) => {
    const event = normalizeEvenHubEvent(incoming);

    const textEt = event.textEvent
      ? parseHubListEventType(toObjectRecord(event.textEvent as unknown as Record<string, unknown>))
      : undefined;
    if (textEt === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      handleGlobalDoubleTap();
      return;
    }

    const listRec = extractListEventRecord(event, incoming);
    if (!listRec || Object.keys(listRec).length === 0) return;

    const listEt = parseHubListEventType(listRec);
    if (listEt === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      handleGlobalDoubleTap();
      return;
    }
    if (
      listEt === OsEventTypeList.SCROLL_TOP_EVENT ||
      listEt === OsEventTypeList.SCROLL_BOTTOM_EVENT
    ) {
      return;
    }

    const name = resolvedListItemName(listRec);
    if (!name) return;

    if (glassesMenuMode === 'phrases') {
      if (glassesPhraseScreen.kind === 'categories') {
        const cat = findPhraseCategoryByPickerRowLabel(name);
        if (cat) {
          glassesPhraseScreen = { kind: 'words', categoryTitle: cat.title };
          void (async () => {
            const ok = await rebuildGlassesMenu('phrases');
            if (ok) void showSlide(slideIndex);
          })();
        }
        return;
      }
      const chip = findSnippetInCategory(glassesPhraseScreen.categoryTitle, name);
      if (chip) {
        void displayPhraseOnGlasses(chip.phrase, { glassesPhraseAutoplay: true });
      }
      return;
    }

    if (eqGlassesName(name, ITEM_EXIT)) {
      glassesForceReplayAutoplay = false;
      stopGlassesAutoplay();
      void bridge.shutDownPageContainer(1);
      return;
    }
    if (eqGlassesName(name, ITEM_PREV)) {
      glassesAutoplaySessionPaused = true;
      glassesForceReplayAutoplay = false;
      stopGlassesAutoplay();
      void showSlide(slideIndex - 1);
      return;
    }
    if (eqGlassesName(name, ITEM_NEXT)) {
      glassesAutoplaySessionPaused = true;
      glassesForceReplayAutoplay = false;
      stopGlassesAutoplay();
      void showSlide(slideIndex + 1);
      return;
    }
    if (eqGlassesName(name, ITEM_REPLAY)) {
      glassesAutoplaySessionPaused = false;
      glassesForceReplayAutoplay = true;
      stopGlassesAutoplay();
      void showSlide(0);
      return;
    }
    if (eqGlassesName(name, ITEM_CLEAR)) {
      void displayPhraseOnGlasses('');
      return;
    }
    if (eqGlassesName(name, ITEM_PHRASES)) {
      glassesPhraseScreen = { kind: 'categories' };
      void (async () => {
        const ok = await rebuildGlassesMenu('phrases');
        if (ok) void showSlide(slideIndex);
      })();
      return;
    }
  });

  const pushed = await displayPhraseOnGlasses('');
  if (!pushed.ok) {
    return { ok: false, error: pushed.error };
  }

  /**
   * Second rebuild after first paint: native list selection/index can be stale until
   * `rebuildPageContainer` runs again (cold start / glasses-only).
   */
  if (currentOmitBottomStatusStrip() && glassesMenuMode === 'phrases') {
    pngCache.length = 0;
    const okPh = await rebuildGlassesMenu('phrases');
    if (okPh && slides.length > 0) await showSlide(slideIndex);
  }

  return { ok: true };
}

/**
 * Test-only: set module state for Vitest. Do not use from hub UI code.
 * @internal
 */
export function __testSetGlossBridgeState(patch: {
  menuMode?: GlassesMenuMode;
  phraseScreen?: GlassesPhraseScreen;
  slides?: SignSlide[];
}): void {
  if (patch.menuMode !== undefined) glassesMenuMode = patch.menuMode;
  if (patch.phraseScreen !== undefined) glassesPhraseScreen = patch.phraseScreen;
  if (patch.slides !== undefined) slides = patch.slides;
}
