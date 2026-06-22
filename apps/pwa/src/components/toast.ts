// ── Toast ─────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info';

let toastContainer: HTMLElement | null = null;

function getContainer(): HTMLElement {
  if (!toastContainer || !document.body.contains(toastContainer)) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.setAttribute('aria-live', 'polite');
    toastContainer.setAttribute('aria-atomic', 'true');
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

const ICONS: Record<ToastType, string> = {
  success: `<lottie-player src="/icons8-correct.json" background="transparent" speed="1.2" style="width: 28px; height: 28px;" autoplay></lottie-player>`,
  error: `<img src="/icons8-error.gif" style="width: 28px; height: 28px; object-fit: contain;" alt="error" />`,
  info: `<img src="/icons8-waiting.png" style="width: 28px; height: 28px; object-fit: contain;" alt="info" />`,
};

export function showToast(message: string, type: ToastType = 'info'): void {
  const container = getContainer();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type} animate-slide-down`;
  toast.setAttribute('role', 'status');
  toast.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${ICONS[type]}</span>
    <span class="toast-message">${message}</span>
  `;

  container.appendChild(toast);

  // Auto remove after 5s
  const removeTimeout = setTimeout(() => {
    removeToast(toast);
  }, 5000);

  // Allow tap to dismiss
  toast.addEventListener('click', () => {
    clearTimeout(removeTimeout);
    removeToast(toast);
  });
}

function removeToast(toast: HTMLElement): void {
  toast.classList.add('toast-exit');
  toast.addEventListener('animationend', () => {
    toast.remove();
  }, { once: true });
  
  // Fallback if animationend does not fire
  setTimeout(() => toast.remove(), 500);
}
