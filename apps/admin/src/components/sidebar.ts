import { navigate } from '../router';

export type NavItem = {
  icon: string;
  label: string;
  route: string;
};

const NAV_ITEMS: NavItem[] = [
  { icon: '📊', label: 'Dashboard', route: '/dashboard' },
  { icon: '👥', label: 'Người dùng', route: '/users' },
  { icon: '💑', label: 'Couples', route: '/couples' },
  { icon: '📸', label: 'Check-ins', route: '/checkins' },
  { icon: '🎲', label: 'Random', route: '/random' },
];

export function createSidebar(activePage: string): HTMLElement {
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  sidebar.id = 'sidebar';

  /* Brand */
  const brand = document.createElement('div');
  brand.className = 'sidebar-brand';
  brand.innerHTML = `
    <span class="sidebar-brand-icon">💕</span>
    <span class="sidebar-brand-text">LoveCheck <span>Admin</span></span>
  `;

  /* Nav */
  const nav = document.createElement('nav');
  nav.className = 'sidebar-nav';

  const sectionLabel = document.createElement('div');
  sectionLabel.className = 'sidebar-section-label';
  sectionLabel.textContent = 'Menu';
  nav.appendChild(sectionLabel);

  NAV_ITEMS.forEach(({ icon, label, route }) => {
    const link = document.createElement('div');
    link.className = 'nav-link' + (activePage === route ? ' active' : '');
    link.setAttribute('role', 'button');
    link.setAttribute('tabindex', '0');
    link.innerHTML = `<span class="nav-icon">${icon}</span><span>${label}</span>`;

    link.addEventListener('click', () => {
      navigate(route as Parameters<typeof navigate>[0]);
      // Close mobile drawer
      closeMobileSidebar();
    });

    link.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigate(route as Parameters<typeof navigate>[0]);
        closeMobileSidebar();
      }
    });

    nav.appendChild(link);
  });

  /* Footer – Logout */
  const footer = document.createElement('div');
  footer.className = 'sidebar-footer';

  const logoutBtn = document.createElement('div');
  logoutBtn.className = 'nav-link';
  logoutBtn.setAttribute('role', 'button');
  logoutBtn.setAttribute('tabindex', '0');
  logoutBtn.innerHTML = `<span class="nav-icon">🚪</span><span>Đăng xuất</span>`;

  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('admin_token');
    navigate('/login');
  });

  logoutBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      localStorage.removeItem('admin_token');
      navigate('/login');
    }
  });

  footer.appendChild(logoutBtn);

  sidebar.appendChild(brand);
  sidebar.appendChild(nav);
  sidebar.appendChild(footer);

  return sidebar;
}

/* Overlay element for mobile */
export function createSidebarOverlay(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.id = 'sidebar-overlay';
  overlay.addEventListener('click', closeMobileSidebar);
  return overlay;
}

export function openMobileSidebar(): void {
  document.getElementById('sidebar')?.classList.add('open');
  document.getElementById('sidebar-overlay')?.classList.add('active');
}

export function closeMobileSidebar(): void {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('active');
}
