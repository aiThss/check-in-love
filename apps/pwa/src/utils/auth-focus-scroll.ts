const AUTH_CONTROL_SELECTOR = [
  '.onboarding-step input',
  '.onboarding-step textarea',
  '.login-page-pwa input',
  '.login-page-pwa textarea',
].join(',');

const AUTH_STEP_SELECTOR = '.onboarding-step, .auth-shell';
const AUTH_STEP_ACTION_SELECTOR = [
  '.onboarding-step .btn-primary',
  '.onboarding-step .btn-icon',
  '.login-page-pwa #back-btn',
  '.login-page-pwa #go-onboarding-btn',
  '.login-page-pwa .btn-primary',
].join(',');

/**
 * Maximum distance an authentication screen may be moved upward after an input
 * receives focus. Change this single value to tune the behaviour on device.
 */
export const AUTH_FOCUS_SCROLL_MAX_PX = 40;

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
let clampTimers: number[] = [];
let resetTimers: number[] = [];

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
  clampTimers.forEach((timer) => window.clearTimeout(timer));
  clampTimers = [0, 80, 180, 320, 520].map((delay) =>
    window.setTimeout(clampFocusedScroll, delay),
  );
}

function resetAuthScroll(): void {
  snapshot = null;
  document.querySelectorAll<HTMLElement>('.page-no-nav').forEach((page) => {
    if (page.querySelector(AUTH_STEP_SELECTOR)) page.scrollTo({ top: 0, behavior: 'auto' });
  });
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function scheduleStepReset(): void {
  resetTimers.forEach((timer) => window.clearTimeout(timer));
  resetTimers = [0, 60, 160, 320, 520].map((delay) =>
    window.setTimeout(resetAuthScroll, delay),
  );
}

function containsAuthStep(node: Node): boolean {
  if (!(node instanceof Element)) return false;
  return node.matches(AUTH_STEP_SELECTOR) || Boolean(node.querySelector(AUTH_STEP_SELECTOR));
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

  // Reset retained scroll after moving to another onboarding/login task.
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest(AUTH_STEP_ACTION_SELECTOR)) scheduleStepReset();
  });

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => Array.from(mutation.addedNodes).some(containsAuthStep))) {
      scheduleStepReset();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.visualViewport?.addEventListener('resize', scheduleClamp);
  window.visualViewport?.addEventListener('scroll', scheduleClamp);
}
