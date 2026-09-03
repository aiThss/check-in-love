import { getCurrentPath, navigate } from '../router';

interface NavItem {
  icon: string;
  label: string;
  path: string;
  isCheckin?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { icon: '🏠', label: 'Home', path: '/app/home' },
  { icon: '📸', label: 'Kỷ niệm', path: '/app/memories' },
  { icon: '', label: '', path: '/app/checkin', isCheckin: true },
  { icon: '💬', label: 'Tin nhắn', path: '/app/messages' },
  { icon: '<img src="/user.png" alt="Profile" style="width:22px;height:22px;object-fit:contain;display:block;" />', label: 'Profile', path: '/app/profile' },
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
      button.innerHTML = `<span class="nav-icon" aria-hidden="true">${item.icon}</span><span class="nav-label">${item.label}</span>`;
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
