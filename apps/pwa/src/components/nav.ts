import { getCurrentPath, navigate } from '../router';
import { iconHome, iconMemories, iconMessages, iconPlus, iconProfile } from './icons';

interface NavItem {
  icon: (filled?: boolean) => string;
  label: string;
  path: string;
  isCheckin?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { icon: (filled) => iconHome({ filled, size: 22 }), label: 'Home', path: '/app/home' },
  { icon: (filled) => iconMemories({ filled, size: 22 }), label: 'Kỷ niệm', path: '/app/memories' },
  { icon: () => iconPlus({ size: 24, strokeWidth: 3 }), label: '', path: '/app/checkin', isCheckin: true },
  { icon: (filled) => iconMessages({ filled, size: 22 }), label: 'Tin nhắn', path: '/app/messages' },
  { icon: (filled) => iconProfile({ filled, size: 22 }), label: 'Cá nhân', path: '/app/profile' },
];

const SUPPORTS_HOVER =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(hover: hover) and (pointer: fine)').matches
    : false;
let nav: HTMLElement | null = null;

function applyActiveState(path: string): void {
  nav?.querySelectorAll<HTMLButtonElement>('[data-route]').forEach((button) => {
    const active = button.dataset.route === path;
    button.classList.toggle('active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
    if (button.classList.contains('nav-checkin-btn')) {
      button.setAttribute('aria-label', active ? 'Đóng check-in' : 'Tạo check-in mới');
    } else {
      const item = NAV_ITEMS.find((n) => n.path === button.dataset.route);
      const iconEl = button.querySelector<HTMLElement>('.nav-icon');
      if (item && iconEl) {
        iconEl.innerHTML = item.icon(active);
      }
    }

    if (!button.classList.contains('nav-checkin-btn')) {
      // Touch browsers can keep :hover stuck after tapping. Keep inactive tabs
      // explicitly transparent there so browser back never leaves two highlights.
      button.style.background = active
        ? 'var(--accent-soft)'
        : SUPPORTS_HOVER
          ? ''
          : 'transparent';
    }

    if (!active && document.activeElement === button) button.blur();
  });
}

export function createNav(): HTMLElement {
  if (nav) return nav;

  nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.setAttribute('aria-label', 'Điều hướng chính');

  const inner = document.createElement('div');
  inner.className = 'bottom-nav-inner';

  for (const item of NAV_ITEMS) {
    const button = document.createElement('button');
    button.dataset.route = item.path;
    button.setAttribute('aria-label', item.isCheckin ? 'Tạo check-in mới' : item.label);

    if (item.isCheckin) {
      button.className = 'nav-checkin-btn';
      button.type = 'button';
      button.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';

      // Wrap in relative container with glow ring (ported from locket)
      const wrapper = document.createElement('div');
      wrapper.className = 'nav-checkin-wrapper';

      const glow = document.createElement('div');
      glow.className = 'nav-checkin-glow';

      wrapper.appendChild(glow);
      wrapper.appendChild(button);

      button.addEventListener('click', () => {
        const currentPath = getCurrentPath().split('?')[0].replace(/\/$/, '') || '/';
        const targetPath = currentPath === item.path ? '/app/home' : item.path;
        applyActiveState(targetPath);
        navigate(targetPath);
      });

      inner.appendChild(wrapper);
      continue;
    } else {
      button.className = 'nav-item';
      button.style.transform = 'none';
      button.style.transition = 'background var(--duration-fast) var(--ease), color var(--duration-fast) var(--ease)';
      button.innerHTML = `<span class="nav-icon" aria-hidden="true">${item.icon(false)}</span><span class="nav-label">${item.label}</span>`;
    }

    button.addEventListener('pointerdown', () => applyActiveState(item.path));
    button.addEventListener('click', () => {
      applyActiveState(item.path);
      navigate(item.path);
    });
    inner.appendChild(button);
  }

  nav.appendChild(inner);
  return nav;
}

export function setActiveNav(path: string): void {
  applyActiveState(path);
}
