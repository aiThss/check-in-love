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
  { icon: '➕', label: '', path: '/app/checkin', isCheckin: true },
  { icon: '🎲', label: 'Random', path: '/app/random' },
  { icon: '👤', label: 'Profile', path: '/app/profile' },
];

export function createNav(activePage: string): HTMLElement {
  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.setAttribute('aria-label', 'Điều hướng chính');

  const inner = document.createElement('div');
  inner.className = 'bottom-nav-inner';

  NAV_ITEMS.forEach((item) => {
    if (item.isCheckin) {
      const btn = document.createElement('button');
      btn.className = 'nav-checkin-btn';
      btn.setAttribute('aria-label', 'Tạo check-in mới');
      btn.innerHTML = `<span class="nav-icon" aria-hidden="true">➕</span>`;
      btn.addEventListener('click', () => navigate('/app/checkin'));
      inner.appendChild(btn);
      return;
    }

    const isActive = activePage === item.path;
    const btn = document.createElement('button');
    btn.className = `nav-item${isActive ? ' active' : ''}`;
    btn.setAttribute('aria-label', item.label || 'Check-in');
    btn.setAttribute('aria-current', isActive ? 'page' : 'false');
    btn.innerHTML = `
      <span class="nav-icon" aria-hidden="true">${item.icon}</span>
      <span class="nav-label">${item.label}</span>
    `;
    btn.addEventListener('click', () => {
      if (!isActive) navigate(item.path);
    });
    inner.appendChild(btn);
  });

  nav.appendChild(inner);
  return nav;
}
