// ── Toast ─────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info';

let toastContainer: HTMLElement | null = null;

function getContainer(): HTMLElement {
  if (!toastContainer || !document.body.contains(toastContainer)) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.setAttribute('aria-live', 'polite');
    toastContainer.setAttribute('aria-atomic', 'true');
    (document.getElementById('toast-root') ?? document.body).appendChild(toastContainer);
  }
  return toastContainer;
}

const ICONS: Record<ToastType, string> = {
  success: `<lottie-player src="/icons8-correct.json" background="transparent" speed="1.2" style="width: 28px; height: 28px;" autoplay></lottie-player>`,
  error: `<img src="/icons8-error.gif" style="width: 28px; height: 28px; object-fit: contain;" alt="error" />`,
  info: `<svg class="loveChat" viewBox="0 0 100 100" width="112" height="112" xmlns="http://www.w3.org/2000/svg" aria-label="love chat loader">
    <style>
      .loveChat .b1,
      .loveChat .b2 {
        transform-box: fill-box;
        transform-origin: center;
      }

      .loveChat .b1 {
        animation: lc-left 3s ease-in-out infinite;
      }

      .loveChat .b2 {
        animation: lc-right 3s ease-in-out infinite;
      }

      @keyframes lc-left {
        0%,100% { transform: translate(-5px, 5px) scale(.88); opacity: .55; }
        50% { transform: translate(2px, -4px) scale(1); opacity: 1; }
      }

      @keyframes lc-right {
        0%,100% { transform: translate(5px, -4px) scale(.88); opacity: .55; }
        50% { transform: translate(-2px, 5px) scale(1); opacity: 1; }
      }
    </style>

    <g class="b1">
      <path d="M14 24h48a10 10 0 0 1 10 10v20a10 10 0 0 1-10 10H36L24 76V64H14A10 10 0 0 1 4 54V34a10 10 0 0 1 10-10Z"
        fill="#ff6fae" opacity=".9"/>
      <path d="M38 53c-10-7-13-11-13-16 0-5 3-8 8-8 3 0 6 2 7 5 2-3 4-5 8-5 4 0 8 3 8 8 0 5-4 9-18 16Z"
        fill="#fff"/>
    </g>

    <g class="b2">
      <path d="M45 46h41a9 9 0 0 1 9 9v17a9 9 0 0 1-9 9H67L57 89v-8H45a9 9 0 0 1-9-9V55a9 9 0 0 1 9-9Z"
        fill="#b69cff" opacity=".92"/>
    </g>
  </svg>`,
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

  // Auto remove after 3s
  const removeTimeout = setTimeout(() => {
    removeToast(toast);
  }, 3000);

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
