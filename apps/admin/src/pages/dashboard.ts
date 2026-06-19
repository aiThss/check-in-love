import { adminApi, AdminSummary } from '../api/admin';
import { createSidebar, createSidebarOverlay, openMobileSidebar } from '../components/sidebar';
import { createStatCard, createSkeletonStatCard } from '../components/stats';

export function renderDashboardPage(): HTMLElement {
  const layout = document.createElement('div');
  layout.className = 'layout';

  const overlay = createSidebarOverlay();
  const sidebar = createSidebar('/dashboard');

  /* Main */
  const main = document.createElement('div');
  main.className = 'main-content';

  /* Header */
  const header = buildHeader('Dashboard');
  main.appendChild(header);

  /* Page content */
  const content = document.createElement('div');
  content.className = 'page-content';

  /* Stats section */
  const sectionTitle = document.createElement('div');
  sectionTitle.style.cssText = 'font-size:13px;font-weight:600;color:var(--text-muted);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:14px;';
  sectionTitle.textContent = 'Tổng quan';

  const statsGrid = document.createElement('div');
  statsGrid.className = 'stats-grid';

  // Show 5 skeletons while loading
  for (let i = 0; i < 5; i++) {
    statsGrid.appendChild(createSkeletonStatCard());
  }

  content.appendChild(sectionTitle);
  content.appendChild(statsGrid);

  /* Recent activity placeholder card */
  const recentCard = document.createElement('div');
  recentCard.className = 'card';
  recentCard.innerHTML = `
    <div class="card-header">
      <span class="card-title">Hoạt động gần đây</span>
    </div>
    <div class="card-body">
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <div class="empty-state-title">Đang phát triển</div>
        <div class="empty-state-desc">Biểu đồ hoạt động sẽ có ở phiên bản tiếp theo.</div>
      </div>
    </div>
  `;
  content.appendChild(recentCard);

  main.appendChild(content);

  layout.appendChild(overlay);
  layout.appendChild(sidebar);
  layout.appendChild(main);

  // Fetch summary
  loadSummary(statsGrid);

  return layout;
}

async function loadSummary(grid: HTMLElement): Promise<void> {
  try {
    const summary: AdminSummary = await adminApi.getSummary();

    grid.innerHTML = '';

    const cards: Array<{
      icon: string;
      label: string;
      value: number;
      color: string;
    }> = [
      { icon: '👥', label: 'Tổng người dùng', value: summary.totalUsers, color: 'blue' },
      { icon: '💑', label: 'Tổng couples', value: summary.totalCouples, color: 'pink' },
      { icon: '📸', label: 'Tổng check-ins', value: summary.totalCheckins, color: 'green' },
      { icon: '🚫', label: 'Người dùng bị khóa', value: summary.blockedUsers, color: 'red' },
      { icon: '🎲', label: 'Tổng random events', value: summary.totalRandomEvents, color: 'purple' },
    ];

    cards.forEach(({ icon, label, value, color }) => {
      grid.appendChild(createStatCard(icon, label, value, color));
    });
  } catch {
    grid.innerHTML = `
      <div style="grid-column:1/-1;">
        <div class="alert alert-danger">⚠️ Không thể tải dữ liệu thống kê. Vui lòng thử lại.</div>
      </div>
    `;
  }
}

/* ─── Shared header builder ───────────────────────────────────────────────────── */
export function buildHeader(title: string): HTMLElement {
  const header = document.createElement('div');
  header.className = 'top-header';

  const left = document.createElement('div');
  left.className = 'top-header-left';

  /* Hamburger for mobile */
  const hamburger = document.createElement('button');
  hamburger.className = 'hamburger-btn';
  hamburger.setAttribute('aria-label', 'Open menu');
  hamburger.innerHTML = '<span></span><span></span><span></span>';
  hamburger.addEventListener('click', openMobileSidebar);

  const titleEl = document.createElement('h1');
  titleEl.className = 'page-title';
  titleEl.textContent = title;

  left.appendChild(hamburger);
  left.appendChild(titleEl);

  const right = document.createElement('div');
  right.className = 'top-header-right';

  /* Theme toggle */
  const themeBtn = document.createElement('button');
  themeBtn.className = 'theme-toggle btn-icon';
  themeBtn.setAttribute('aria-label', 'Toggle theme');
  themeBtn.textContent = document.documentElement.dataset['theme'] === 'dark' ? '☀️' : '🌙';
  themeBtn.addEventListener('click', () => {
    const isDark = document.documentElement.dataset['theme'] === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    document.documentElement.dataset['theme'] = newTheme;
    localStorage.setItem('admin_theme', newTheme);
    themeBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
  });

  /* Admin avatar */
  const avatar = document.createElement('div');
  avatar.className = 'admin-avatar';
  avatar.textContent = 'A';
  avatar.title = 'Admin';

  right.appendChild(themeBtn);
  right.appendChild(avatar);

  header.appendChild(left);
  header.appendChild(right);

  return header;
}
