import { adminApi, RandomEvent } from '../api/admin';
import { createSidebar, createSidebarOverlay } from '../components/sidebar';
import { buildHeader } from './dashboard';
import { createTable, createPagination, TableColumn } from '../components/table';
import { ApiError } from '../api/client';

export function renderRandomPage(): HTMLElement {
  const layout = document.createElement('div');
  layout.className = 'layout';

  const overlay = createSidebarOverlay();
  const sidebar = createSidebar('/random');

  const main = document.createElement('div');
  main.className = 'main-content';
  main.appendChild(buildHeader('Random Events'));

  const content = document.createElement('div');
  content.className = 'page-content';

  const card = document.createElement('div');
  card.className = 'card';

  const cardHeader = document.createElement('div');
  cardHeader.className = 'card-header';

  const cardTitle = document.createElement('span');
  cardTitle.className = 'card-title';
  cardTitle.textContent = 'Danh sách Random Events';

  const readOnlyBadge = document.createElement('span');
  readOnlyBadge.className = 'badge badge-info';
  readOnlyBadge.textContent = '👁️ Chỉ xem';

  cardHeader.appendChild(cardTitle);
  cardHeader.appendChild(readOnlyBadge);

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

  const load = async (page: number) => {
    tableContainer.innerHTML = buildSkeletonRows(5);
    paginationContainer.innerHTML = '';

    try {
      const res = await adminApi.getRandomEvents(page);

      const columns: TableColumn<RandomEvent>[] = [
        {
          key: 'category',
          label: 'Danh mục',
          width: '140px',
          render: (_v, row) => {
            const categoryColors: Record<string, string> = {
              date: 'badge-accent',
              activity: 'badge-success',
              challenge: 'badge-warning',
              question: 'badge-info',
              gift: 'badge-danger',
            };
            const colorClass =
              categoryColors[row.category.toLowerCase()] ?? 'badge-info';
            return `<span class="badge ${colorClass}">${escapeHtml(capitalize(row.category))}</span>`;
          },
        },
        {
          key: 'prompt',
          label: 'Prompt',
          render: (_v, row) =>
            `<span style="color:var(--text-primary);font-size:14px;" title="${escapeHtml(row.prompt)}">${escapeHtml(truncate(row.prompt, 80))}</span>`,
        },
        {
          key: 'userName',
          label: 'Người dùng',
          render: (_v, row) => `
            <div class="user-cell">
              <div class="user-avatar" style="width:28px;height:28px;font-size:11px;">
                ${escapeHtml(initials(row.userName))}
              </div>
              <div class="user-info-name" style="font-size:13px;">${escapeHtml(row.userName)}</div>
            </div>
          `,
        },
        {
          key: 'coupleName',
          label: 'Couple',
          render: (_v, row) =>
            row.coupleName
              ? `<span class="mono" style="font-size:12px;">${escapeHtml(row.coupleName)}</span>`
              : '<span style="color:var(--text-muted)">—</span>',
        },
        {
          key: 'createdAt',
          label: 'Ngày',
          width: '130px',
          render: (_v, row) =>
            `<span style="color:var(--text-secondary);font-size:13px;">${formatDateTime(row.createdAt)}</span>`,
        },
      ];

      tableContainer.innerHTML = '';
      tableContainer.appendChild(createTable<RandomEvent>(columns, res.data));

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

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
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
    return new Date(iso).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}
