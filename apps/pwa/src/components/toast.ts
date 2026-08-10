// ── Toast ─────────────────────────────────────────────────────────────────────

import { loveSparkLoaderMarkup } from './love-spark-loader';
import { createLoveEqLoaderMarkup } from './love-eq-loader';

type ToastType = 'success' | 'error' | 'info' | 'loading' | 'loading-spark';
type ToastIcon = string | (() => string);

let toastContainer: HTMLElement | null = null;
let successIconSequence = 0;

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

export function createSuccessHeartMarkupLight(): string {
  const gradientId = `toastSuccessLoveGrad-${successIconSequence++}`;

  return `<svg class="toast-success-heart light-mode" width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="success">
  <style>
    .toast-success-heart {
      cursor: pointer;
      transform-box: fill-box;
      transform-origin: center;
      animation: toast-success-light-bounce 2.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
    }

    .toast-success-checkmark {
      stroke-dasharray: 12 8 18;
      stroke-dashoffset: 38;
      animation: toast-success-draw-dotted 1.1s 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }

    .toast-success-heart-bg {
      transform-box: fill-box;
      transform-origin: center;
      animation: toast-success-soft-heartbeat 3s ease-in-out infinite;
    }

    @keyframes toast-success-light-bounce {
      0%   { transform: scale(0.6); opacity: 0; }
      45%  { transform: scale(1.18); }
      65%  { transform: scale(0.96); }
      80%  { transform: scale(1.05); }
      100% { transform: scale(1); opacity: 1; }
    }

    @keyframes toast-success-draw-dotted {
      to { stroke-dashoffset: 0; }
    }

    @keyframes toast-success-soft-heartbeat {
      0%, 100% { transform: scale(1); }
      50%      { transform: scale(1.06); }
    }

    @media (prefers-reduced-motion: reduce) {
      .toast-success-heart,
      .toast-success-heart-bg,
      .toast-success-checkmark {
        animation: none;
      }

      .toast-success-checkmark {
        stroke-dashoffset: 0;
      }
    }
  </style>

  <defs>
    <linearGradient id="${gradientId}" x1="12" y1="4" x2="12" y2="20" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FF9EB7"/>
      <stop offset="100%" stop-color="#E81E4E"/>
    </linearGradient>
  </defs>

  <path
    class="toast-success-heart-bg"
    d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.03L12 21.35Z"
    fill="url(#${gradientId})"
    fill-opacity="0.13"
    stroke="#E81E4E"
    stroke-width="1.5"
  />

  <path
    class="toast-success-checkmark"
    d="M8 12L11.5 15.5L16.5 9"
    stroke="#e05263"
    stroke-width="2.4"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
  />
</svg>`;
}

export function createSuccessHeartMarkupDark(): string {
  const gradientId = `toastSuccessLoveGrad-${successIconSequence++}`;

  return `<svg class="toast-success-heart dark-mode" width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="success">
  <style>
    .toast-success-heart {
      cursor: pointer;
      transform-box: fill-box;
      transform-origin: center;
      animation: toast-success-light-bounce 2.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
    }

    .toast-success-checkmark {
      stroke-dasharray: 12 8 18;
      stroke-dashoffset: 38;
      animation: toast-success-draw-dotted 1.1s 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }

    .toast-success-heart-bg {
      transform-box: fill-box;
      transform-origin: center;
      animation: toast-success-soft-heartbeat 3s ease-in-out infinite;
    }

    @keyframes toast-success-light-bounce {
      0%   { transform: scale(0.6); opacity: 0; }
      45%  { transform: scale(1.18); }
      65%  { transform: scale(0.96); }
      80%  { transform: scale(1.05); }
      100% { transform: scale(1); opacity: 1; }
    }

    @keyframes toast-success-draw-dotted {
      to { stroke-dashoffset: 0; }
    }

    @keyframes toast-success-soft-heartbeat {
      0%, 100% { transform: scale(1); }
      50%      { transform: scale(1.06); }
    }

    @media (prefers-reduced-motion: reduce) {
      .toast-success-heart,
      .toast-success-heart-bg,
      .toast-success-checkmark {
        animation: none;
      }

      .toast-success-checkmark {
        stroke-dashoffset: 0;
      }
    }
  </style>

  <defs>
    <linearGradient id="${gradientId}" x1="12" y1="4" x2="12" y2="20" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FF9EB7"/>
      <stop offset="100%" stop-color="#E81E4E"/>
    </linearGradient>
  </defs>

  <path
    class="toast-success-heart-bg"
    d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.03L12 21.35Z"
    fill="url(#${gradientId})"
    fill-opacity="0.13"
    stroke="#E81E4E"
    stroke-width="1.5"
  />

  <path
    class="toast-success-checkmark"
    d="M8 12L11.5 15.5L16.5 9"
    stroke="#FFFB9E"
    stroke-width="2.4"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
  />
</svg>`;
}

export function createSuccessHeartMarkup(): string {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return isDark ? createSuccessHeartMarkupDark() : createSuccessHeartMarkupLight();
}

const errorHeartMarkup = `<svg class="toast-error-heart" width="34" height="34" viewBox="-4 0 32 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="error">
  <style>
    .toast-error-heart {
      cursor: pointer;
      transform-box: fill-box;
      transform-origin: center;
      animation: toast-error-crazy-shake 3s ease-in-out infinite;
      filter: drop-shadow(0 6px 18px rgba(216, 15, 69, 0.75))
              drop-shadow(0 2px 8px rgba(255, 46, 95, 0.6));
    }

    @keyframes toast-error-crazy-shake {
      0%     { transform: translate(0, 0) rotate(0deg); }
      8%     { transform: translate(-5.5px, 3.2px) rotate(-6.5deg); }
      16%    { transform: translate(5.5px, -3.2px) rotate(6.5deg); }
      24%    { transform: translate(-6px, 3.5px) rotate(-7deg); }
      32%    { transform: translate(6px, -3.5px) rotate(7deg); }
      50%    { transform: translate(0, 0) rotate(0deg); }
      58%    { transform: translate(-5.5px, 3.2px) rotate(-6.5deg); }
      66%    { transform: translate(5.5px, -3.2px) rotate(6.5deg); }
      74%    { transform: translate(-6px, 3.4px) rotate(-6.8deg); }
      82%    { transform: translate(6px, -3.4px) rotate(6.8deg); }
      100%   { transform: translate(0, 0) rotate(0deg); }
    }

    @media (prefers-reduced-motion: reduce) {
      .toast-error-heart { animation: none; }
    }
  </style>

  <defs>
    <linearGradient id="toastErrorRoseGrad" x1="12" y1="4" x2="12" y2="21" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FF738F"/>
      <stop offset="50%" stop-color="#FF2E5F"/>
      <stop offset="100%" stop-color="#D80F45"/>
    </linearGradient>
  </defs>

  <path
    d="M12 21.35L10.55 20.03C5.4 15.36 2 12.28 2 8.5C2 5.42 4.42 3 7.5 3C9.24 3 10.91 3.81 12 5.09C13.09 3.81 14.76 3 16.5 3C19.58 3 22 5.42 22 8.5C22 12.28 18.6 15.36 13.45 20.03L12 21.35Z"
    fill="url(#toastErrorRoseGrad)"
    stroke="#C80A3F"
    stroke-width="1.8"
  />

  <path d="M12 8.5V13.5" stroke="#FFFD9F" stroke-width="2.4" stroke-linecap="round"/>
  <circle cx="12" cy="16.5" r="1.2" fill="#FFFD9F"/>
</svg>`;

const ICONS: Record<ToastType, ToastIcon> = {
  success: createSuccessHeartMarkup,
  error: errorHeartMarkup,
  info: createLoveEqLoaderMarkup,
  'loading-spark': loveSparkLoaderMarkup,
  loading: `<svg class="loveChat" viewBox="0 0 100 100" width="112" height="112" xmlns="http://www.w3.org/2000/svg" aria-label="love chat loader">
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

function getIconMarkup(type: ToastType): string {
  const icon = ICONS[type];
  return typeof icon === 'function' ? icon() : icon;
}

export function showToast(message: string, type: ToastType = 'info'): void {
  const container = getContainer();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type} animate-slide-down`;
  toast.setAttribute('role', 'status');
  toast.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${getIconMarkup(type)}</span>
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
