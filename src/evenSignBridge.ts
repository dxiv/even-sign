import {
  type EvenAppBridge,
  CreateStartUpPageContainer,
  ImageContainerProperty,
  ImageRawDataUpdate,
  ImageRawDataUpdateResult,
  ListContainerProperty,
  ListItemContainerProperty,
  StartUpPageCreateResult,
  TextContainerProperty,
  TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk';
import { SIGN_IMAGE_HEIGHT, SIGN_IMAGE_WIDTH, slideToPngBytes } from './signRender';
import { phraseToSlides, type PhraseToSlidesOptions, type SignSlide } from './signSlides';

const ITEM_PREV = 'Prev';
const ITEM_NEXT = 'Next';
const ITEM_CLOSE = 'Close';

const CONTAINER_LIST = 'list-1';
const CONTAINER_TEXT = 'text-1';
const CONTAINER_IMG = 'img-1';

let bridgeRef: EvenAppBridge | null = null;
let slides: SignSlide[] = [];
let slideIndex = 0;
const pngCache: Uint8Array[] = [];
let sendChain: Promise<void> = Promise.resolve();

let phraseSlideOptions: PhraseToSlidesOptions = {};

export function setPhraseSlideOptions(opts: PhraseToSlidesOptions): void {
  phraseSlideOptions = { ...opts };
}

export function getPhraseSlideOptions(): PhraseToSlidesOptions {
  return { ...phraseSlideOptions };
}

function mainLayout(): CreateStartUpPageContainer {
  const listContainer = new ListContainerProperty({
    xPosition: 40,
    yPosition: 18,
    width: 496,
    height: 56,
    borderWidth: 2,
    borderColor: 5,
    borderRadius: 5,
    paddingLength: 6,
    containerID: 1,
    containerName: CONTAINER_LIST,
    itemContainer: new ListItemContainerProperty({
      itemCount: 3,
      itemWidth: 0,
      isItemSelectBorderEn: 1,
      itemName: [ITEM_PREV, ITEM_NEXT, ITEM_CLOSE],
    }),
    isEventCapture: 1,
  });

  const imageContainer = new ImageContainerProperty({
    xPosition: Math.round((576 - SIGN_IMAGE_WIDTH) / 2),
    yPosition: 84,
    width: SIGN_IMAGE_WIDTH,
    height: SIGN_IMAGE_HEIGHT,
    containerID: 3,
    containerName: CONTAINER_IMG,
  });

  const textContainer = new TextContainerProperty({
    xPosition: 40,
    yPosition: 218,
    width: 496,
    height: 58,
    borderWidth: 1,
    borderColor: 0,
    borderRadius: 3,
    paddingLength: 5,
    containerID: 2,
    containerName: CONTAINER_TEXT,
    content: 'EvenSign',
    isEventCapture: 0,
  });

  return new CreateStartUpPageContainer({
    containerTotalNum: 3,
    listObject: [listContainer],
    textObject: [textContainer],
    imageObject: [imageContainer],
  });
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

function enqueueImage(bytes: Uint8Array): Promise<void> {
  const b = bridgeRef;
  if (!b || bytes.length === 0) return Promise.resolve();
  sendChain = sendChain.then(async () => {
    const res = await b.updateImageRawData(
      new ImageRawDataUpdate({
        containerID: 3,
        containerName: CONTAINER_IMG,
        imageData: bytes,
      }),
    );
    if (import.meta.env.DEV && !ImageRawDataUpdateResult.isSuccess(res)) {
      console.warn('updateImageRawData', res);
    }
  });
  return sendChain;
}

async function showSlide(i: number) {
  if (slides.length === 0) return;
  const clamped = Math.max(0, Math.min(i, slides.length - 1));
  slideIndex = clamped;
  const slide = slides[slideIndex];

  if (!pngCache[slideIndex]) {
    pngCache[slideIndex] = await slideToPngBytes(slide);
  }
  const bytes = pngCache[slideIndex];
  await enqueueImage(bytes);
  await pushStatus(`${slideIndex + 1}/${slides.length} ${slide.title}`);
}

export async function displayPhraseOnGlasses(phrase: string): Promise<void> {
  if (!bridgeRef) return;
  slides = phraseToSlides(phrase, phraseSlideOptions);
  slideIndex = 0;
  pngCache.length = 0;
  sendChain = Promise.resolve();
  await showSlide(0);
}

export async function runEvenSignOnBridge(bridge: EvenAppBridge): Promise<void> {
  bridgeRef = bridge;
  const created = await bridge.createStartUpPageContainer(mainLayout());
  if (created !== StartUpPageCreateResult.success) {
    if (import.meta.env.DEV) {
      console.error('createStartUpPageContainer', created);
    }
    return;
  }

  bridge.onEvenHubEvent((event) => {
    const name = event.listEvent?.currentSelectItemName;
    if (!name) return;
    if (name === ITEM_CLOSE) {
      void bridge.shutDownPageContainer(0);
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

  await displayPhraseOnGlasses('');
}
