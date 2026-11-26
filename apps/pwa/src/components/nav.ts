import { getCurrentPath, navigate } from '../router';
import type { RealtimeEventData } from '../api/events';
import { triggerHaptic } from '../ui/haptics';
import { icon, type IconName } from '../ui/icons/icons';

interface NavItem {
  iconName: IconName;
  label: string;
  path: string;
  isCheckin?: boolean;
  preload?: () => Promise<unknown>;
}

const NAV_ITEMS: readonly NavItem[] = [
  {
    iconName: 'home',
    label: 'Home',
    path: '/app/home',
    preload: () => import('../pages/home'),
  },
  {
    iconName: 'memories',
    label: 'Kỷ niệm',
    path: '/app/memories',
    preload: () => import('../pages/memories'),
  },
  {
    iconName: 'checkin-lens',
    label: '',
    path: '/app/checkin',
    isCheckin: true,
    preload: () => import('../pages/checkin'),
  },
  {
    iconName: 'chat',
    label: 'Tin nhắn',
    path: '/app/messages',
    preload: () => import('../pages/messages'),
  },
  {
    iconName: 'profile',
    label: 'Hồ sơ',
    path: '/app/profile',
    preload: () => import('../pages/profile'),
  },
];

let nav: HTMLElement | null = null;
let indicatorEl: HTMLElement | null = null;
let unreadBadgeEl: HTMLElement | null = null;
let unreadCount = 0;
let activeRoutePath = '';
let realtimeListenerInstalled = false;

type NavigatorWithBadge = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

function syncAppBadge(count: number): void {
  if (typeof navigator === 'undefined') return;
  const badgeNav = navigator as NavigatorWithBadge;
  try {
    if (count > 0 && typeof badgeNav.setAppBadge === 'function') {
      void badgeNav.setAppBadge(count).catch(() => {});
    } else if (count <= 0 && typeof badgeNav.clearAppBadge === 'function') {
      void badgeNav.clearAppBadge().catch(() => {});
    }
  } catch {
    // Badging API is progressive enhancement only.
  }
}

export function setNavUnreadCount(count: number): void {
  unreadCount = Math.max(0, Math.trunc(count));
  if (unreadBadgeEl) {
    if (unreadCount > 0) {
      unreadBadgeEl.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
      unreadBadgeEl.hidden = false;
    } else {
      unreadBadgeEl.textContent = '';
      unreadBadgeEl.hidden = true;
    }
  }
  syncAppBadge(unreadCount);
}

export function getNavUnreadCount(): number {
  return unreadCount;
}

function updateIndicatorPosition(): void {
  if (!nav || !indicatorEl) return;
  const activeTab = nav.querySelector<HTMLButtonElement>('.c-nav__item.active');
  if (!activeTab) {
    indicatorEl.classList.remove('is-visible');
    return;
  }
  const width = activeTab.offsetWidth;
  const left = activeTab.offsetLeft;
  if (width > 0) {
    indicatorEl.style.width = `${width}px`;
    indicatorEl.style.transform = `translate3d(${left}px, 0, 0)`;
    indicatorEl.classList.add('is-visible');
  } else {
    // JSDOM or detached layout fallback
    indicatorEl.classList.add('is-visible');
  }
}

function applyActiveState(path: string): void {
  const previousPath = activeRoutePath;
  activeRoutePath = path;

  if (path === '/app/messages' && unreadCount > 0) {
    setNavUnreadCount(0);
  }

  nav?.querySelectorAll<HTMLButtonElement>('[data-route]').forEach((button) => {
    const route = button.dataset.route ?? '';
    const active = route === path;
    button.classList.toggle('active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');

    const svgIcon = button.querySelector<SVGSVGElement>('svg[data-cil-icon]');

    if (button.classList.contains('nav-checkin-btn')) {
      button.setAttribute('aria-label', active ? 'Đóng check-in' : 'Tạo check-in mới');
      svgIcon?.classList.toggle('c-icon--filled', active);
    } else if (svgIcon) {
      svgIcon.classList.toggle('c-icon--filled', active);
      if (active && previousPath && previousPath !== path) {
        svgIcon.classList.remove('c-icon--pop');
        void svgIcon.getBoundingClientRect();
        svgIcon.classList.add('c-icon--pop');
      }
    }

    if (!active && document.activeElement === button) {
      button.blur();
    }
  });

  updateIndicatorPosition();
}

function ensureRealtimeUnreadListener(): void {
  if (realtimeListenerInstalled || typeof window === 'undefined') return;
  realtimeListenerInstalled = true;

  window.addEventListener('lovecheck:realtime-event', ((event: Event) => {
    const detail = (event as CustomEvent<RealtimeEventData>).detail;
    if (!detail) return;
    if (detail.type === 'message') {
      const cleanCurrent = getCurrentPath().split('?')[0].replace(/\/$/, '');
      if (cleanCurrent !== '/app/messages') {
        setNavUnreadCount(unreadCount + 1);
      }
    } else if (detail.type === 'message.read') {
      setNavUnreadCount(0);
    }
  }) as EventListener);

  window.addEventListener('resize', () => updateIndicatorPosition(), { passive: true });
}

export function createNav(): HTMLElement {
  if (nav && nav.isConnected) return nav;

  nav = document.createElement('nav');
  nav.className = 'bottom-nav c-nav';
  nav.setAttribute('aria-label', 'Điều hướng chính');

  const inner = document.createElement('div');
  inner.className = 'c-nav__bar';

  indicatorEl = document.createElement('div');
  indicatorEl.className = 'c-nav__indicator';
  indicatorEl.setAttribute('aria-hidden', 'true');
  inner.appendChild(indicatorEl);

  for (const item of NAV_ITEMS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.route = item.path;

    const triggerPreload = (): void => {
      void item.preload?.().catch(() => {});
    };

    if (item.isCheckin) {
      button.className = 'nav-checkin-btn c-nav__checkin';
      button.setAttribute('aria-label', 'Tạo check-in mới');
      button.innerHTML =
        '<svg data-cil-icon="plus" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';

      const slot = document.createElement('div');
      slot.className = 'c-nav__checkin-slot nav-checkin-wrapper';

      const glow = document.createElement('div');
      glow.className = 'c-nav__checkin-glow';
      glow.setAttribute('aria-hidden', 'true');

      slot.append(glow, button);

      button.addEventListener('pointerenter', triggerPreload, { passive: true });
      button.addEventListener('pointerdown', triggerPreload, { passive: true });
      button.addEventListener('click', () => {
        triggerHaptic('confirm');
        const currentPath = getCurrentPath().split('?')[0].replace(/\/$/, '') || '/';
        const targetPath = currentPath === item.path ? '/app/home' : item.path;
        applyActiveState(targetPath);
        navigate(targetPath);
      });

      inner.appendChild(slot);
      continue;
    }

    button.className = 'c-nav__item';
    button.setAttribute('aria-label', item.label);

    const iconEl = icon(item.iconName, { size: 24, variant: 'outline' });
    const labelEl = document.createElement('span');
    labelEl.className = 'c-nav__label';
    labelEl.textContent = item.label;

    button.append(iconEl, labelEl);

    if (item.path === '/app/messages') {
      unreadBadgeEl = document.createElement('span');
      unreadBadgeEl.className = 'c-nav__badge';
      unreadBadgeEl.hidden = unreadCount <= 0;
      if (unreadCount > 0) {
        unreadBadgeEl.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
      }
      button.appendChild(unreadBadgeEl);
    }

    button.addEventListener('pointerenter', triggerPreload, { passive: true });
    button.addEventListener('pointerdown', () => {
      triggerPreload();
      applyActiveState(item.path);
    });
    button.addEventListener('click', () => {
      triggerHaptic('select');
      applyActiveState(item.path);
      navigate(item.path);
    });

    inner.appendChild(button);
  }

  nav.appendChild(inner);
  ensureRealtimeUnreadListener();
  return nav;
}

export function setActiveNav(path: string): void {
  applyActiveState(path);
}
