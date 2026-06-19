/* ─── Table ──────────────────────────────────────────────────────────────────── */

export interface TableColumn<T> {
  key: string;
  label: string;
  width?: string;
  render?: (value: unknown, row: T) => string; // returns HTML string
}

export function createTable<T>(
  columns: TableColumn<T>[],
  data: T[],
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'table-wrapper';

  const table = document.createElement('table');
  table.className = 'data-table';

  /* Head */
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  columns.forEach((col) => {
    const th = document.createElement('th');
    th.textContent = col.label;
    if (col.width) th.style.width = col.width;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  /* Body */
  const tbody = document.createElement('tbody');

  if (data.length === 0) {
    const emptyRow = document.createElement('tr');
    const emptyTd = document.createElement('td');
    emptyTd.colSpan = columns.length;
    emptyTd.innerHTML = `
      <div class="table-empty">
        <div class="table-empty-icon">📭</div>
        <div class="table-empty-text">Không có dữ liệu</div>
      </div>
    `;
    emptyRow.appendChild(emptyTd);
    tbody.appendChild(emptyRow);
  } else {
    data.forEach((row) => {
      const tr = document.createElement('tr');

      columns.forEach((col) => {
        const td = document.createElement('td');
        const rawValue = (row as any)[col.key];

        if (col.render) {
          td.innerHTML = col.render(rawValue, row);
        } else {
          td.textContent = rawValue != null ? String(rawValue) : '—';
        }

        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  }

  table.appendChild(tbody);
  wrapper.appendChild(table);

  return wrapper;
}

/* ─── Pagination ─────────────────────────────────────────────────────────────── */

export function createPagination(
  currentPage: number,
  total: number,
  limit: number,
  onPage: (page: number) => void,
): HTMLElement {
  const totalPages = Math.ceil(total / limit);
  const start = Math.min((currentPage - 1) * limit + 1, total);
  const end = Math.min(currentPage * limit, total);

  const container = document.createElement('div');
  container.className = 'pagination';

  /* Info */
  const info = document.createElement('span');
  info.className = 'pagination-info';
  info.textContent =
    total === 0
      ? 'Không có kết quả'
      : `Hiển thị ${start}–${end} / ${total} kết quả`;

  /* Controls */
  const controls = document.createElement('div');
  controls.className = 'pagination-controls';

  const makeBtn = (
    label: string,
    page: number,
    isActive = false,
    disabled = false,
  ): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.className = 'page-btn' + (isActive ? ' active' : '');
    btn.textContent = label;
    btn.disabled = disabled;

    if (!disabled) {
      btn.addEventListener('click', () => onPage(page));
    }

    return btn;
  };

  // Previous
  controls.appendChild(makeBtn('‹', currentPage - 1, false, currentPage <= 1));

  // Page numbers — show window of 5 around current
  const windowSize = 5;
  let startPage = Math.max(1, currentPage - Math.floor(windowSize / 2));
  let endPage = startPage + windowSize - 1;

  if (endPage > totalPages) {
    endPage = totalPages;
    startPage = Math.max(1, endPage - windowSize + 1);
  }

  if (startPage > 1) {
    controls.appendChild(makeBtn('1', 1));
    if (startPage > 2) {
      const ellipsis = document.createElement('span');
      ellipsis.className = 'page-btn';
      ellipsis.style.cursor = 'default';
      ellipsis.style.border = 'none';
      ellipsis.textContent = '…';
      controls.appendChild(ellipsis);
    }
  }

  for (let p = startPage; p <= endPage; p++) {
    controls.appendChild(makeBtn(String(p), p, p === currentPage));
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const ellipsis = document.createElement('span');
      ellipsis.className = 'page-btn';
      ellipsis.style.cursor = 'default';
      ellipsis.style.border = 'none';
      ellipsis.textContent = '…';
      controls.appendChild(ellipsis);
    }
    controls.appendChild(makeBtn(String(totalPages), totalPages));
  }

  // Next
  controls.appendChild(
    makeBtn('›', currentPage + 1, false, currentPage >= totalPages),
  );

  container.appendChild(info);
  container.appendChild(controls);

  return container;
}
