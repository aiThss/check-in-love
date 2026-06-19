export interface ModalOptions {
  icon?: string;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary' | 'warning';
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

export interface FormModalOptions {
  title: string;
  content: HTMLElement;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

/* ─── Confirm Modal ──────────────────────────────────────────────────────────── */
export function showConfirmModal(options: ModalOptions): void {
  const {
    icon,
    title,
    description,
    confirmLabel = 'Xác nhận',
    cancelLabel = 'Hủy',
    variant = 'danger',
    onConfirm,
    onCancel,
  } = options;

  const variantClass: Record<string, string> = {
    danger: 'btn-danger',
    primary: 'btn-primary',
    warning: 'btn-warning',
  };

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'modal-title');

  modal.innerHTML = `
    <div class="modal-header">
      ${icon ? `<div class="modal-icon">${icon}</div>` : ''}
      <div class="modal-title" id="modal-title">${title}</div>
      ${description ? `<div class="modal-desc">${description}</div>` : ''}
    </div>
  `;

  const footer = document.createElement('div');
  footer.className = 'modal-footer';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-ghost';
  cancelBtn.textContent = cancelLabel;

  const confirmBtn = document.createElement('button');
  confirmBtn.className = `btn ${variantClass[variant] ?? 'btn-primary'}`;
  confirmBtn.textContent = confirmLabel;

  const close = () => {
    overlay.remove();
    onCancel?.();
  };

  cancelBtn.addEventListener('click', close);

  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `<span class="spinner"></span> ${confirmLabel}`;
    try {
      await onConfirm();
    } finally {
      overlay.remove();
    }
  });

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  // Close on Escape
  const keyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', keyHandler);
    }
  };
  document.addEventListener('keydown', keyHandler);

  footer.appendChild(cancelBtn);
  footer.appendChild(confirmBtn);
  modal.appendChild(footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Focus confirm button
  setTimeout(() => confirmBtn.focus(), 50);
}

/* ─── Form Modal ─────────────────────────────────────────────────────────────── */
export function showFormModal(options: FormModalOptions): void {
  const {
    title,
    content,
    confirmLabel = 'Lưu',
    cancelLabel = 'Hủy',
    onConfirm,
    onCancel,
  } = options;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal modal-lg';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'form-modal-title');

  const header = document.createElement('div');
  header.className = 'modal-header';
  header.innerHTML = `<div class="modal-title" id="form-modal-title">${title}</div>`;

  const body = document.createElement('div');
  body.className = 'modal-body';
  body.appendChild(content);

  const footer = document.createElement('div');
  footer.className = 'modal-footer';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-ghost';
  cancelBtn.textContent = cancelLabel;

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'btn btn-primary';
  confirmBtn.textContent = confirmLabel;

  const close = () => {
    overlay.remove();
    onCancel?.();
  };

  cancelBtn.addEventListener('click', close);

  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `<span class="spinner"></span> ${confirmLabel}`;
    try {
      await onConfirm();
      overlay.remove();
    } catch {
      confirmBtn.disabled = false;
      confirmBtn.textContent = confirmLabel;
    }
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  const keyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', keyHandler);
    }
  };
  document.addEventListener('keydown', keyHandler);

  footer.appendChild(cancelBtn);
  footer.appendChild(confirmBtn);

  modal.appendChild(header);
  modal.appendChild(body);
  modal.appendChild(footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  setTimeout(() => confirmBtn.focus(), 50);
}

/* ─── Toast Notification ─────────────────────────────────────────────────────── */
export function showToast(
  message: string,
  type: 'success' | 'error' | 'info' = 'success',
  duration = 3500,
): void {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };

  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    box-shadow: var(--shadow-lg);
    z-index: 2000;
    animation: slideUp 0.2s ease;
    max-width: 320px;
  `;

  toast.innerHTML = `<span style="font-size: 18px;">${icons[type]}</span><span>${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
