import { isReducedMotionActive } from './theme/index';

export type TransitionKind = 'tab' | 'forward' | 'back' | 'viewer' | 'none';

const TAB_ORDER: Record<string, number> = {
  '/app/home': 0,
  '/app/memories': 1,
  '/app/checkin': 2,
  '/app/messages': 3,
  '/app/profile': 4,
};

function stripQuery(path: string): string {
  return path.split('?')[0].replace(/\/$/, '') || '/';
}

export function inferTransitionKind(fromPath: string, toPath: string, isPop = false): TransitionKind {
  const fromClean = stripQuery(fromPath);
  const toClean = stripQuery(toPath);
  if (!fromClean || fromClean === toClean) return 'none';

  const fromIdx = TAB_ORDER[fromClean];
  const toIdx = TAB_ORDER[toClean];

  if (fromIdx !== undefined && toIdx !== undefined) {
    if (toClean === '/app/checkin') return 'forward';
    if (fromClean === '/app/checkin') return 'back';
    return 'tab';
  }

  return isPop ? 'back' : 'forward';
}

interface ViewTransitionLike {
  finished: Promise<void>;
}

type DocumentWithVT = Document & {
  startViewTransition?: (updateCallback: () => void | Promise<void>) => ViewTransitionLike;
};

/**
 * Executes `updateDom` inside `document.startViewTransition` when supported
 * and allowed by motion preferences. Falls back to immediate synchronous
 * execution on older WebViews and test environments (JSDOM).
 */
export function runViewTransition(
  updateDom: () => void,
  kind: TransitionKind = 'tab',
): void {
  if (
    kind === 'none'
    || typeof document === 'undefined'
    || isReducedMotionActive()
  ) {
    updateDom();
    return;
  }

  const doc = document as DocumentWithVT;
  if (typeof doc.startViewTransition !== 'function') {
    updateDom();
    return;
  }

  const root = document.documentElement;
  root.setAttribute('data-vt-kind', kind);

  try {
    const vt = doc.startViewTransition(() => {
      updateDom();
    });
    vt.finished
      .catch(() => {})
      .finally(() => {
        if (root.getAttribute('data-vt-kind') === kind) {
          root.removeAttribute('data-vt-kind');
        }
      });
  } catch {
    root.removeAttribute('data-vt-kind');
    updateDom();
  }
}

export function setSharedTransitionName(element: HTMLElement | null, name: string | null): void {
  if (!element) return;
  if (name) {
    element.style.setProperty('view-transition-name', name);
  } else {
    element.style.removeProperty('view-transition-name');
  }
}
