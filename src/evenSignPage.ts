import type { EvenAppBridge } from '@evenrealities/even_hub_sdk';
import {
  displayPhraseOnGlasses,
  runEvenSignOnBridge,
  setPhraseSlideOptions,
} from './evenSignBridge';
import { phraseToSlides, type PhraseToSlidesOptions } from './signSlides';
import { slideToPngBytes } from './signRender';

type InitOpts = {
  bridge: EvenAppBridge | null;
};

function getSpeechRecognition(): SpeechRecognition | null {
  const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

function slideOptsFromUI(): PhraseToSlidesOptions {
  const compact = document.getElementById('ev-sign-compact') as HTMLInputElement | null;
  return { compactGlossary: compact?.checked === true };
}

function previewAnimEnabled(): boolean {
  const el = document.getElementById('ev-sign-anim') as HTMLInputElement | null;
  return el?.checked === true;
}

let previewTimer = 0;

function stopPreviewAnim(): void {
  if (previewTimer) {
    clearInterval(previewTimer);
    previewTimer = 0;
  }
}

async function updateLocalPreviewSingle(
  phrase: string,
  img: HTMLImageElement | null,
  slideOpts: PhraseToSlidesOptions,
  slideIdx: number,
): Promise<void> {
  if (!img) return;
  const slides = phraseToSlides(phrase, slideOpts);
  if (slides.length === 0) return;
  const s = slides[slideIdx % slides.length];
  const bytes = await slideToPngBytes(s);
  const blob = new Blob([bytes], { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  const prev = img.dataset.blobUrl;
  if (prev) URL.revokeObjectURL(prev);
  img.dataset.blobUrl = url;
  img.src = url;
  img.alt = s.title;
}

async function runLocalPreview(phrase: string, img: HTMLImageElement | null): Promise<void> {
  stopPreviewAnim();
  const slideOpts = slideOptsFromUI();
  const slides = phraseToSlides(phrase || ' ', slideOpts);
  const label = document.getElementById('ev-sign-preview-label');

  if (!img) return;

  if (!previewAnimEnabled() || slides.length <= 1) {
    await updateLocalPreviewSingle(phrase || ' ', img, slideOpts, 0);
    if (label) {
      label.textContent =
        slides.length > 1 ? `preview · slide 1 of ${slides.length}` : 'preview';
    }
    return;
  }

  let idx = 0;
  const tick = async () => {
    await updateLocalPreviewSingle(phrase || ' ', img, slideOpts, idx);
    if (label) label.textContent = `preview · animate ${idx + 1}/${slides.length}`;
    idx = (idx + 1) % slides.length;
  };
  await tick();
  previewTimer = window.setInterval(() => void tick(), 1000);
}

export async function initEvenSignPage(opts: InitOpts): Promise<void> {
  const { bridge } = opts;
  const panel = document.getElementById('ev-sign-panel');
  const ta = document.getElementById('ev-sign-input') as HTMLTextAreaElement | null;
  const btnSend = document.getElementById('ev-sign-send') as HTMLButtonElement | null;
  const btnSpeak = document.getElementById('ev-sign-speak') as HTMLButtonElement | null;
  const preview = document.getElementById('ev-sign-preview') as HTMLImageElement | null;
  const out = document.getElementById('ev-sign-out') as HTMLPreElement | null;
  const chkCompact = document.getElementById('ev-sign-compact') as HTMLInputElement | null;
  const chkAnim = document.getElementById('ev-sign-anim') as HTMLInputElement | null;

  if (panel) panel.hidden = false;

  const log = (s: string) => {
    if (out) out.textContent = s;
  };

  if (bridge) {
    await runEvenSignOnBridge(bridge);
    log('Glasses UI ready · Prev/Next/Close on device · send phrases from here.');
  } else {
    log('No Even bridge (open in Even app or use ?pc=1 for browser-only preview).');
  }

  const refreshPreview = () => void runLocalPreview(ta?.value || ' ', preview);

  const send = async () => {
    const text = ta?.value?.trim() ?? '';
    const slideOpts = slideOptsFromUI();
    setPhraseSlideOptions(slideOpts);
    if (bridge) {
      await displayPhraseOnGlasses(text);
    }
    await runLocalPreview(text || ' ', preview);
    const n = phraseToSlides(text || ' ', slideOpts).length;
    log(bridge ? `Sent ${n} slide(s) to glasses.` : `Preview · ${n} slide(s) · add bridge to push to G2.`);
  };

  btnSend?.addEventListener('click', () => void send());

  chkCompact?.addEventListener('change', refreshPreview);
  chkAnim?.addEventListener('change', refreshPreview);

  let rec: SpeechRecognition | null = null;
  btnSpeak?.addEventListener('click', () => {
    const R = getSpeechRecognition();
    if (!R) {
      log('Speech input needs Chrome/Edge Web Speech API.');
      return;
    }
    if (rec) {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
      rec = null;
      btnSpeak.textContent = 'Speak';
      return;
    }
    rec = R;
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (ev) => {
      const t = ev.results[0]?.[0]?.transcript?.trim() ?? '';
      if (ta && t) ta.value = t;
      btnSpeak.textContent = 'Speak';
      rec = null;
      void send();
    };
    rec.onerror = () => {
      btnSpeak.textContent = 'Speak';
      rec = null;
      log('Speech recognition error — try typing instead.');
    };
    rec.onend = () => {
      if (btnSpeak.textContent === 'Stop') btnSpeak.textContent = 'Speak';
      rec = null;
    };
    btnSpeak.textContent = 'Stop';
    try {
      rec.start();
      log('Listening…');
    } catch {
      btnSpeak.textContent = 'Speak';
      log('Could not start microphone.');
    }
  });

  if (ta) {
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        void send();
      }
    });
  }

  await refreshPreview();
}
