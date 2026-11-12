import { getCurrentPath, navigate } from '../router';
import { attachLiquidGlass } from './liquid-glass';

interface NavItem {
  icon: string;
  label: string;
  path: string;
  isCheckin?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1V9.5z"/></svg>',
    label: 'Home',
    path: '/app/home',
  },
  {
    icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 15l-4.5-4.5L7 20"/></svg>',
    label: 'Kỷ niệm',
    path: '/app/memories',
  },
  { icon: '', label: '', path: '/app/checkin', isCheckin: true },
  {
    icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
    label: 'Tin nhắn',
    path: '/app/messages',
  },
  {
    icon: '<img src="/user.png" alt="Profile" style="width:22px;height:22px;object-fit:contain;display:block;" />',
    label: 'Profile',
    path: '/app/profile',
  },
];

const SUPPORTS_HOVER =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(hover: hover) and (pointer: fine)').matches
    : false;
let nav: HTMLElement | null = null;
let blobEl: HTMLElement | null = null;
let blobX = 0;
let blobV = 0;
let blobTargetX = 0;
let blobW = 64;
let blobRaf = 0;
let blobPressed = false;

function animateBlobToActive(activeBtn: HTMLElement | null, immediate = false): void {
  if (!blobEl || !nav) return;
  const inner = nav.querySelector<HTMLElement>('.bottom-nav-inner');
  if (!inner || !activeBtn || activeBtn.classList.contains('nav-checkin-btn')) {
    blobEl.style.setProperty('--blob-opacity', '0');
    return;
  }

  blobEl.style.setProperty('--blob-opacity', '1');
  const innerRect = inner.getBoundingClientRect();
  const btnRect = activeBtn.getBoundingClientRect();

  if (innerRect.width > 0 && btnRect.width > 0) {
    blobTargetX = btnRect.left - innerRect.left;
    blobW = btnRect.width;
  } else {
    const items = Array.from(inner.querySelectorAll<HTMLElement>('[data-route]'));
    const idx = Math.max(0, items.indexOf(activeBtn));
    blobTargetX = idx * 66 + 6;
    blobW = 64;
  }

  blobEl.style.setProperty('--blob-w', `${blobW.toFixed(1)}px`);

  if (immediate || typeof requestAnimationFrame !== 'function') {
    blobX = blobTargetX;
    blobV = 0;
    blobEl.style.setProperty('--blob-x', `${blobX.toFixed(1)}px`);
    blobEl.style.setProperty('--blob-sx', blobPressed ? '1.32' : '1');
    blobEl.style.setProperty('--blob-sy', blobPressed ? '1.32' : '1');
    return;
  }

  if (blobRaf) return;
  let last = 0;
  const step = (now: number) => {
    const dt = Math.min(0.032, last ? (now - last) / 1000 : 0.016);
    last = now;
    const stiffness = 320;
    const damping = 2 * 0.52 * Math.sqrt(stiffness);
    const force = -stiffness * (blobX - blobTargetX) - damping * blobV;
    blobV += force * dt;
    blobX += blobV * dt;

    const speedStretch = Math.min(0.24, Math.abs(blobV) / 1400);
    const baseScale = blobPressed ? 1.32 : 1;
    const sx = baseScale + speedStretch;
    const sy = Math.max(0.86, baseScale - speedStretch * 0.45);

    if (blobEl) {
      blobEl.style.setProperty('--blob-x', `${blobX.toFixed(1)}px`);
      blobEl.style.setProperty('--blob-sx', sx.toFixed(3));
      blobEl.style.setProperty('--blob-sy', sy.toFixed(3));
    }

    if (Math.abs(blobTargetX - blobX) > 0.4 || Math.abs(blobV) > 2) {
      blobRaf = requestAnimationFrame(step);
    } else {
      blobX = blobTargetX;
      blobV = 0;
      blobRaf = 0;
      if (blobEl) {
        blobEl.style.setProperty('--blob-x', `${blobX.toFixed(1)}px`);
        blobEl.style.setProperty('--blob-sx', baseScale.toFixed(3));
        blobEl.style.setProperty('--blob-sy', baseScale.toFixed(3));
      }
    }
  };
  blobRaf = requestAnimationFrame(step);
}

function applyActiveState(path: string): void {
  let activeButton: HTMLButtonElement | null = null;
  nav?.querySelectorAll<HTMLButtonElement>('[data-route]').forEach((button) => {
    const active = button.dataset.route === path;
    if (active) activeButton = button;
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

  animateBlobToActive(activeButton);
}

export function createNav(): HTMLElement {
  if (nav) return nav;

  nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.setAttribute('aria-label', 'Điều hướng chính');

  const inner = document.createElement('div');
  inner.className = 'bottom-nav-inner';

  blobEl = document.createElement('div');
  blobEl.className = 'nav-sliding-blob';
  blobEl.setAttribute('aria-hidden', 'true');
  inner.appendChild(blobEl);

  attachLiquidGlass(inner, { maxScale: 1.032, hoverScale: 1.01, enableStretch: true });

  inner.addEventListener(
    'pointerdown',
    () => {
      blobPressed = true;
      if (blobEl) {
        blobEl.style.setProperty('--blob-sx', '1.32');
        blobEl.style.setProperty('--blob-sy', '1.32');
      }
    },
    { passive: true }
  );

  const releaseBlob = () => {
    blobPressed = false;
    if (blobEl && !blobRaf) {
      blobEl.style.setProperty('--blob-sx', '1');
      blobEl.style.setProperty('--blob-sy', '1');
    }
  };
  inner.addEventListener('pointerup', releaseBlob, { passive: true });
  inner.addEventListener('pointercancel', releaseBlob, { passive: true });
  inner.addEventListener('pointerleave', releaseBlob, { passive: true });

  for (const item of NAV_ITEMS) {
    const button = document.createElement('button');
    button.dataset.route = item.path;
    button.setAttribute('aria-label', item.isCheckin ? 'Tạo check-in mới' : item.label);

    if (item.isCheckin) {
      button.className = 'nav-checkin-btn';
      button.type = 'button';
      button.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>';
      attachLiquidGlass(button, { maxScale: 1.28, hoverScale: 1.08, enableStretch: true });

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
