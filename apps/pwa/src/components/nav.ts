import { navigate } from '../router';

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
  { icon: '<img src="/user.png" alt="" style="width:22px;height:22px;object-fit:contain;display:block;" />', label: 'Profile', path: '/app/profile' },
];

let nav: HTMLElement | null = null;

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
      button.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 5v14M5 12h14" /></svg>';
    } else {
      button.className = 'nav-item';
      button.innerHTML = `<span class="nav-icon" aria-hidden="true">${item.icon}</span><span class="nav-label">${item.label}</span>`;
    }

    button.addEventListener('click', () => navigate(item.path));
    inner.appendChild(button);
  }

  nav.appendChild(inner);
  return nav;
}

export function setActiveNav(path: string): void {
  nav?.querySelectorAll<HTMLButtonElement>('[data-route]').forEach((button) => {
    const active = button.dataset.route === path;
    button.classList.toggle('active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });
}
