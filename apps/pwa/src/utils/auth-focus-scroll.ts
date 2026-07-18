const AUTH_CONTROL_SELECTOR = [
  '.onboarding-step input',
  '.onboarding-step textarea',
  '.login-page-pwa input',
  '.login-page-pwa textarea',
].join(',');

/**
 * Maximum distance an authentication screen may be moved upward after an input
 * receives focus. Change this single value to tune the behaviour on device.
 */
export const AUTH_FOCUS_SCROLL_MAX_PX = 72;

interface FocusScrollDebug {
  rawPx: number;
  appliedPx: number;
  maxPx: number;
  source: 'window' | 'container';
}

type DebugWindow = Window & {
  __loveCheckAuthFocusScroll?: FocusScrollDebug;
};

interface ScrollSnapshot {
  control: HTMLInputElement | HTMLTextAreaElement;
  container: HTMLElement | null;
  containerTop: number;
  windowTop: number;
  capturedAt: number;
}

let initialized = false;
let snapshot: ScrollSnapshot | null = null;
let timers: number[] = [];

function isTextControl(target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement {
  if (target instanceof HTMLTextAreaElement) return true;
  if (!(target instanceof HTMLInputElement)) return false;
  return ['text', 'email', 'password', 'search', 'tel', 'url', 'number'].includes(target.type);
}

function getControl(target: EventTarget | null): HTMLInputElement | HTMLTextAreaElement | null {
  if (!(target instanceof Element)) return null;
  const control = target.closest<HTMLInputElement | HTMLTextAreaElement>(AUTH_CONTROL_SELECTOR);
  return control && isTextControl(control) ? control : null;
}

function getScrollContainer(control: HTMLElement): HTMLElement | null {
  return control.closest<HTMLElement>('.page-no-nav');
}

function capture(control: HTMLInputElement | HTMLTextAreaElement): void {
  const container = getScrollContainer(control);
  snapshot = {
    control,
    container,
    containerTop: container?.scrollTop ?? 0,
    windowTop: window.scrollY,
    capturedAt: performance.now(),
  };
}

function report(rawPx: number, appliedPx: number, source: 'window' | 'container'): void {
  const roundedRaw = Math.round(rawPx);
  const roundedApplied = Math.round(appliedPx);
  document.documentElement.dataset.authFocusScrollPx = String(roundedRaw);
  document.documentElement.dataset.authFocusScrollAppliedPx = String(roundedApplied);
  document.documentElement.style.setProperty('--auth-focus-scroll-px', `${roundedApplied}px`);
  (window as DebugWindow).__loveCheckAuthFocusScroll = {
    rawPx: roundedRaw,
    appliedPx: roundedApplied,
    maxPx: AUTH_FOCUS_SCROLL_MAX_PX,
    source,
  };
}

function clampFocusedScroll(): void {
  const current = snapshot;
  if (!current || document.activeElement !== current.control) return;

  const containerDelta = current.container
    ? current.container.scrollTop - current.containerTop
    : 0;
  const windowDelta = window.scrollY - current.windowTop;

  const useContainer = Math.abs(containerDelta) >= Math.abs(windowDelta);
  const rawPx = useContainer ? containerDelta : windowDelta;
  const appliedPx = Math.max(-AUTH_FOCUS_SCROLL_MAX_PX, Math.min(AUTH_FOCUS_SCROLL_MAX_PX, rawPx));

  if (Math.abs(rawPx - appliedPx) > 1) {
    if (useContainer && current.container) {
      current.container.scrollTo({ top: current.containerTop + appliedPx, behavior: 'auto' });
    } else {
      window.scrollTo({ top: current.windowTop + appliedPx, behavior: 'auto' });
    }
  }

  report(rawPx, appliedPx, useContainer ? 'container' : 'window');
}

function scheduleClamp(): void {
  timers.forEach((timer) => window.clearTimeout(timer));
  timers = [0, 80, 180, 320, 520].map((delay) =>
    window.setTimeout(clampFocusedScroll, delay),
  );
}

export function initAuthFocusScroll(): void {
  if (initialized) return;
  initialized = true;

  // Capture before the browser starts its native keyboard avoidance scroll.
  document.addEventListener('pointerdown', (event) => {
    const control = getControl(event.target);
    if (control) capture(control);
  }, true);

  document.addEventListener('focusin', (event) => {
    const control = getControl(event.target);
    if (!control) return;

    if (!snapshot || snapshot.control !== control || performance.now() - snapshot.capturedAt > 700) {
      capture(control);
    }
    scheduleClamp();
  }, true);

  window.visualViewport?.addEventListener('resize', scheduleClamp);
  window.visualViewport?.addEventListener('scroll', scheduleClamp);
}
