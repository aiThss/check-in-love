import { adminApi, User } from '../api/admin';
import { createSidebar, createSidebarOverlay } from '../components/sidebar';
import { buildHeader } from './dashboard';
import { createTable, createPagination, TableColumn } from '../components/table';
import { showConfirmModal, showToast } from '../components/modal';
import { ApiError } from '../api/client';

export function renderUsersPage(): HTMLElement {
  const layout = document.createElement('div');
  layout.className = 'layout';

  const overlay = createSidebarOverlay();
  const sidebar = createSidebar('/users');

  const main = document.createElement('div');
  main.className = 'main-content';
  main.appendChild(buildHeader('Người dùng'));

  const content = document.createElement('div');
  content.className = 'page-content';

  /* Card */
  const card = document.createElement('div');
  card.className = 'card';

  /* Card header with toolbar */
  const cardHeader = document.createElement('div');
  cardHeader.className = 'card-header';

  const cardTitle = document.createElement('span');
  cardTitle.className = 'card-title';
  cardTitle.textContent = 'Danh sách người dùng';

  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';

  /* Search */
  const searchWrapper = document.createElement('div');
  searchWrapper.className = 'search-wrapper';
  searchWrapper.innerHTML = '<span class="search-icon">🔍</span>';

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'search-input';
  searchInput.placeholder = 'Tìm theo tên hoặc email…';
  searchWrapper.appendChild(searchInput);
  toolbar.appendChild(searchWrapper);

  cardHeader.appendChild(cardTitle);
  cardHeader.appendChild(toolbar);

  /* Table container */
  const tableContainer = document.createElement('div');
  tableContainer.innerHTML = renderSkeletonRows(5);

  /* Pagination container */
  const paginationContainer = document.createElement('div');

  card.appendChild(cardHeader);
  card.appendChild(tableContainer);
  card.appendChild(paginationContainer);

  content.appendChild(card);
  main.appendChild(content);

  layout.appendChild(overlay);
  layout.appendChild(sidebar);
  layout.appendChild(main);

  /* State */
  let currentPage = 1;
  let searchQuery = '';
  let debounceTimer: ReturnType<typeof setTimeout>;

  const load = async (page: number, search: string) => {
    currentPage = page;
    searchQuery = search;
    tableContainer.innerHTML = renderSkeletonRows(5);
    paginationContainer.innerHTML = '';

    try {
      const res = await adminApi.getUsers(page, search);

      const columns: TableColumn<User>[] = [
        {
          key: 'name',
          label: 'Người dùng',
          render: (_v, row) => `
            <div class="user-cell">
              <div class="user-avatar">
                ${row.avatarUrl ? `<img src="${row.avatarUrl}" alt="${row.name}" loading="lazy">` : escapeHtml(initials(row.name))}
              </div>
              <div>
                <div class="user-info-name">${escapeHtml(row.name)}</div>
                <div class="user-info-sub">${escapeHtml(row.email)}</div>
              </div>
            </div>
          `,
        },
        {
          key: 'coupleCode',
          label: 'Couple Code',
          render: (_v, row) =>
            row.coupleCode
              ? `<span class="mono">${escapeHtml(row.coupleCode)}</span>`
              : '<span style="color:var(--text-muted)">—</span>',
        },
        {
          key: 'status',
          label: 'Trạng thái',
          render: (_v, row) =>
            row.status === 'active'
              ? '<span class="badge badge-active">Hoạt động</span>'
              : '<span class="badge badge-blocked">Bị khóa</span>',
        },
        {
          key: 'createdAt',
          label: 'Ngày tạo',
          render: (_v, row) =>
            `<span class="text-muted">${formatDate(row.createdAt)}</span>`,
        },
        {
          key: 'id',
          label: 'Hành động',
          width: '220px',
          render: (_v, row) => {
            const isBlocked = row.status === 'blocked';
            return `
              <div class="actions-cell">
                <button
                  class="btn btn-sm ${isBlocked ? 'btn-success' : 'btn-danger'}"
                  data-action="${isBlocked ? 'unblock' : 'block'}"
                  data-id="${row.id}"
                  data-name="${escapeHtml(row.name)}"
                >
                  ${isBlocked ? '✅ Mở khóa' : '🚫 Khóa'}
                </button>
                <button
                  class="btn btn-sm btn-danger"
                  data-action="delete"
                  data-id="${row.id}"
                  data-name="${escapeHtml(row.name)}"
                >
                  Xóa
                </button>
              </div>
            `;
          },
        },
      ];

      tableContainer.innerHTML = '';
      tableContainer.appendChild(createTable<User>(columns, res.data));

      /* Attach action handlers */
      tableContainer.querySelectorAll('[data-action]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const action = btn.getAttribute('data-action') ?? '';
          const userId = btn.getAttribute('data-id') ?? '';
          const userName = btn.getAttribute('data-name') ?? '';
          handleUserAction(action, userId, userName, () => load(currentPage, searchQuery));
        });
      });

      /* Pagination */
      paginationContainer.innerHTML = '';
      paginationContainer.appendChild(
        createPagination(res.page, res.total, res.limit, (p) =>
          load(p, searchQuery),
        ),
      );
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Lỗi tải dữ liệu.';
      tableContainer.innerHTML = `<div class="alert alert-danger" style="margin:16px;">⚠️ ${escapeHtml(msg)}</div>`;
    }
  };

  // Search debounce
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      load(1, searchInput.value.trim());
    }, 380);
  });

  load(1, '');

  return layout;
}

function handleUserAction(
  action: string,
  userId: string,
  userName: string,
  onDone: () => void,
): void {
  if (action === 'delete') {
    showConfirmModal({
      icon: '🗑️',
      title: `Xóa tài khoản?`,
      description: `Bạn có chắc muốn xóa vĩnh viễn <strong>${escapeHtml(userName)}</strong>? Check-in, random event, OTP và push subscription liên quan cũng sẽ bị xóa để test lại account.`,
      confirmLabel: 'Xóa tài khoản',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await adminApi.deleteUser(userId);
          showToast(`Đã xóa ${userName}.`, 'success');
          onDone();
        } catch (err) {
          const msg =
            err instanceof ApiError ? err.message : 'Thao tác thất bại.';
          showToast(msg, 'error');
          throw err;
        }
      },
    });
    return;
  }

  const isBlock = action === 'block';

  showConfirmModal({
    icon: isBlock ? '🚫' : '✅',
    title: isBlock ? `Khóa người dùng?` : `Mở khóa người dùng?`,
    description: isBlock
      ? `Bạn có chắc muốn khóa <strong>${escapeHtml(userName)}</strong>? Họ sẽ không thể đăng nhập.`
      : `Bạn có chắc muốn mở khóa <strong>${escapeHtml(userName)}</strong>?`,
    confirmLabel: isBlock ? 'Khóa' : 'Mở khóa',
    variant: isBlock ? 'danger' : 'primary',
    onConfirm: async () => {
      try {
        await adminApi.updateUser(userId, {
          status: isBlock ? 'blocked' : 'active',
        });
        showToast(
          isBlock
            ? `Đã khóa ${userName}.`
            : `Đã mở khóa ${userName}.`,
          'success',
        );
        onDone();
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : 'Thao tác thất bại.';
        showToast(msg, 'error');
        throw err;
      }
    },
  });
}

/* ─── Helpers ─────────────────────────────────────────────────────────────────── */

function renderSkeletonRows(count: number): string {
  return `
    <div style="padding:0 0 0 0;">
      ${Array.from({ length: count })
        .map(
          () => `
        <div class="skeleton skeleton-row" style="border-radius:0; margin:0;"></div>
      `,
        )
        .join('')}
    </div>
  `;
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}
