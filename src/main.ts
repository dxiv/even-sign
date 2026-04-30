import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk';
import { initGlossPage } from './glossPage';
import './style.css';

const BRIDGE_WAIT_MS = 4000;

/** Marketing / store screenshot: hero only, no hub card (`?shot` or `?screenshot`). */
function applyScreenshotModeClass(): void {
  const q = new URLSearchParams(window.location.search);
  if (q.has('shot') || q.has('screenshot')) {
    document.documentElement.classList.add('ev-screenshot-mode');
  }
}
applyScreenshotModeClass();

function forceBrowserOnly(): boolean {
  return new URLSearchParams(window.location.search).has('pc');
}

async function main() {
  const loading = document.getElementById('loading-line');

  let bridge: Awaited<ReturnType<typeof waitForEvenAppBridge>> | null = null;
  let bridgeAbsentReason: 'browser' | 'timeout' | undefined;

  if (forceBrowserOnly()) {
    bridgeAbsentReason = 'browser';
  } else {
    const raced = await Promise.race([
      waitForEvenAppBridge().then((b) => ({ kind: 'bridge' as const, b })),
      new Promise<{ kind: 'timeout' }>((resolve) =>
        setTimeout(() => resolve({ kind: 'timeout' }), BRIDGE_WAIT_MS),
      ),
    ]);
    if (raced.kind === 'timeout') {
      bridgeAbsentReason = 'timeout';
    } else {
      bridge = raced.b;
    }
  }

  if (loading) loading.remove();

  await initGlossPage({ bridge, bridgeAbsentReason });
}

void main().catch((e) => {
  document.getElementById('loading-line')?.remove();
  const panel = document.getElementById('ev-sign-panel');
  const out = document.getElementById('ev-sign-out');
  if (panel) panel.hidden = false;
  if (out) {
    out.textContent = `Startup error: ${e instanceof Error ? e.message : String(e)}`;
    out.classList.add('even-out--error');
  } else {
    document.body.insertAdjacentHTML(
      'beforeend',
      `<pre class="even-fallback-error">Gloss: ${String(e)}</pre>`,
    );
  }
});
