import { closeHistoryLayer, openHistoryLayer } from '../router';
import { icon, type IconName } from './icons/icons';
import { createButton, createIconButton } from './primitives';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function trapFocus(container: HTMLElement, e: KeyboardEvent): void {
  if (e.key !== 'Tab') return;
  const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
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

// ── Draggable Bottom Sheet (Liquid Glass + Pointer Velocity + History Layer) ──

export interface SheetOptions {
  title?: string;
  content: Node | string;
  onClose?: () => void;
}

export interface SheetController {
  close: () => void;
  element: HTMLElement;
}

export function openSheet(options: SheetOptions): SheetController {
  const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const scrim = document.createElement('div');
  scrim.className = 'c-scrim';

  const sheet = document.createElement('section');
  sheet.className = 'c-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', options.title ?? 'Bảng tùy chọn');

  const handleZone = document.createElement('div');
  handleZone.className = 'c-sheet__handle-zone';
  const handle = document.createElement('div');
  handle.className = 'c-sheet__handle';
  handleZone.appendChild(handle);
  sheet.appendChild(handleZone);

  if (options.title) {
    const header = document.createElement('header');
    header.className = 'c-sheet__header';
    const titleEl = document.createElement('h2');
    titleEl.className = 'c-sheet__title';
    titleEl.textContent = options.title;
    header.appendChild(titleEl);
    header.appendChild(
      createIconButton({
        icon: 'close',
        ariaLabel: 'Đóng bảng',
        variant: 'ghost',
        onClick: () => close(),
      }),
    );
    sheet.appendChild(header);
  }

  const body = document.createElement('div');
  body.className = 'c-sheet__body';
  body.append(options.content);
  sheet.appendChild(body);

  let closed = false;
  let historyId: string | null = null;

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else {
      trapFocus(sheet, e);
    }
  };

  const cleanupDom = (): void => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeyDown);
    scrim.classList.remove('is-open');
    sheet.classList.remove('is-open');
    window.setTimeout(() => {
      scrim.remove();
      sheet.remove();
      previouslyFocused?.focus?.();
    }, 240);
  };

  const close = (): void => {
    if (closed) return;
    const layerToClose = historyId;
    historyId = null;
    options.onClose?.();
    cleanupDom();
    if (layerToClose) closeHistoryLayer(layerToClose);
  };

  historyId = openHistoryLayer((reason) => {
    historyId = null;
    if (reason === 'back') options.onClose?.();
    cleanupDom();
  });

  scrim.addEventListener('click', close);
  document.addEventListener('keydown', onKeyDown);

  // Drag-to-dismiss gesture on handle zone
  let dragStartY = 0;
  let dragDeltaY = 0;
  let dragging = false;

  handleZone.addEventListener('pointerdown', (e) => {
    dragging = true;
    dragStartY = e.clientY;
    dragDeltaY = 0;
    sheet.classList.add('is-dragging');
    try {
      handleZone.setPointerCapture(e.pointerId);
    } catch {}
  });

  handleZone.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dragDeltaY = Math.max(0, e.clientY - dragStartY);
    sheet.style.transform = `translateY(${dragDeltaY}px)`;
  });

  const endDrag = (e: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    sheet.classList.remove('is-dragging');
    try {
      if (handleZone.hasPointerCapture(e.pointerId)) handleZone.releasePointerCapture(e.pointerId);
    } catch {}
    if (dragDeltaY > 96) {
      close();
    } else {
      sheet.style.transform = '';
    }
  };

  handleZone.addEventListener('pointerup', endDrag);
  handleZone.addEventListener('pointercancel', endDrag);

  document.body.append(scrim, sheet);
  requestAnimationFrame(() => {
    scrim.classList.add('is-open');
    sheet.classList.add('is-open');
    sheet.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
  });

  return { close, element: sheet };
}

// ── Accessible Modal Dialog ──────────────────────────────────────────────────

export interface DialogOptions {
  title: string;
  description: string | Node;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

export function openDialog(options: DialogOptions): { close: () => void } {
  const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const scrim = document.createElement('div');
  scrim.className = 'c-scrim';

  const wrap = document.createElement('div');
  wrap.className = 'c-dialog-wrap';

  const dialog = document.createElement('div');
  dialog.className = 'c-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', options.title);

  const title = document.createElement('h2');
  title.className = 'c-dialog__title';
  title.textContent = options.title;
  dialog.appendChild(title);

  const desc = document.createElement('div');
  desc.className = 'c-dialog__desc';
  desc.append(options.description);
  dialog.appendChild(desc);

  const actions = document.createElement('div');
  actions.className = 'c-dialog__actions';

  let closed = false;
  let historyId: string | null = null;

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      options.onCancel?.();
      close();
    } else {
      trapFocus(dialog, e);
    }
  };

  const cleanup = (): void => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeyDown);
    scrim.classList.remove('is-open');
    dialog.classList.remove('is-open');
    window.setTimeout(() => {
      scrim.remove();
      wrap.remove();
      previouslyFocused?.focus?.();
    }, 200);
  };

  const close = (): void => {
    if (closed) return;
    const layer = historyId;
    historyId = null;
    cleanup();
    if (layer) closeHistoryLayer(layer);
  };

  const cancelBtn = createButton({
    label: options.cancelLabel ?? 'Huỷ',
    variant: 'ghost',
    size: 'sm',
    onClick: () => {
      options.onCancel?.();
      close();
    },
  });
  actions.appendChild(cancelBtn.element);

  if (options.confirmLabel) {
    const confirmBtn = createButton({
      label: options.confirmLabel,
      variant: options.danger ? 'danger' : 'primary',
      size: 'sm',
      onClick: async () => {
        confirmBtn.setLoading(true, 'Đang xử lý...');
        try {
          await options.onConfirm?.();
          close();
        } catch {
          confirmBtn.setLoading(false);
        }
      },
    });
    actions.appendChild(confirmBtn.element);
  }

  dialog.appendChild(actions);
  wrap.appendChild(dialog);

  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) {
      options.onCancel?.();
      close();
    }
  });

  historyId = openHistoryLayer((reason) => {
    historyId = null;
    if (reason === 'back') options.onCancel?.();
    cleanup();
  });

  document.addEventListener('keydown', onKeyDown);
  document.body.append(scrim, wrap);
  requestAnimationFrame(() => {
    scrim.classList.add('is-open');
    dialog.classList.add('is-open');
    dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
  });

  return { close };
}

// ── Popover Menu ─────────────────────────────────────────────────────────────

export interface PopoverItem {
  label: string;
  icon?: IconName;
  danger?: boolean;
  onSelect: () => void;
}

export function attachPopoverMenu(anchor: HTMLElement, items: readonly PopoverItem[]): () => void {
  let activeMenu: HTMLElement | null = null;

  const closeMenu = (): void => {
    if (!activeMenu) return;
    activeMenu.remove();
    activeMenu = null;
    anchor.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onOutsidePointer, true);
    document.removeEventListener('keydown', onKeyDown);
  };

  const onOutsidePointer = (e: PointerEvent): void => {
    if (!activeMenu) return;
    const t = e.target as Node | null;
    if (t && (activeMenu.contains(t) || anchor.contains(t))) return;
    closeMenu();
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (!activeMenu) return;
    if (e.key === 'Escape') {
      closeMenu();
      anchor.focus();
      return;
    }
    const btns = Array.from(activeMenu.querySelectorAll<HTMLButtonElement>('.c-popover__item'));
    const idx = btns.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      btns[(idx + 1) % btns.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      btns[(idx - 1 + btns.length) % btns.length]?.focus();
    }
  };

  const toggle = (): void => {
    if (activeMenu) {
      closeMenu();
      return;
    }
    const menu = document.createElement('div');
    menu.className = 'c-popover';
    menu.setAttribute('role', 'menu');

    for (const item of items) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `c-popover__item${item.danger ? ' c-popover__item--danger' : ''}`;
      btn.setAttribute('role', 'menuitem');
      if (item.icon) btn.appendChild(icon(item.icon, { size: 16 }));
      const span = document.createElement('span');
      span.textContent = item.label;
      btn.appendChild(span);
      btn.addEventListener('click', () => {
        closeMenu();
        item.onSelect();
      });
      menu.appendChild(btn);
    }

    document.body.appendChild(menu);
    const rect = anchor.getBoundingClientRect();
    const top = Math.min(window.innerHeight - menu.offsetHeight - 12, rect.bottom + 8);
    const left = Math.max(12, Math.min(window.innerWidth - menu.offsetWidth - 12, rect.right - menu.offsetWidth));
    menu.style.top = `${Math.max(12, top)}px`;
    menu.style.left = `${left}px`;

    activeMenu = menu;
    anchor.setAttribute('aria-expanded', 'true');
    menu.querySelector<HTMLButtonElement>('.c-popover__item')?.focus();
    document.addEventListener('pointerdown', onOutsidePointer, true);
    document.addEventListener('keydown', onKeyDown);
  };

  anchor.setAttribute('aria-haspopup', 'menu');
  anchor.setAttribute('aria-expanded', 'false');
  anchor.addEventListener('click', toggle);

  return () => {
    closeMenu();
    anchor.removeEventListener('click', toggle);
  };
}

// ── v2 Toast Helper ──────────────────────────────────────────────────────────

let v2Stack: HTMLElement | null = null;

export function showUiToast(
  message: string,
  tone: 'success' | 'error' | 'info' = 'info',
  durationMs = 2800,
): HTMLElement {
  if (!v2Stack || !document.body.contains(v2Stack)) {
    v2Stack = document.createElement('div');
    v2Stack.className = 'c-toast-stack';
    v2Stack.setAttribute('aria-live', 'polite');
    document.body.appendChild(v2Stack);
  }

  const toast = document.createElement('div');
  toast.className = 'c-toast';
  toast.setAttribute('role', 'status');

  const iconName: IconName = tone === 'success' ? 'heart' : tone === 'error' ? 'alert' : 'sparkle';
  toast.appendChild(
    icon(iconName, {
      size: 20,
      variant: tone === 'success' ? 'filled' : 'outline',
      motion: tone === 'success' ? 'heartbeat' : tone === 'error' ? 'shake' : 'pop',
    }),
  );

  const text = document.createElement('span');
  text.textContent = message;
  toast.appendChild(text);

  v2Stack.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('is-visible'));

  const dismiss = (): void => {
    toast.classList.remove('is-visible');
    window.setTimeout(() => toast.remove(), 220);
  };

  const timer = window.setTimeout(dismiss, durationMs);
  toast.addEventListener('click', () => {
    window.clearTimeout(timer);
    dismiss();
  });

  return toast;
}
