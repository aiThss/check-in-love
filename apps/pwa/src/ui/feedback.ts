import { icon, type IconName } from './icons/icons';
import { createButton, type ButtonOptions } from './primitives';

// ── ListRow & ListGroup ──────────────────────────────────────────────────────

export interface ListRowOptions {
  title: string;
  subtitle?: string;
  leadingIcon?: IconName;
  leadingNode?: Node;
  trailingNode?: Node | string;
  chevron?: boolean;
  onClick?: () => void;
}

export function createListRow(options: ListRowOptions): HTMLElement {
  const interactive = Boolean(options.onClick);
  const row = document.createElement(interactive ? 'button' : 'div');
  if (row instanceof HTMLButtonElement) row.type = 'button';
  row.className = `c-list-row${interactive ? ' c-list-row--interactive' : ''}`;

  if (options.leadingNode) {
    row.appendChild(options.leadingNode);
  } else if (options.leadingIcon) {
    const lead = document.createElement('span');
    lead.className = 'c-list-row__leading';
    lead.appendChild(icon(options.leadingIcon, { size: 20 }));
    row.appendChild(lead);
  }

  const body = document.createElement('div');
  body.className = 'c-list-row__body';
  const title = document.createElement('span');
  title.className = 'c-list-row__title';
  title.textContent = options.title;
  body.appendChild(title);

  if (options.subtitle) {
    const sub = document.createElement('span');
    sub.className = 'c-list-row__subtitle';
    sub.textContent = options.subtitle;
    body.appendChild(sub);
  }
  row.appendChild(body);

  if (options.trailingNode !== undefined || options.chevron) {
    const trail = document.createElement('div');
    trail.className = 'c-list-row__trailing';
    if (options.trailingNode !== undefined) {
      trail.append(options.trailingNode);
    }
    if (options.chevron) {
      trail.appendChild(icon('chevron-right', { size: 16 }));
    }
    row.appendChild(trail);
  }

  if (options.onClick) row.addEventListener('click', options.onClick);
  return row;
}

export function createListGroup(rows: HTMLElement[]): HTMLElement {
  const group = document.createElement('div');
  group.className = 'c-list-group';
  for (const r of rows) group.appendChild(r);
  return group;
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

export interface SkeletonOptions {
  width?: string;
  height?: string;
  shape?: 'rect' | 'circle' | 'pill';
  className?: string;
}

export function createSkeleton(options: SkeletonOptions = {}): HTMLElement {
  const el = document.createElement('div');
  const classes = ['c-skeleton'];
  if (options.shape === 'circle') classes.push('c-skeleton--circle');
  if (options.shape === 'pill') classes.push('c-skeleton--pill');
  if (options.className) classes.push(options.className);
  el.className = classes.join(' ');
  el.setAttribute('aria-hidden', 'true');
  el.style.width = options.width ?? '100%';
  el.style.height = options.height ?? '18px';
  return el;
}

// ── EmptyState with Bespoke Editorial SVG Illustrations ──────────────────────

export type EmptyIllustrationKind = 'memories' | 'messages' | 'journey' | 'offline' | 'generic';

const ILLUSTRATIONS: Record<EmptyIllustrationKind, string> = {
  memories: `<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="20" y="24" width="58" height="68" rx="6" transform="rotate(-7 20 24)" fill="currentColor" fill-opacity="0.08"/>
    <rect x="40" y="22" width="58" height="68" rx="6" transform="rotate(6 40 22)" fill="var(--surface-paper)"/>
    <path d="M69 66s-11-6.8-11-14.2a6.2 6.2 0 0 1 11-3.9 6.2 6.2 0 0 1 11 3.9C80 59.2 69 66 69 66Z" fill="currentColor" fill-opacity="0.22"/>
    <path d="M54 78h26"/>
  </svg>`,
  messages: `<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M22 44a22 20 0 0 1 44 0c0 11-9.8 20-22 20h-4l-11 8 2.4-10.5A19 19 0 0 1 22 44Z" fill="currentColor" fill-opacity="0.1"/>
    <path d="M52 66a22 20 0 1 1 35 16l2.5 10.5-11-8h-4.5A22 20 0 0 1 52 66Z" fill="var(--surface-paper)"/>
    <path d="M74 72s-7-4.4-7-9.2a4 4 0 0 1 7-2.5 4 4 0 0 1 7 2.5C81 67.6 74 72 74 72Z" fill="currentColor" fill-opacity="0.26"/>
  </svg>`,
  journey: `<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M24 90c18-2 22-24 38-24s18-20 34-22" stroke-dasharray="5 5"/>
    <path d="M60 62s15-13 15-25a15 15 0 0 0-30 0c0 12 15 25 15 25Z" fill="currentColor" fill-opacity="0.16"/>
    <circle cx="60" cy="37" r="5"/>
  </svg>`,
  offline: `<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M28 52a46 46 0 0 1 64 0M40 66a28 28 0 0 1 40 0" opacity="0.45"/>
    <path d="M30 30l60 60"/>
    <circle cx="60" cy="84" r="4" fill="currentColor"/>
  </svg>`,
  generic: `<svg viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="60" cy="60" r="34" fill="currentColor" fill-opacity="0.08"/>
    <path d="M60 78s-16-10-16-21.5a9.2 9.2 0 0 1 16-6 9.2 9.2 0 0 1 16 6C76 68 60 78 60 78Z" fill="currentColor" fill-opacity="0.22"/>
  </svg>`,
};

export interface EmptyStateOptions {
  title: string;
  description: string;
  illustration?: EmptyIllustrationKind;
  action?: ButtonOptions;
}

export function createEmptyState(options: EmptyStateOptions): HTMLElement {
  const wrap = document.createElement('section');
  wrap.className = 'c-empty-state';

  const art = document.createElement('div');
  art.className = 'c-empty-state__art';
  art.innerHTML = ILLUSTRATIONS[options.illustration ?? 'generic'];
  wrap.appendChild(art);

  const h3 = document.createElement('h3');
  h3.className = 'c-empty-state__title';
  h3.textContent = options.title;
  wrap.appendChild(h3);

  const desc = document.createElement('p');
  desc.className = 'c-empty-state__desc';
  desc.textContent = options.description;
  wrap.appendChild(desc);

  if (options.action) {
    wrap.appendChild(createButton(options.action).element);
  }

  return wrap;
}

// ── Custom Pull-to-Refresh (Pointer Events + Spring Damping) ─────────────────

export interface PullToRefreshOptions {
  scrollContainer: HTMLElement;
  onRefresh: () => Promise<void>;
  thresholdPx?: number;
}

export function attachPullToRefresh(options: PullToRefreshOptions): () => void {
  const threshold = options.thresholdPx ?? 68;
  const indicator = document.createElement('div');
  indicator.className = 'c-ptr';
  const pill = document.createElement('div');
  pill.className = 'c-ptr__pill';
  const spinnerIcon = icon('refresh', { size: 20 });
  pill.appendChild(spinnerIcon);
  indicator.appendChild(pill);
  options.scrollContainer.insertBefore(indicator, options.scrollContainer.firstChild);

  let startY = 0;
  let pulling = false;
  let refreshing = false;
  let pullDistance = 0;

  const onPointerDown = (e: PointerEvent): void => {
    if (refreshing || options.scrollContainer.scrollTop > 2) return;
    startY = e.clientY;
    pulling = true;
    pullDistance = 0;
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (!pulling || refreshing) return;
    const dy = e.clientY - startY;
    if (dy <= 0) {
      pullDistance = 0;
      pill.style.opacity = '0';
      return;
    }
    pullDistance = Math.min(110, dy * 0.45);
    const progress = Math.min(1, pullDistance / threshold);
    pill.style.opacity = String(progress);
    pill.style.transform = `translateY(${pullDistance - 20}px) rotate(${progress * 200}deg) scale(${0.8 + progress * 0.2})`;
  };

  const finishPull = async (): Promise<void> => {
    if (!pulling || refreshing) return;
    pulling = false;
    if (pullDistance >= threshold) {
      refreshing = true;
      spinnerIcon.classList.add('c-icon--spin');
      pill.style.opacity = '1';
      pill.style.transform = 'translateY(16px) scale(1)';
      try {
        await options.onRefresh();
      } finally {
        refreshing = false;
        spinnerIcon.classList.remove('c-icon--spin');
        pill.style.opacity = '0';
        pill.style.transform = 'translateY(-20px) scale(0.8)';
      }
    } else {
      pill.style.opacity = '0';
      pill.style.transform = 'translateY(-20px) scale(0.8)';
    }
    pullDistance = 0;
  };

  const endHandler = (): void => {
    void finishPull();
  };

  options.scrollContainer.addEventListener('pointerdown', onPointerDown, { passive: true });
  options.scrollContainer.addEventListener('pointermove', onPointerMove, { passive: true });
  options.scrollContainer.addEventListener('pointerup', endHandler);
  options.scrollContainer.addEventListener('pointercancel', endHandler);

  return () => {
    options.scrollContainer.removeEventListener('pointerdown', onPointerDown);
    options.scrollContainer.removeEventListener('pointermove', onPointerMove);
    options.scrollContainer.removeEventListener('pointerup', endHandler);
    options.scrollContainer.removeEventListener('pointercancel', endHandler);
    indicator.remove();
  };
}
