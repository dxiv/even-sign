import type { EvenAppBridge } from '@evenrealities/even_hub_sdk';

const SESSION_KEY = 'gloss_sim_exit_parity';
const QUERY_ON = 'simExitParity';
const OVERLAY_CLASS = 'ev-sim-exit-parity';

/**
 * Even Hub simulator often does not draw the real phone “exit app?” sheet after
 * `shutDownPageContainer(1)`. Production and real devices still use that call only.
 *
 * When enabled (see `initSimExitParityFromUrl`), after every successful `shutDownPageContainer(1)`
 * we show a small in-page layer so flows match what you can assert in QA: gesture → bridge → user
 * confirms leaving → optional `shutDownPageContainer(0)` for hosts that need it.
 */
export function initSimExitParityFromUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get(QUERY_ON) === '1') sessionStorage.setItem(SESSION_KEY, '1');
    if (q.get(QUERY_ON) === '0') sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* private mode / no storage */
  }
}

export function isSimExitParitySession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function removeExistingOverlay(): void {
  document.querySelectorAll(`.${OVERLAY_CLASS}`).forEach((n) => n.remove());
}

/**
 * Call after `await shutDownPageContainer(1)` when sim parity mode is on.
 */
export function offerHubExitSimulatorParityUi(bridge: EvenAppBridge): void {
  if (typeof document === 'undefined') return;
  removeExistingOverlay();

  const root = document.createElement('div');
  root.className = OVERLAY_CLASS;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'ev-sim-exit-parity-title');

  root.innerHTML = `
    <div class="${OVERLAY_CLASS}__panel mono">
      <p id="ev-sim-exit-parity-title" class="${OVERLAY_CLASS}__title">Simulator · Gloss exit</p>
      <p class="${OVERLAY_CLASS}__body">
        The real Even app shows a system sheet here. The desktop simulator often does not.
        Production still only calls <code class="${OVERLAY_CLASS}__code">shutDownPageContainer(1)</code> — same as above.
      </p>
      <div class="${OVERLAY_CLASS}__actions">
        <button type="button" class="${OVERLAY_CLASS}__btn ${OVERLAY_CLASS}__btn--ghost" data-ev-sim-act="stay">Stay</button>
        <button type="button" class="${OVERLAY_CLASS}__btn" data-ev-sim-act="force">Leave app (shutDown 0)</button>
      </div>
      <p class="${OVERLAY_CLASS}__hint">Clear with URL <code class="${OVERLAY_CLASS}__code">?${QUERY_ON}=0</code></p>
    </div>
  `;

  root.addEventListener('click', (e) => {
    const actBtn = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-ev-sim-act]');
    if (actBtn?.dataset.evSimAct === 'force') {
      root.remove();
      void bridge.shutDownPageContainer(0);
      return;
    }
    if (actBtn?.dataset.evSimAct === 'stay') {
      root.remove();
      return;
    }
    root.remove();
  });
  document.body.appendChild(root);
}
