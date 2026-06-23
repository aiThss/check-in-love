// ── Modal ─────────────────────────────────────────────────────────────────────

export interface ModalOptions {
  title: string;
  content: HTMLElement | string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  danger?: boolean;
  center?: boolean;
  /** CSS class(es) to add directly to the overlay element at creation time */
  overlayClass?: string;
  /** CSS class(es) to add directly to the modal element at creation time */
  modalClass?: string;
}

let activeOverlay: HTMLElement | null = null;

export function showModal(options: ModalOptions): void {
  // Remove any existing modal
  closeModal();

  const overlay = document.createElement('div');
  const overlayClasses = ['modal-overlay'];
  if (options.center) overlayClasses.push('modal-center');
  if (options.overlayClass) overlayClasses.push(...options.overlayClass.split(' '));
  overlay.className = overlayClasses.join(' ');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', options.title);

  const modal = document.createElement('div');
  const modalClasses = ['modal', 'animate-scale-in'];
  if (options.modalClass) modalClasses.push(...options.modalClass.split(' '));
  modal.className = modalClasses.join(' ');

  // Title
  const title = document.createElement('h2');
  title.className = 'modal-title';
  title.textContent = options.title;
  modal.appendChild(title);

  // Content
  if (typeof options.content === 'string') {
    const p = document.createElement('p');
    p.style.cssText = 'font-size:15px;color:var(--text-secondary);line-height:1.6;';
    p.textContent = options.content;
    modal.appendChild(p);
  } else {
    modal.appendChild(options.content);
  }

  // Actions
  if (options.confirmText || options.cancelText) {
    const actions = document.createElement('div');
    actions.className = 'modal-actions';

    if (options.cancelText !== undefined || options.onConfirm) {
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn-ghost';
      cancelBtn.textContent = options.cancelText ?? 'Hủy';
      cancelBtn.addEventListener('click', () => {
        options.onCancel?.();
        closeModal();
      });
      actions.appendChild(cancelBtn);
    }

    if (options.confirmText) {
      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'btn-primary';
      if (options.danger) {
        confirmBtn.style.background = '#ef4444';
      }
      confirmBtn.textContent = options.confirmText;
      confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `<span class="spinner" style="width:18px;height:18px;border-width:2px"></span>`;
        try {
          await options.onConfirm?.();
          closeModal();
        } catch {
          confirmBtn.disabled = false;
          confirmBtn.textContent = options.confirmText!;
        }
      });
      actions.appendChild(confirmBtn);
    }

    modal.appendChild(actions);
  }

  overlay.appendChild(modal);

  // Close on backdrop click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      options.onCancel?.();
      closeModal();
    }
  });

  // Close on Escape
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      options.onCancel?.();
      closeModal();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  document.body.appendChild(overlay);
  activeOverlay = overlay;

  // Prevent body scroll
  document.body.style.overflow = 'hidden';
}

export function closeModal(): void {
  if (activeOverlay) {
    activeOverlay.remove();
    activeOverlay = null;
    document.body.style.overflow = '';
  }
}
