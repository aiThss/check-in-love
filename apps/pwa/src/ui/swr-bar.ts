const SWR_BAR_ID = 'cil-swr-bar';

let barEl: HTMLElement | null = null;
let manualCount = 0;
let queryCacheActive = false;
let listenerBound = false;

function syncBarVisibility(): void {
  if (!barEl) return;
  const active = manualCount > 0 || queryCacheActive;
  barEl.classList.toggle('is-active', active);
  barEl.setAttribute('aria-hidden', active ? 'false' : 'true');
}

export function initSwrBar(doc: Document = document): HTMLElement | null {
  if (!doc.body) return null;
  const existing = doc.getElementById(SWR_BAR_ID);
  if (existing) {
    barEl = existing;
    return existing;
  }

  const bar = doc.createElement('div');
  bar.id = SWR_BAR_ID;
  bar.className = 'c-swr-bar';
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-label', 'Đang đồng bộ dữ liệu mới');
  bar.setAttribute('aria-hidden', 'true');

  const runner = doc.createElement('div');
  runner.className = 'c-swr-bar__runner';
  bar.appendChild(runner);

  doc.body.appendChild(bar);
  barEl = bar;

  if (!listenerBound && typeof window !== 'undefined') {
    listenerBound = true;
    window.addEventListener('lovecheck:swr', ((event: Event) => {
      const detail = (event as CustomEvent<{ active?: boolean }>).detail;
      queryCacheActive = Boolean(detail?.active);
      syncBarVisibility();
    }) as EventListener);
  }

  return bar;
}

export function startSwrActivity(): () => void {
  if (typeof document !== 'undefined' && !barEl) {
    initSwrBar(document);
  }
  manualCount += 1;
  syncBarVisibility();

  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    manualCount = Math.max(0, manualCount - 1);
    syncBarVisibility();
  };
}
