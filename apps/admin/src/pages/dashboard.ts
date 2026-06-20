import { adminApi } from '../api/admin';
import type { AdminSummary, CheckIn, RandomEvent } from '../api/admin';
import {
  createSidebar,
  createSidebarOverlay,
  openMobileSidebar,
} from '../components/sidebar';
import { createStatCard, createSkeletonStatCard } from '../components/stats';
import { showFormModal, showToast } from '../components/modal';
import { ApiError } from '../api/client';

export function renderDashboardPage(): HTMLElement {
  const layout = document.createElement('div');
  layout.className = 'layout';

  const overlay = createSidebarOverlay();
  const sidebar = createSidebar('/dashboard');

  const main = document.createElement('div');
  main.className = 'main-content';
  main.appendChild(buildHeader('Dashboard'));

  const content = document.createElement('div');
  content.className = 'page-content dashboard-page';

  const quickActions = document.createElement('div');
  quickActions.className = 'dashboard-quick-actions';
  quickActions.innerHTML = `
    <a class="quick-action" href="/users" data-link>
      <span class="quick-action-icon">👥</span>
      <span>
        <strong>Người dùng</strong>
        <small>Tra cứu, khóa/mở khóa</small>
      </span>
    </a>
    <a class="quick-action" href="/couples" data-link>
      <span class="quick-action-icon">💑</span>
      <span>
        <strong>Couples</strong>
        <small>Ngày yêu, streak, thành viên</small>
      </span>
    </a>
    <a class="quick-action" href="/checkins" data-link>
      <span class="quick-action-icon">📸</span>
      <span>
        <strong>Check-ins</strong>
        <small>Ảnh, caption, xóa mềm</small>
      </span>
    </a>
    <a class="quick-action" href="/random" data-link>
      <span class="quick-action-icon">🎲</span>
      <span>
        <strong>Random</strong>
        <small>Lịch sử prompt</small>
      </span>
    </a>
  `;

  const sectionTitle = document.createElement('div');
  sectionTitle.className = 'section-label';
  sectionTitle.textContent = 'Tổng quan';

  const statsGrid = document.createElement('div');
  statsGrid.className = 'stats-grid';
  for (let i = 0; i < 5; i++) {
    statsGrid.appendChild(createSkeletonStatCard());
  }

  const recentCard = document.createElement('div');
  recentCard.className = 'card';
  recentCard.innerHTML = `
    <div class="card-header">
      <span class="card-title">Hoạt động gần đây</span>
    </div>
    <div class="card-body">
      <div id="recent-activity" class="activity-list">
        <div class="skeleton skeleton-row"></div>
        <div class="skeleton skeleton-row"></div>
        <div class="skeleton skeleton-row"></div>
      </div>
    </div>
  `;

  const testToolsCard = document.createElement('div');
  testToolsCard.className = 'card danger-zone-card';
  testToolsCard.innerHTML = `
    <div class="card-header">
      <span class="card-title">Công cụ test</span>
      <span class="badge badge-warning">Cẩn thận</span>
    </div>
    <div class="card-body">
      <div class="danger-zone">
        <div>
          <div class="danger-zone-title">Xóa toàn bộ dữ liệu test</div>
          <div class="danger-zone-desc">
            Xóa users, couples, check-ins, random events, OTP/email đăng ký,
            push subscriptions và uploads.
          </div>
        </div>
        <button class="btn btn-danger" id="reset-data-btn">Xóa dữ liệu</button>
      </div>
    </div>
  `;
  const resetDesc = testToolsCard.querySelector('.danger-zone-desc');
  resetDesc?.insertAdjacentHTML(
    'afterend',
    '<div class="danger-zone-status" id="reset-status">Dang kiem tra trang thai reset...</div>',
  );

  content.appendChild(quickActions);
  content.appendChild(sectionTitle);
  content.appendChild(statsGrid);
  content.appendChild(recentCard);
  content.appendChild(testToolsCard);
  main.appendChild(content);

  layout.appendChild(overlay);
  layout.appendChild(sidebar);
  layout.appendChild(main);

  const reloadDashboard = () => {
    loadSummary(statsGrid);
    loadRecentActivity(recentCard.querySelector<HTMLElement>('#recent-activity'));
  };

  reloadDashboard();
  loadResetStatus(testToolsCard);
  testToolsCard
    .querySelector<HTMLButtonElement>('#reset-data-btn')
    ?.addEventListener('click', () => openResetModal(reloadDashboard));

  return layout;
}

async function loadResetStatus(card: HTMLElement): Promise<void> {
  const statusEl = card.querySelector<HTMLElement>('#reset-status');
  const resetBtn = card.querySelector<HTMLButtonElement>('#reset-data-btn');
  if (!statusEl || !resetBtn) return;

  try {
    const status = await adminApi.getResetStatus();
    if (status.enabled) {
      resetBtn.disabled = false;
      resetBtn.removeAttribute('title');
      statusEl.textContent = 'Reset test dang bat tren API.';
      statusEl.className = 'danger-zone-status is-enabled';
      return;
    }

    resetBtn.disabled = true;
    resetBtn.title = 'Set ADMIN_ENABLE_TEST_RESET=true tren API roi deploy lai.';
    statusEl.textContent =
      'Reset test dang tat. Set ADMIN_ENABLE_TEST_RESET=true tren API de dung nut nay.';
    statusEl.className = 'danger-zone-status is-disabled';
  } catch (err) {
    resetBtn.disabled = false;
    statusEl.textContent = errorMessage(
      err,
      'Khong kiem tra duoc trang thai reset. Co the thu lai thu cong.',
    );
    statusEl.className = 'danger-zone-status is-unknown';
  }
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
      { icon: '📸', label: 'Tổng check-ins', value: summary.totalCheckIns, color: 'green' },
      { icon: '🚫', label: 'Người dùng bị khóa', value: summary.blockedUsers, color: 'red' },
      { icon: '🎲', label: 'Tổng random events', value: summary.totalRandomEvents, color: 'purple' },
    ];

    cards.forEach(({ icon, label, value, color }) => {
      grid.appendChild(createStatCard(icon, label, value, color));
    });
  } catch (err) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;">
        <div class="alert alert-danger">⚠️ ${escapeHtml(errorMessage(err, 'Không thể tải dữ liệu thống kê.'))}</div>
      </div>
    `;
  }
}

async function loadRecentActivity(container: HTMLElement | null): Promise<void> {
  if (!container) return;

  try {
    const [checkins, randomEvents] = await Promise.all([
      adminApi.getCheckins(1, true),
      adminApi.getRandomEvents(1),
    ]);

    const items = [
      ...checkins.data.slice(0, 4).map((item) => ({
        icon: checkinIcon(item),
        title: `${item.senderName} gửi ${checkinLabel(item)}`,
        createdAt: item.createdAt,
      })),
      ...randomEvents.data.slice(0, 3).map((item) => ({
        icon: '🎲',
        title: `${item.userName} bốc ${categoryLabel(item)}`,
        createdAt: item.createdAt,
      })),
    ]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 6);

    if (items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📭</div>
          <div class="empty-state-title">Chưa có hoạt động</div>
          <div class="empty-state-desc">Dữ liệu mới sẽ hiện ở đây sau khi test app.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = items
      .map(
        (item) => `
          <div class="activity-item">
            <span class="activity-icon">${item.icon}</span>
            <span class="activity-body">
              <strong>${escapeHtml(item.title)}</strong>
              <small>${escapeHtml(formatDateTime(item.createdAt))}</small>
            </span>
          </div>
        `,
      )
      .join('');
  } catch (err) {
    container.innerHTML = `<div class="alert alert-danger">⚠️ ${escapeHtml(errorMessage(err, 'Không thể tải hoạt động gần đây.'))}</div>`;
  }
}

function openResetModal(onDone: () => void): void {
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="alert alert-danger">
      ⚠️ Hành động này xóa sạch dữ liệu app để test lại từ đầu. Không thể hoàn tác.
    </div>
    <div class="form-group">
      <label class="form-label" for="reset-confirmation">Nhập RESET CHECK IN LOVE để xác nhận</label>
      <input class="form-input" id="reset-confirmation" autocomplete="off" />
      <span class="form-hint">Endpoint chỉ hoạt động khi ADMIN_ENABLE_TEST_RESET=true.</span>
    </div>
  `;

  const input = content.querySelector<HTMLInputElement>('#reset-confirmation')!;

  showFormModal({
    title: 'Xóa toàn bộ dữ liệu test',
    content,
    confirmLabel: 'Xóa dữ liệu',
    onConfirm: async () => {
      try {
        const result = await adminApi.resetAllData(input.value.trim());
        const totalDeleted = Object.values(result.deleted).reduce((sum, n) => sum + n, 0);
        showToast(`Đã xóa ${totalDeleted.toLocaleString('vi-VN')} bản ghi test.`, 'success');
        onDone();
      } catch (err) {
        showToast(errorMessage(err, 'Không thể xóa dữ liệu test.'), 'error');
        throw err;
      }
    },
  });

  setTimeout(() => input.focus(), 80);
}

function checkinIcon(item: CheckIn): string {
  if (item.status === 'deleted') return '🗑️';
  if (item.type === 'photo') return '📸';
  if (item.type === 'mood') return '😊';
  return '📝';
}

function checkinLabel(item: CheckIn): string {
  if (item.type === 'photo') return 'check-in ảnh';
  if (item.type === 'mood') return 'tâm trạng';
  return 'check-in chữ';
}

function categoryLabel(item: RandomEvent): string {
  return item.category || 'prompt';
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const code = (err.body as { code?: string } | null)?.code;
    if (code === 'RESET_DISABLED') {
      return 'Reset test dang tat tren API. Set ADMIN_ENABLE_TEST_RESET=true roi deploy lai API.';
    }
    return err.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/* ─── Shared header builder ─────────────────────────────────────────────── */
export function buildHeader(title: string): HTMLElement {
  const header = document.createElement('div');
  header.className = 'top-header';

  const left = document.createElement('div');
  left.className = 'top-header-left';

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
