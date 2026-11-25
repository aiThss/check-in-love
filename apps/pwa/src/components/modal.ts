import { closeHistoryLayer, openHistoryLayer } from '../router';

// ── Modal (v2 Harmonized with Focus Trap, ESC & History Layer) ────────────────

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

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let activeOverlay: HTMLElement | null = null;
let activeHistoryLayerId: string | null = null;
let activeKeyHandler: ((event: KeyboardEvent) => void) | null = null;
let previousFocusedEl: HTMLElement | null = null;

function removeOverlay(overlay: HTMLElement, keyHandler: (event: KeyboardEvent) => void): void {
  document.removeEventListener('keydown', keyHandler);
  overlay.remove();

  if (activeOverlay === overlay) {
    activeOverlay = null;
    activeHistoryLayerId = null;
    activeKeyHandler = null;
  }
  if (!activeOverlay) {
    document.body.style.overflow = '';
    previousFocusedEl?.focus?.();
    previousFocusedEl = null;
  }
}

export function showModal(options: ModalOptions): void {
  previousFocusedEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const overlay = document.createElement('div');
  const overlayClasses = ['modal-overlay', 'c-modal-overlay-v2'];
  if (options.center) overlayClasses.push('modal-center');
  if (options.overlayClass) overlayClasses.push(...options.overlayClass.split(' '));
  overlay.className = overlayClasses.join(' ');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', options.title);

  const modal = document.createElement('div');
  const modalClasses = ['modal', 'c-modal-v2', 'animate-scale-in'];
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
    p.style.cssText = 'font-size:var(--text-base);color:var(--ink-2);line-height:var(--leading-normal);margin:0;';
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
      cancelBtn.type = 'button';
      cancelBtn.className = 'btn-ghost c-btn c-btn--ghost c-btn--sm';
      cancelBtn.textContent = options.cancelText ?? 'Hủy';
      cancelBtn.addEventListener('click', () => {
        options.onCancel?.();
        closeModal();
      });
      actions.appendChild(cancelBtn);
    }

    if (options.confirmText) {
      const confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = options.danger
        ? 'btn-primary c-btn c-btn--danger c-btn--sm'
        : 'btn-primary c-btn c-btn--primary c-btn--sm';
      confirmBtn.textContent = options.confirmText;
      confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `<span class="c-btn__spinner" aria-hidden="true"></span>`;
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

  // Close on Escape + Accessible Focus Trap
  const keyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      options.onCancel?.();
      closeModal();
      return;
    }
    if (e.key === 'Tab') {
      const focusables = Array.from(modal.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  document.addEventListener('keydown', keyHandler);

  const historyLayerId = openHistoryLayer((reason) => {
    if (reason === 'back') options.onCancel?.();
    removeOverlay(overlay, keyHandler);
  });

  (document.getElementById('modal-root') ?? document.body).appendChild(overlay);
  activeOverlay = overlay;
  activeHistoryLayerId = historyLayerId;
  activeKeyHandler = keyHandler;

  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => {
    modal.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
  });
}

export function closeModal(): void {
  const overlay = activeOverlay;
  const historyLayerId = activeHistoryLayerId;
  const keyHandler = activeKeyHandler;
  if (!overlay || !keyHandler) return;

  removeOverlay(overlay, keyHandler);
  if (historyLayerId) closeHistoryLayer(historyLayerId);
}
