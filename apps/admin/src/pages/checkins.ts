import { adminApi, CheckIn } from '../api/admin';
import { createSidebar, createSidebarOverlay } from '../components/sidebar';
import { buildHeader } from './dashboard';
import { createTable, createPagination, TableColumn } from '../components/table';
import { showConfirmModal, showToast } from '../components/modal';
import { ApiError } from '../api/client';

export function renderCheckinsPage(): HTMLElement {
  const layout = document.createElement('div');
  layout.className = 'layout';

  const overlay = createSidebarOverlay();
  const sidebar = createSidebar('/checkins');

  const main = document.createElement('div');
  main.className = 'main-content';
  main.appendChild(buildHeader('Check-ins'));

  const content = document.createElement('div');
  content.className = 'page-content';

  const card = document.createElement('div');
  card.className = 'card';

  /* Card header with toolbar */
  const cardHeader = document.createElement('div');
  cardHeader.className = 'card-header';

  const cardTitle = document.createElement('span');
  cardTitle.className = 'card-title';
  cardTitle.textContent = 'Danh sách Check-ins';

  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';

  /* Include deleted toggle */
  const checkboxLabel = document.createElement('label');
  checkboxLabel.className = 'checkbox-label';

  const includeDeletedCheckbox = document.createElement('input');
  includeDeletedCheckbox.type = 'checkbox';
  includeDeletedCheckbox.id = 'include-deleted';

  const checkboxText = document.createElement('span');
  checkboxText.textContent = 'Bao gồm đã xóa';

  checkboxLabel.appendChild(includeDeletedCheckbox);
  checkboxLabel.appendChild(checkboxText);
  toolbar.appendChild(checkboxLabel);

  cardHeader.appendChild(cardTitle);
  cardHeader.appendChild(toolbar);

  const tableContainer = document.createElement('div');
  tableContainer.innerHTML = buildSkeletonRows(5);

  const paginationContainer = document.createElement('div');

  card.appendChild(cardHeader);
  card.appendChild(tableContainer);
  card.appendChild(paginationContainer);

  content.appendChild(card);
  main.appendChild(content);

  layout.appendChild(overlay);
  layout.appendChild(sidebar);
  layout.appendChild(main);

  let currentPage = 1;
  let includeDeleted = false;

  const load = async (page: number, withDeleted: boolean) => {
    currentPage = page;
    includeDeleted = withDeleted;
    tableContainer.innerHTML = buildSkeletonRows(5);
    paginationContainer.innerHTML = '';

    try {
      const res = await adminApi.getCheckins(page, withDeleted);

      const columns: TableColumn<CheckIn>[] = [
        {
          key: 'imageUrl',
          label: 'Media',
          width: '70px',
          render: (_v, row) => {
            if (row.imageUrl) {
              return `<img class="table-thumbnail" src="${row.imageUrl}" alt="Check-in" loading="lazy">`;
            }
            const typeIcon: Record<string, string> = {
              photo: '🖼️',
              text: '📝',
              mood: '😊',
            };
            return `<div class="table-thumbnail-placeholder">${typeIcon[row.type] ?? '📸'}</div>`;
          },
        },
        {
          key: 'senderName',
          label: 'Người gửi',
          render: (_v, row) => `
            <div class="user-cell">
              <div class="user-avatar" style="width:28px;height:28px;font-size:11px;">
                ${row.senderAvatar ? `<img src="${row.senderAvatar}" alt="${escapeHtml(row.senderName)}" loading="lazy">` : escapeHtml(initials(row.senderName))}
              </div>
              <div class="user-info-name">${escapeHtml(row.senderName)}</div>
            </div>
          `,
        },
        {
          key: 'type',
          label: 'Loại',
          render: (_v, row) => {
            const typeLabels: Record<string, string> = {
              photo: '📸 Ảnh',
              text: '📝 Văn bản',
              mood: '😊 Tâm trạng',
            };
            return `<span class="badge badge-info">${typeLabels[row.type] ?? row.type}</span>`;
          },
        },
        {
          key: 'caption',
          label: 'Caption / Mood',
          render: (_v, row) => {
            const text = row.caption ?? row.mood ?? '';
            return text
              ? `<span style="color:var(--text-secondary);font-size:13px;" title="${escapeHtml(text)}">${escapeHtml(truncate(text, 50))}</span>`
              : '<span style="color:var(--text-muted)">—</span>';
          },
        },
        {
          key: 'status',
          label: 'Trạng thái',
          render: (_v, row) =>
            row.status === 'active'
              ? '<span class="badge badge-active">Hoạt động</span>'
              : '<span class="badge badge-deleted">Đã xóa</span>',
        },
        {
          key: 'createdAt',
          label: 'Ngày tạo',
          render: (_v, row) =>
            `<span style="color:var(--text-secondary);font-size:13px;">${formatDate(row.createdAt)}</span>`,
        },
        {
          key: 'id',
          label: 'Hành động',
          width: '110px',
          render: (_v, row) => {
            if (row.status === 'deleted') {
              return '<span style="color:var(--text-muted);font-size:12px;">Đã xóa</span>';
            }
            return `
              <div class="actions-cell">
                <button
                  class="btn btn-sm btn-danger"
                  data-action="delete"
                  data-id="${row.id}"
                  data-sender="${escapeHtml(row.senderName)}"
                >
                  🗑️ Xóa
                </button>
              </div>
            `;
          },
        },
      ];

      tableContainer.innerHTML = '';
      tableContainer.appendChild(createTable<CheckIn>(columns, res.data));

      /* Attach delete handlers */
      tableContainer.querySelectorAll('[data-action="delete"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const checkinId = btn.getAttribute('data-id') ?? '';
          const senderName = btn.getAttribute('data-sender') ?? '';
          handleDelete(checkinId, senderName, () =>
            load(currentPage, includeDeleted),
          );
        });
      });

      paginationContainer.innerHTML = '';
      paginationContainer.appendChild(
        createPagination(res.page, res.total, res.limit, (p) =>
          load(p, includeDeleted),
        ),
      );
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Lỗi tải dữ liệu.';
      tableContainer.innerHTML = `<div class="alert alert-danger" style="margin:16px;">⚠️ ${escapeHtml(msg)}</div>`;
    }
  };

  includeDeletedCheckbox.addEventListener('change', () => {
    load(1, includeDeletedCheckbox.checked);
  });

  load(1, false);

  return layout;
}

function handleDelete(
  checkinId: string,
  senderName: string,
  onDone: () => void,
): void {
  showConfirmModal({
    icon: '🗑️',
    title: 'Xóa Check-in?',
    description: `Bạn có chắc muốn xóa check-in của <strong>${escapeHtml(senderName)}</strong>? Hành động này là xóa mềm.`,
    confirmLabel: 'Xóa',
    variant: 'danger',
    onConfirm: async () => {
      try {
        await adminApi.deleteCheckin(checkinId);
        showToast('Đã xóa check-in.', 'success');
        onDone();
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : 'Xóa thất bại.';
        showToast(msg, 'error');
        throw err;
      }
    },
  });
}

/* ─── Helpers ─────────────────────────────────────────────────────────────────── */

function buildSkeletonRows(count: number): string {
  return `<div>${Array.from({ length: count })
    .map(
      () =>
        `<div class="skeleton skeleton-row" style="border-radius:0;margin:0;"></div>`,
    )
    .join('')}</div>`;
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + '…' : str;
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
