import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk';
import { initEvenSignPage } from './evenSignPage';
import './style.css';

const BRIDGE_WAIT_MS = 4000;

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

  await initEvenSignPage({ bridge, bridgeAbsentReason });
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
      `<pre class="even-fallback-error">EvenSign: ${String(e)}</pre>`,
    );
  }
});
