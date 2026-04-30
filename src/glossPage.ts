import type { EvenAppBridge } from '@evenrealities/even_hub_sdk';
import {
  displayPhraseOnGlasses,
  getGlassesSlideIndex,
  glassesNavRelative,
  runGlossOnBridge,
  setGlassesAutoplayPreference,
  setPhraseSlideOptions,
  setSlideToPngOptions,
  stopGlassesAutoplay,
} from './glossBridge';
import { phraseToSlides, type PhraseToSlidesOptions } from './signSlides';
import { slideDeckDelayAfterSlide } from './slideDeckTiming';
import { slideToPngBytes, type SlideToPngOptions } from './signRender';

type InitOpts = {
  bridge: EvenAppBridge | null;
  /** When `bridge` is null, why (clearer than a generic “no bridge” line). */
  bridgeAbsentReason?: 'browser' | 'timeout';
};

type PreviewEls = {
  img: HTMLImageElement | null;
  placeholder: HTMLElement | null;
  label: HTMLElement | null;
};

const LS_COMPACT = 'gloss_compact';
const LS_CAPTIONS = 'gloss_captions';

function getSpeechRecognition(): SpeechRecognition | null {
  const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

function slideOptsFromUI(): PhraseToSlidesOptions {
  const compact = document.getElementById('ev-sign-compact') as HTMLInputElement | null;
  return { compactGlossary: compact?.checked === true };
}

function slideToPngOptsFromUI(): SlideToPngOptions {
  const cap = document.getElementById('ev-sign-captions') as HTMLInputElement | null;
  return { showCaptions: cap?.checked !== false };
}

function syncBridgeRenderingFromUi(): void {
  setPhraseSlideOptions(slideOptsFromUI());
  setSlideToPngOptions(slideToPngOptsFromUI());
}

function applyStoredToggle(el: HTMLInputElement | null, key: string, defaultOn: boolean): void {
  if (!el) return;
  try {
    const raw = localStorage.getItem(key);
    if (raw === '0') el.checked = false;
    else if (raw === '1') el.checked = true;
    else el.checked = defaultOn;
  } catch {
    el.checked = defaultOn;
  }
}

function persistToggle(key: string, checked: boolean): void {
  try {
    localStorage.setItem(key, checked ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function insertSnippet(ta: HTMLTextAreaElement, snippet: string): void {
  const s = snippet.trim();
  if (!s) return;
  const start = ta.selectionStart ?? ta.value.length;
  const end = ta.selectionEnd ?? ta.value.length;
  const before = ta.value.slice(0, start);
  const after = ta.value.slice(end);
  const pad = before.length > 0 && !/\s$/.test(before) ? ' ' : '';
  const insert = `${pad}${s}`;
  ta.value = before + insert + after;
  const caret = (before + insert).length;
  ta.selectionStart = ta.selectionEnd = caret;
  ta.focus();
}

function previewAnimEnabled(): boolean {
  const el = document.getElementById('ev-sign-anim') as HTMLInputElement | null;
  return el?.checked === true;
}

let previewTimer = 0;
let previewAnimGen = 0;

function stopPreviewAnim(): void {
  if (previewTimer) {
    clearTimeout(previewTimer);
    previewTimer = 0;
  }
}

function clearPreviewImage(img: HTMLImageElement | null): void {
  if (!img) return;
  const prev = img.dataset.blobUrl;
  if (prev) URL.revokeObjectURL(prev);
  delete img.dataset.blobUrl;
  img.removeAttribute('src');
  img.alt = '';
}

async function updateLocalPreviewSingle(
  phrase: string,
  img: HTMLImageElement | null,
  slideOpts: PhraseToSlidesOptions,
  slideIdx: number,
  pngOpts: SlideToPngOptions,
): Promise<void> {
  if (!img) return;
  const slides = phraseToSlides(phrase, slideOpts);
  if (slides.length === 0) return;
  const s = slides[slideIdx % slides.length];
  const bytes = await slideToPngBytes(s, pngOpts);
  const blob = new Blob([bytes], { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  const prev = img.dataset.blobUrl;
  if (prev) URL.revokeObjectURL(prev);
  img.dataset.blobUrl = url;
  img.src = url;
  img.alt = s.title;
}

async function runLocalPreview(rawInput: string, els: PreviewEls): Promise<void> {
  stopPreviewAnim();
  previewAnimGen++;
  const gen = previewAnimGen;

  const { img, placeholder, label } = els;
  if (!img) return;

  const text = rawInput.trim();

  if (text === '') {
    clearPreviewImage(img);
    img.hidden = true;
    if (placeholder) placeholder.hidden = false;
    if (label) label.textContent = 'Preview';
    return;
  }

  if (placeholder) placeholder.hidden = true;
  img.hidden = false;

  const slideOpts = slideOptsFromUI();
  const pngOpts = slideToPngOptsFromUI();
  const slides = phraseToSlides(text, slideOpts);

  if (!previewAnimEnabled() || slides.length <= 1) {
    await updateLocalPreviewSingle(text, img, slideOpts, 0, pngOpts);
    if (label) {
      label.textContent =
        slides.length > 1
          ? `Preview · slide 1 of ${slides.length} · enable Animate to auto-play, or Alt+←/→ after Send`
          : 'Preview';
    }
    return;
  }

  let idx = 0;
  const step = async (): Promise<void> => {
    if (gen !== previewAnimGen) return;
    await updateLocalPreviewSingle(text, img, slideOpts, idx, pngOpts);
    if (gen !== previewAnimGen) return;
    const s = slides[idx % slides.length];
    const kindHint =
      s.kind === 'word' ? 'word' : s.kind === 'letter' ? 'letter' : s.kind === 'digit' ? 'number' : s.kind;
    if (label) {
      label.textContent = `Preview · ${idx + 1}/${slides.length} · ${kindHint}`;
    }
    const delay = slideDeckDelayAfterSlide(slides, idx);
    idx = (idx + 1) % slides.length;
    previewTimer = window.setTimeout(() => void step(), delay);
  };
  await step();
}

function logLine(out: HTMLPreElement | null, message: string, error: boolean): void {
  if (!out) return;
  out.textContent = message;
  out.classList.toggle('even-out--error', error);
}

export async function initGlossPage(opts: InitOpts): Promise<void> {
  const { bridge, bridgeAbsentReason } = opts;
  const panel = document.getElementById('ev-sign-panel');
  const ta = document.getElementById('ev-sign-input') as HTMLTextAreaElement | null;
  const btnSend = document.getElementById('ev-sign-send') as HTMLButtonElement | null;
  const btnSpeak = document.getElementById('ev-sign-speak') as HTMLButtonElement | null;
  const preview = document.getElementById('ev-sign-preview') as HTMLImageElement | null;
  const placeholder = document.getElementById('ev-sign-preview-placeholder');
  const label = document.getElementById('ev-sign-preview-label');
  const out = document.getElementById('ev-sign-out') as HTMLPreElement | null;
  const chkCompact = document.getElementById('ev-sign-compact') as HTMLInputElement | null;
  const chkCaptions = document.getElementById('ev-sign-captions') as HTMLInputElement | null;
  const chkAnim = document.getElementById('ev-sign-anim') as HTMLInputElement | null;
  const quickRow = document.getElementById('ev-sign-quick');

  const previewEls: PreviewEls = { img: preview, placeholder, label };

  if (panel) panel.hidden = false;

  applyStoredToggle(chkCompact, LS_COMPACT, false);
  applyStoredToggle(chkCaptions, LS_CAPTIONS, true);
  syncBridgeRenderingFromUi();

  const log = (s: string) => logLine(out, s, false);
  const logErr = (s: string) => logLine(out, s, true);

  let glassesUiOk = false;

  if (bridge) {
    const started = await runGlossOnBridge(bridge);
    if (started.ok) {
      glassesUiOk = true;
      log(
        'Ready. G2: Prev · Next · Replay · Clear · Phrases · Exit. Send replaces the deck. Double-tap list or Exit to leave.',
      );
    } else {
      logErr(started.error);
    }
  } else if (bridgeAbsentReason === 'browser') {
    log('Preview only (?pc=1). Open from the Even app to send to glasses.');
  } else if (bridgeAbsentReason === 'timeout') {
    logErr(
      'Even bridge did not connect in time. Open this page inside the Even app, or use ?pc=1 for preview only.',
    );
  } else {
    log('Open in the Even app for glasses, or add ?pc=1 to try the UI in a browser.');
  }

  const refreshPreview = () => void runLocalPreview(ta?.value ?? '', previewEls);

  const send = async () => {
    if (btnSend?.dataset.sending === '1') return;
    if (btnSend) {
      btnSend.dataset.sending = '1';
      btnSend.disabled = true;
    }
    try {
      const text = ta?.value?.trim() ?? '';
      syncBridgeRenderingFromUi();
      setGlassesAutoplayPreference(previewAnimEnabled());

      let statusErr: string | null = null;
      if (bridge && glassesUiOk) {
        const pushed = await displayPhraseOnGlasses(text);
        if (!pushed.ok) statusErr = pushed.error;
      } else if (bridge && !glassesUiOk) {
        statusErr = 'Glasses UI did not finish starting; preview updated only.';
      }

      await runLocalPreview(text, previewEls);
      const n = phraseToSlides(text || ' ', slideOptsFromUI()).length;

      if (statusErr) {
        logErr(statusErr);
      } else if (bridge && glassesUiOk) {
        log(
          n > 1 && previewAnimEnabled()
            ? `Sent ${n} slide(s) to your glasses — auto-advancing (same timing as Animate preview).`
            : `Sent ${n} slide(s) to your glasses.`,
        );
      } else {
        log(`Preview updated · ${n} slide(s).`);
      }
    } finally {
      if (btnSend) {
        btnSend.dataset.sending = '0';
        btnSend.disabled = false;
      }
    }
  };

  btnSend?.addEventListener('click', () => void send());

  chkCompact?.addEventListener('change', () => {
    persistToggle(LS_COMPACT, chkCompact.checked);
    syncBridgeRenderingFromUi();
    refreshPreview();
  });
  chkCaptions?.addEventListener('change', () => {
    persistToggle(LS_CAPTIONS, chkCaptions.checked);
    syncBridgeRenderingFromUi();
    refreshPreview();
  });
  chkAnim?.addEventListener('change', () => {
    setGlassesAutoplayPreference(previewAnimEnabled());
    if (!previewAnimEnabled()) stopGlassesAutoplay();
    refreshPreview();
  });

  ta?.addEventListener('input', refreshPreview);

  if (quickRow && ta) {
    quickRow.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('button[data-snippet]');
      if (!t || !(t instanceof HTMLButtonElement)) return;
      const snippet = t.dataset.snippet;
      if (!snippet) return;
      insertSnippet(ta, snippet);
      refreshPreview();
    });
  }

  let rec: SpeechRecognition | null = null;
  btnSpeak?.addEventListener('click', () => {
    const R = getSpeechRecognition();
    if (!R) {
      log('Speech needs a browser with the Web Speech API (e.g. Chrome or Edge).');
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
      log('Speech recognition failed — try typing instead.');
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
      log('Could not start the microphone.');
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

  const onHubKeynav = (e: KeyboardEvent) => {
    if (!e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    const target = e.target;
    if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) return;
    e.preventDefault();
    void (async () => {
      await glassesNavRelative(e.key === 'ArrowLeft' ? -1 : 1);
      const phrase = ta?.value?.trim() ?? '';
      if (!phrase || !preview) return;
      const so = slideOptsFromUI();
      const po = slideToPngOptsFromUI();
      const sl = phraseToSlides(phrase, so);
      if (sl.length === 0) return;
      await updateLocalPreviewSingle(phrase, preview, so, getGlassesSlideIndex() % sl.length, po);
      if (label) {
        label.textContent = `Preview · ${getGlassesSlideIndex() + 1}/${sl.length} (glasses)`;
      }
    })();
  };
  document.addEventListener('keydown', onHubKeynav);

  await refreshPreview();
}
