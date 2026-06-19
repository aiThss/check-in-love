import { adminApi, Couple } from '../api/admin';
import { createSidebar, createSidebarOverlay } from '../components/sidebar';
import { buildHeader } from './dashboard';
import { createTable, createPagination, TableColumn } from '../components/table';
import { showFormModal, showToast } from '../components/modal';
import { ApiError } from '../api/client';

export function renderCouplesPage(): HTMLElement {
  const layout = document.createElement('div');
  layout.className = 'layout';

  const overlay = createSidebarOverlay();
  const sidebar = createSidebar('/couples');

  const main = document.createElement('div');
  main.className = 'main-content';
  main.appendChild(buildHeader('Couples'));

  const content = document.createElement('div');
  content.className = 'page-content';

  const card = document.createElement('div');
  card.className = 'card';

  /* Card header */
  const cardHeader = document.createElement('div');
  cardHeader.className = 'card-header';

  const cardTitle = document.createElement('span');
  cardTitle.className = 'card-title';
  cardTitle.textContent = 'Danh sách Couples';

  cardHeader.appendChild(cardTitle);

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

  const load = async (page: number) => {
    currentPage = page;
    tableContainer.innerHTML = buildSkeletonRows(5);
    paginationContainer.innerHTML = '';

    try {
      const res = await adminApi.getCouples(page);

      const columns: TableColumn<Couple>[] = [
        {
          key: 'code',
          label: 'Code',
          render: (_v, row) =>
            `<span class="mono">${escapeHtml(row.code)}</span>`,
        },
        {
          key: 'members',
          label: 'Thành viên',
          render: (_v, row) => {
            if (!row.members || row.members.length === 0)
              return '<span style="color:var(--text-muted)">—</span>';
            return row.members
              .map(
                (m) => `
              <div class="user-cell" style="margin-bottom:4px;">
                <div class="user-avatar" style="width:28px;height:28px;font-size:11px;">
                  ${m.avatarUrl ? `<img src="${m.avatarUrl}" alt="${escapeHtml(m.name)}" loading="lazy">` : escapeHtml(initials(m.name))}
                </div>
                <div>
                  <div style="font-size:13px;font-weight:600;">${escapeHtml(m.name)}</div>
                  <div style="font-size:11px;color:var(--text-muted);">${escapeHtml(m.email)}</div>
                </div>
              </div>
            `,
              )
              .join('');
          },
        },
        {
          key: 'loveStartDate',
          label: 'Ngày yêu bắt đầu',
          render: (_v, row) =>
            row.loveStartDate
              ? `<span class="badge badge-accent">❤️ ${formatDate(row.loveStartDate)}</span>`
              : '<span style="color:var(--text-muted)">Chưa đặt</span>',
        },
        {
          key: 'streak',
          label: 'Streak',
          render: (_v, row) =>
            `<span class="badge badge-success">🔥 ${row.streak ?? 0} ngày</span>`,
        },
        {
          key: 'createdAt',
          label: 'Ngày tạo',
          render: (_v, row) =>
            `<span style="color:var(--text-secondary)">${formatDate(row.createdAt)}</span>`,
        },
        {
          key: 'id',
          label: 'Hành động',
          width: '120px',
          render: (_v, row) => `
            <div class="actions-cell">
              <button
                class="btn btn-sm btn-ghost"
                data-action="edit"
                data-id="${row.id}"
                data-code="${escapeHtml(row.code)}"
                data-love-start="${row.loveStartDate ?? ''}"
                title="Chỉnh sửa ngày yêu"
              >
                ✏️ Sửa
              </button>
            </div>
          `,
        },
      ];

      tableContainer.innerHTML = '';
      tableContainer.appendChild(createTable<Couple>(columns, res.data));

      /* Attach edit handlers */
      tableContainer.querySelectorAll('[data-action="edit"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const coupleId = btn.getAttribute('data-id') ?? '';
          const coupleCode = btn.getAttribute('data-code') ?? '';
          const currentDate = btn.getAttribute('data-love-start') ?? '';
          openEditModal(coupleId, coupleCode, currentDate, () =>
            load(currentPage),
          );
        });
      });

      paginationContainer.innerHTML = '';
      paginationContainer.appendChild(
        createPagination(res.page, res.total, res.limit, (p) => load(p)),
      );
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Lỗi tải dữ liệu.';
      tableContainer.innerHTML = `<div class="alert alert-danger" style="margin:16px;">⚠️ ${escapeHtml(msg)}</div>`;
    }
  };

  load(1);

  return layout;
}

function openEditModal(
  coupleId: string,
  coupleCode: string,
  currentDate: string,
  onDone: () => void,
): void {
  const formContent = document.createElement('div');

  const group = document.createElement('div');
  group.className = 'form-group';

  const label = document.createElement('label');
  label.className = 'form-label';
  label.setAttribute('for', 'love-start-date');
  label.textContent = `Ngày yêu bắt đầu — Couple ${coupleCode}`;

  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.id = 'love-start-date';
  dateInput.className = 'form-input';
  dateInput.value = currentDate ? currentDate.slice(0, 10) : '';
  dateInput.max = new Date().toISOString().slice(0, 10);

  const hint = document.createElement('span');
  hint.className = 'form-hint';
  hint.textContent = 'Để trống sẽ xóa ngày yêu bắt đầu.';

  group.appendChild(label);
  group.appendChild(dateInput);
  group.appendChild(hint);
  formContent.appendChild(group);

  showFormModal({
    title: '✏️ Chỉnh sửa Couple',
    content: formContent,
    confirmLabel: 'Lưu thay đổi',
    onConfirm: async () => {
      const newDate = dateInput.value || undefined;
      try {
        await adminApi.updateCouple(coupleId, {
          loveStartDate: newDate,
        });
        showToast('Đã cập nhật ngày yêu bắt đầu.', 'success');
        onDone();
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : 'Cập nhật thất bại.';
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
