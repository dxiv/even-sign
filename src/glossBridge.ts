import {
  type EvenAppBridge,
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
} from '@evenrealities/even_hub_sdk';
import {
  GLASSES_LIST,
  GLASSES_TEXT,
  SIGN_IMAGE_HEIGHT,
  SIGN_IMAGE_WIDTH,
  assertGlassesLayout,
  glassesImageBox,
} from './signConstants';
import { slideToPngBytes, type SlideToPngOptions } from './signRender';
import { phraseToSlides, type PhraseToSlidesOptions, type SignSlide } from './signSlides';
import { slideDeckDelayAfterSlide } from './slideDeckTiming';

const ITEM_PREV = 'Prev';
const ITEM_NEXT = 'Next';
/** From first slide; restarts glasses autoplay when enabled. */
const ITEM_REPLAY = 'Replay';
const ITEM_CLEAR = 'Clear';
/** Opens a second row of common phrases (same snippets as phone quick-insert). */
const ITEM_PHRASES = 'Phrases';
const ITEM_EXIT = 'Exit';

const NAV_LIST_NAMES = [
  ITEM_PREV,
  ITEM_NEXT,
  ITEM_REPLAY,
  ITEM_CLEAR,
  ITEM_PHRASES,
  ITEM_EXIT,
] as const;

/** Labels on glasses (short) → phrase text (matches `index.html` data-snippet chips). */
const GLASS_PHRASE_CHIPS: readonly { label: string; phrase: string }[] = [
  { label: 'hello', phrase: 'hello' },
  { label: 'thanks', phrase: 'thank you' },
  { label: 'please', phrase: 'please' },
  { label: 'yes', phrase: 'yes' },
  { label: 'no', phrase: 'no' },
  { label: 'help', phrase: 'help' },
  { label: 'sorry', phrase: 'sorry' },
  { label: 'bath', phrase: 'bathroom' },
  { label: 'water', phrase: 'water' },
] as const;

const ITEM_PHRASE_BACK = 'Back';

const PHRASE_LIST_NAMES = [...GLASS_PHRASE_CHIPS.map((c) => c.label), ITEM_PHRASE_BACK] as const;

type GlassesMenuMode = 'nav' | 'phrases';

let glassesMenuMode: GlassesMenuMode = 'nav';

function listEventType(ev: { eventType?: OsEventTypeList }): OsEventTypeList {
  return ev.eventType ?? OsEventTypeList.CLICK_EVENT;
}

/**
 * Glasses list selection is sometimes reported by index only (e.g. vertical swipe /
 * scroll events), without `currentSelectItemName`. Map index to the same labels as
 * `itemName` on the list container.
 */
function glassesListNames(): readonly string[] {
  return glassesMenuMode === 'nav' ? NAV_LIST_NAMES : PHRASE_LIST_NAMES;
}

export function resolvedListItemName(list: {
  currentSelectItemName?: string;
  currentSelectItemIndex?: number;
}): string | undefined {
  const trimmed = list.currentSelectItemName?.trim();
  if (trimmed) return trimmed;
  const idx = list.currentSelectItemIndex;
  const names = glassesListNames();
  if (typeof idx !== 'number' || !Number.isFinite(idx) || idx < 0 || idx >= names.length) {
    return undefined;
  }
  return names[idx];
}

const CONTAINER_LIST = 'list-1';
const CONTAINER_TEXT = 'text-1';
const CONTAINER_IMG = 'img-1';

/** Last line shown in the glasses text strip (rebuild must not wipe it). */
let lastGlassesStatusText = 'Gloss';

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

/** Equal column width for the current list row (nav or phrases). */
function listItemWidthForCount(n: number): number {
  const L = GLASSES_LIST;
  const inner = Math.max(0, L.w - 2 * L.paddingLength);
  return Math.max(36, Math.floor(inner / Math.max(1, n)));
}

function navList(): ListContainerProperty {
  const L = GLASSES_LIST;
  const names = [...NAV_LIST_NAMES];
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
      itemWidth: listItemWidthForCount(names.length),
      isItemSelectBorderEn: 1,
      itemName: names,
    }),
    isEventCapture: 1,
  });
}

function phrasesList(): ListContainerProperty {
  const L = GLASSES_LIST;
  const names = [...PHRASE_LIST_NAMES];
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
      itemWidth: listItemWidthForCount(names.length),
      isItemSelectBorderEn: 1,
      itemName: names,
    }),
    isEventCapture: 1,
  });
}

async function rebuildGlassesMenu(mode: GlassesMenuMode): Promise<boolean> {
  const b = bridgeRef;
  if (!b) return false;
  const list = mode === 'nav' ? navList() : phrasesList();
  const ok = await b.rebuildPageContainer(
    new RebuildPageContainer({
      containerTotalNum: 3,
      listObject: [list],
      textObject: [textStatusContainer()],
      imageObject: [imageContainer()],
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

function imageContainer(): ImageContainerProperty {
  const I = glassesImageBox();
  return new ImageContainerProperty({
    xPosition: I.x,
    yPosition: I.y,
    width: I.width,
    height: I.height,
    containerID: 3,
    containerName: CONTAINER_IMG,
  });
}

function textStatusContainer(): TextContainerProperty {
  const T = GLASSES_TEXT;
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
    content: lastGlassesStatusText,
    isEventCapture: 0,
  });
}

function mainLayout(): CreateStartUpPageContainer {
  return new CreateStartUpPageContainer({
    containerTotalNum: 3,
    listObject: [navList()],
    textObject: [textStatusContainer()],
    imageObject: [imageContainer()],
  });
}

const GLASSES_STATUS_MAX = 72;

async function pushStatus(text: string) {
  const b = bridgeRef;
  if (!b) return;
  const content =
    text.length > GLASSES_STATUS_MAX ? text.slice(0, GLASSES_STATUS_MAX - 1) + '…' : text;
  lastGlassesStatusText = content;
  await b.textContainerUpgrade(
    new TextContainerUpgrade({
      containerID: 2,
      containerName: CONTAINER_TEXT,
      contentOffset: 0,
      contentLength: content.length,
      content,
    }),
  );
}

function enqueueImage(bytes: Uint8Array, epoch: number): Promise<void> {
  const b = bridgeRef;
  if (!b || bytes.length === 0) return Promise.resolve();
  sendChain = sendChain.then(async () => {
    if (epoch !== activePhraseEpoch) return;
    const res = await b.updateImageRawData(
      new ImageRawDataUpdate({
        containerID: 3,
        containerName: CONTAINER_IMG,
        imageData: bytes,
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
  const head = `${idx + 1}/${total}`;
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
      return clipStatus(slide.title, 20);
    default:
      return `${head} · ${clipStatus(slide.title, 20)}`;
  }
}

async function showSlide(i: number) {
  if (slides.length === 0) return;
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

export async function displayPhraseOnGlasses(phrase: string): Promise<GlassesPushResult> {
  if (!bridgeRef) {
    return { ok: false, error: 'No glasses bridge.' };
  }
  await sendChain;
  stopGlassesAutoplay();
  glassesAutoplaySessionPaused = false;
  glassesForceReplayAutoplay = false;
  if (glassesMenuMode !== 'nav') {
    await rebuildGlassesMenu('nav');
  }
  activePhraseEpoch++;
  slides = phraseToSlides(phrase, phraseSlideOptions);
  slideIndex = 0;
  pngCache.length = 0;
  sendChain = Promise.resolve();
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

  bridge.onEvenHubEvent((event) => {
    const list = event.listEvent;
    if (!list) return;
    const name = resolvedListItemName(list);
    if (!name) return;
    const evt = listEventType(list);

    if (evt === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      glassesForceReplayAutoplay = false;
      stopGlassesAutoplay();
      void bridge.shutDownPageContainer(1);
      return;
    }

    if (glassesMenuMode === 'phrases') {
      if (name === ITEM_PHRASE_BACK) {
        void rebuildGlassesMenu('nav');
        return;
      }
      const chip = GLASS_PHRASE_CHIPS.find((c) => c.label === name);
      if (chip) {
        void displayPhraseOnGlasses(chip.phrase);
      }
      return;
    }

    if (name === ITEM_EXIT) {
      glassesForceReplayAutoplay = false;
      stopGlassesAutoplay();
      void bridge.shutDownPageContainer(1);
      return;
    }
    if (name === ITEM_PREV) {
      glassesAutoplaySessionPaused = true;
      glassesForceReplayAutoplay = false;
      stopGlassesAutoplay();
      void showSlide(slideIndex - 1);
      return;
    }
    if (name === ITEM_NEXT) {
      glassesAutoplaySessionPaused = true;
      glassesForceReplayAutoplay = false;
      stopGlassesAutoplay();
      void showSlide(slideIndex + 1);
      return;
    }
    if (name === ITEM_REPLAY) {
      glassesAutoplaySessionPaused = false;
      glassesForceReplayAutoplay = true;
      stopGlassesAutoplay();
      void showSlide(0);
      return;
    }
    if (name === ITEM_CLEAR) {
      void displayPhraseOnGlasses('');
      return;
    }
    if (name === ITEM_PHRASES) {
      void rebuildGlassesMenu('phrases');
      return;
    }
  });

  const pushed = await displayPhraseOnGlasses('');
  if (!pushed.ok) {
    return { ok: false, error: pushed.error };
  }
  return { ok: true };
}
