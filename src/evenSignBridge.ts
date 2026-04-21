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

const ITEM_PREV = 'Prev';
const ITEM_NEXT = 'Next';
const ITEM_CLOSE = 'Close';
const ITEM_YES = 'Yes';
const ITEM_NO = 'No';

type NavMode = 'slides' | 'exitConfirm';

function listEventType(ev: { eventType?: OsEventTypeList }): OsEventTypeList {
  return ev.eventType ?? OsEventTypeList.CLICK_EVENT;
}

const CONTAINER_LIST = 'list-1';
const CONTAINER_TEXT = 'text-1';
const CONTAINER_IMG = 'img-1';

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

let navMode: NavMode = 'slides';

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
      return 'Glasses rejected the UI layout. Reload this hub page in the Even app, then open EvenSign again.';
    case StartUpPageCreateResult.oversize:
      return 'Glasses UI layout too large for the device.';
    case StartUpPageCreateResult.outOfMemory:
      return 'Glasses out of memory creating the UI.';
    default:
      return `Could not start glasses UI (code ${String(code)}).`;
  }
}

function navList(mode: NavMode): ListContainerProperty {
  const isExit = mode === 'exitConfirm';
  const L = GLASSES_LIST;
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
      itemCount: isExit ? 2 : 3,
      itemWidth: 0,
      isItemSelectBorderEn: 1,
      itemName: isExit ? [ITEM_YES, ITEM_NO] : [ITEM_PREV, ITEM_NEXT, ITEM_CLOSE],
    }),
    isEventCapture: 1,
  });
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

function textStatusContainer(initialContent = 'EvenSign'): TextContainerProperty {
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
    content: initialContent,
    isEventCapture: 0,
  });
}

function mainLayout(): CreateStartUpPageContainer {
  return new CreateStartUpPageContainer({
    containerTotalNum: 3,
    listObject: [navList('slides')],
    textObject: [textStatusContainer()],
    imageObject: [imageContainer()],
  });
}

async function rebuildNavMode(mode: NavMode): Promise<boolean> {
  const b = bridgeRef;
  if (!b) return false;
  const ok = await b.rebuildPageContainer(
    new RebuildPageContainer({
      containerTotalNum: 3,
      listObject: [navList(mode)],
      textObject: [textStatusContainer()],
      imageObject: [imageContainer()],
    }),
  );
  if (!ok) {
    console.warn('rebuildPageContainer returned false');
    await pushStatus('Could not update glasses buttons.');
  }
  return ok;
}

async function enterExitConfirm(): Promise<void> {
  const b = bridgeRef;
  if (!b || navMode === 'exitConfirm') return;
  navMode = 'exitConfirm';
  const ok = await rebuildNavMode('exitConfirm');
  if (!ok) {
    navMode = 'slides';
    return;
  }
  await pushStatus('Exit? Double-tap Yes · No=cancel');
}

async function leaveExitConfirm(): Promise<void> {
  const b = bridgeRef;
  if (!b || navMode !== 'exitConfirm') return;
  navMode = 'slides';
  const ok = await rebuildNavMode('slides');
  if (!ok) {
    navMode = 'exitConfirm';
    return;
  }
  if (slides.length === 0) {
    await pushStatus('EvenSign');
    return;
  }
  await showSlide(slideIndex);
}

async function pushStatus(text: string) {
  const b = bridgeRef;
  if (!b) return;
  const content = text.length > 900 ? text.slice(0, 897) + '…' : text;
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
      await pushStatus('Image did not reach glasses.');
    }
  });
  return sendChain;
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
    await pushStatus(`Slide error · ${slide.title}`);
    return;
  }
  await enqueueImage(bytes, epoch);
  if (epoch !== activePhraseEpoch) return;
  const parts: string[] = [`${slideIndex + 1}/${slides.length}`];
  if (slide.kind === 'word') {
    parts.push('word sign');
    parts.push(slide.title);
  } else if (slide.kind === 'letter') {
    parts.push(`letter ${slide.title}`);
    if (slide.spellOf) {
      parts.push(`spell ${slide.spellOf}`);
    }
  } else if (slide.kind === 'digit') {
    parts.push(`number ${slide.title}`);
    if (slide.spellOf) {
      parts.push(`spell ${slide.spellOf}`);
    }
  } else if (slide.kind === 'placeholder') {
    parts.push(slide.title);
  } else {
    parts.push(slide.title);
  }
  await pushStatus(parts.join(' · '));
}

export async function displayPhraseOnGlasses(phrase: string): Promise<GlassesPushResult> {
  if (!bridgeRef) {
    return { ok: false, error: 'No glasses bridge.' };
  }
  await sendChain;
  activePhraseEpoch++;
  if (navMode === 'exitConfirm') {
    navMode = 'slides';
    await rebuildNavMode('slides');
  }
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
  await showSlide(slideIndex + delta);
}

export async function runEvenSignOnBridge(bridge: EvenAppBridge): Promise<GlassesUiInitResult> {
  bridgeRef = bridge;
  navMode = 'slides';
  assertGlassesLayout();
  if (import.meta.env.DEV) {
    console.info(`[EvenSign] G2 slide PNG ${SIGN_IMAGE_WIDTH}×${SIGN_IMAGE_HEIGHT}`);
  }
  const created = await bridge.createStartUpPageContainer(mainLayout());
  if (created !== StartUpPageCreateResult.success) {
    if (import.meta.env.DEV) {
      console.error('createStartUpPageContainer', created);
    }
    bridgeRef = null;
    return { ok: false, error: startupFailureMessage(created) };
  }

  bridge.onEvenHubEvent((event) => {
    const list = event.listEvent;
    if (!list?.currentSelectItemName) return;
    const name = list.currentSelectItemName;
    const evt = listEventType(list);

    if (navMode === 'exitConfirm') {
      if (name === ITEM_NO) {
        void leaveExitConfirm();
        return;
      }
      if (name === ITEM_YES) {
        if (evt === OsEventTypeList.DOUBLE_CLICK_EVENT) {
          void bridge.shutDownPageContainer(0);
        } else {
          void pushStatus('Double-tap Yes to exit · No=cancel');
        }
        return;
      }
      return;
    }

    if (name === ITEM_CLOSE) {
      void enterExitConfirm();
      return;
    }
    if (name === ITEM_PREV) {
      void showSlide(slideIndex - 1);
      return;
    }
    if (name === ITEM_NEXT) {
      void showSlide(slideIndex + 1);
    }
  });

  const pushed = await displayPhraseOnGlasses('');
  if (!pushed.ok) {
    return { ok: false, error: pushed.error };
  }
  return { ok: true };
}
