import './styles/tokens.css';
import './styles/components.css';
import './styles/animations.css';
import './styles/messages-layout-fix.css';
import './styles/message-thread-enhancements.css';
import './styles/auth-interaction-vibe.css';
import { store } from './store/index';
import { initRouter, navigate } from './router';
import { clearPrivateClientState } from './session';
import { logger } from './utils/logger';
import { initKeyboardViewport } from './utils/keyboard';
import { initAuthFocusScroll } from './utils/auth-focus-scroll';
import { initMessageReplyGesture } from './utils/message-reply-gesture';
import { initMessageStickerInput } from './utils/message-sticker-input';
import { initMessageThreadEnhancements } from './utils/message-thread-enhancements';
import { initProfileCopyright } from './utils/profile-copyright';
import { initProfileUiCleanup } from './utils/profile-ui-cleanup';
import { initAnniversaryCards } from './utils/anniversary-cards';
import { ensurePushSubscription, setupAndroidFcm } from './api/push';
import { showModal } from './components/modal';
import { initDevHelper } from './components/dev-helper';

store.initTheme();
initKeyboardViewport();
initAuthFocusScroll();
initMessageReplyGesture();
initMessageStickerInput();
initMessageThreadEnhancements();
initProfileCopyright();
initProfileUiCleanup();
initAnniversaryCards();
const devHost = window.location.hostname;
const isPrivateDevHost = devHost === 'localhost'
  || devHost === '127.0.0.1'
  || devHost.startsWith('192.168.')
  || devHost.startsWith('10.')
  || /^172\.(1[6-9]|2\d|3[01])\./.test(devHost);
const isViteDev = Boolean((import.meta as any).env?.DEV);
if (isViteDev || isPrivateDevHost) {
  initDevHelper();
}
const localDarkGlassVariants = {
  v1: {
    name: 'Slate Pearl',
    surface: 'rgba(36, 44, 54, 0.74)',
    solid: 'rgba(49, 59, 72, 0.72)',
    card: 'linear-gradient(145deg, rgba(102, 119, 140, 0.5), rgba(23, 29, 37, 0.78))',
    child: 'linear-gradient(145deg, rgba(143, 160, 181, 0.28), rgba(48, 58, 70, 0.58))',
    soft: 'rgba(192, 211, 232, 0.14)',
    border: 'rgba(235, 243, 255, 0.24)',
    shadow: '0 16px 38px rgba(0, 0, 0, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.16)',
  },
  v2: {
    name: 'Rose Quartz Smoke',
    surface: 'rgba(48, 42, 53, 0.74)',
    solid: 'rgba(65, 55, 69, 0.72)',
    card: 'linear-gradient(145deg, rgba(130, 108, 133, 0.48), rgba(34, 29, 38, 0.8))',
    child: 'linear-gradient(145deg, rgba(178, 149, 180, 0.25), rgba(66, 54, 69, 0.6))',
    soft: 'rgba(236, 194, 229, 0.14)',
    border: 'rgba(255, 232, 251, 0.22)',
    shadow: '0 16px 38px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.14)',
  },
  v3: {
    name: 'Midnight Sapphire',
    surface: 'rgba(25, 37, 56, 0.76)',
    solid: 'rgba(37, 54, 78, 0.72)',
    card: 'linear-gradient(145deg, rgba(78, 116, 166, 0.5), rgba(15, 24, 39, 0.82))',
    child: 'linear-gradient(145deg, rgba(119, 154, 200, 0.27), rgba(33, 48, 69, 0.62))',
    soft: 'rgba(177, 208, 255, 0.14)',
    border: 'rgba(219, 234, 255, 0.22)',
    shadow: '0 16px 38px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.14)',
  },
  v4: {
    name: 'Silver Graphite',
    surface: 'rgba(39, 42, 47, 0.76)',
    solid: 'rgba(56, 61, 67, 0.72)',
    card: 'linear-gradient(145deg, rgba(121, 130, 140, 0.46), rgba(24, 27, 31, 0.82))',
    child: 'linear-gradient(145deg, rgba(169, 177, 187, 0.24), rgba(55, 60, 67, 0.62))',
    soft: 'rgba(224, 229, 235, 0.14)',
    border: 'rgba(242, 245, 248, 0.22)',
    shadow: '0 16px 38px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.14)',
  },
  v5: {
    name: 'Deep Forest Glass',
    surface: 'rgba(27, 43, 42, 0.76)',
    solid: 'rgba(39, 59, 57, 0.72)',
    card: 'linear-gradient(145deg, rgba(77, 123, 117, 0.48), rgba(17, 31, 31, 0.82))',
    child: 'linear-gradient(145deg, rgba(117, 158, 151, 0.25), rgba(37, 57, 55, 0.62))',
    soft: 'rgba(183, 228, 218, 0.14)',
    border: 'rgba(218, 246, 240, 0.22)',
    shadow: '0 16px 38px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.14)',
  },
  v6: {
    name: 'Pink Mist 08',
    surface: 'rgba(43, 39, 48, 0.74)',
    solid: 'rgba(57, 51, 61, 0.72)',
    card: 'linear-gradient(145deg, rgba(116, 102, 121, 0.44), rgba(31, 27, 36, 0.8))',
    child: 'linear-gradient(145deg, rgba(158, 142, 160, 0.21), rgba(58, 49, 62, 0.6))',
    soft: 'rgba(236, 194, 229, 0.1)',
    border: 'rgba(255, 232, 251, 0.2)',
    shadow: '0 16px 38px rgba(0, 0, 0, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.13)',
  },
  v7: {
    name: 'Pink Mist 14',
    surface: 'rgba(47, 39, 50, 0.74)',
    solid: 'rgba(63, 52, 66, 0.72)',
    card: 'linear-gradient(145deg, rgba(131, 104, 132, 0.47), rgba(35, 27, 39, 0.8))',
    child: 'linear-gradient(145deg, rgba(174, 143, 172, 0.23), rgba(63, 50, 66, 0.6))',
    soft: 'rgba(241, 190, 227, 0.13)',
    border: 'rgba(255, 229, 248, 0.21)',
    shadow: '0 16px 38px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.14)',
  },
  v8: {
    name: 'Pink Mist 20',
    surface: 'rgba(52, 39, 53, 0.74)',
    solid: 'rgba(72, 52, 70, 0.72)',
    card: 'linear-gradient(145deg, rgba(148, 104, 137, 0.5), rgba(39, 26, 42, 0.8))',
    child: 'linear-gradient(145deg, rgba(194, 145, 180, 0.26), rgba(71, 50, 70, 0.6))',
    soft: 'rgba(247, 187, 226, 0.16)',
    border: 'rgba(255, 224, 246, 0.22)',
    shadow: '0 16px 38px rgba(0, 0, 0, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.14)',
  },
  v9: {
    name: 'Pink Mist 28',
    surface: 'rgba(58, 38, 55, 0.74)',
    solid: 'rgba(79, 51, 72, 0.72)',
    card: 'linear-gradient(145deg, rgba(166, 104, 145, 0.52), rgba(43, 25, 45, 0.82))',
    child: 'linear-gradient(145deg, rgba(210, 147, 188, 0.28), rgba(78, 49, 73, 0.62))',
    soft: 'rgba(252, 179, 223, 0.19)',
    border: 'rgba(255, 218, 243, 0.23)',
    shadow: '0 16px 38px rgba(0, 0, 0, 0.27), inset 0 1px 0 rgba(255, 255, 255, 0.14)',
  },
  v10: {
    name: 'Pink Mist 36',
    surface: 'rgba(64, 37, 58, 0.74)',
    solid: 'rgba(87, 50, 75, 0.72)',
    card: 'linear-gradient(145deg, rgba(186, 105, 152, 0.54), rgba(47, 24, 48, 0.82))',
    child: 'linear-gradient(145deg, rgba(223, 150, 194, 0.3), rgba(86, 48, 77, 0.62))',
    soft: 'rgba(255, 171, 218, 0.22)',
    border: 'rgba(255, 211, 240, 0.24)',
    shadow: '0 16px 38px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.14)',
  },
} as const;

type LocalDarkGlassVariant = keyof typeof localDarkGlassVariants;

// Change only this id when testing the next remembered local-only palette.
const selectedLocalDarkGlassVariant: LocalDarkGlassVariant = 'v6';

if (isViteDev) {
  const palette = localDarkGlassVariants[selectedLocalDarkGlassVariant];
  const localDarkCardPreview = document.createElement('style');
  localDarkCardPreview.id = 'dev-local-dark-card-preview';
  localDarkCardPreview.textContent = `
    :root.dev-local-dark-card-preview[data-theme='dark'] {
      --surface: ${palette.surface};
      --surface-solid: ${palette.solid};
      --border: ${palette.border};
      --shadow: ${palette.shadow};
      --shadow-elevated: ${palette.shadow};
    }

    :root.dev-local-dark-card-preview[data-theme='dark'] :is(
      .card, .card-solid, .glass-surface, .glass-card, .glass-profile-card,
      .push-permission-card, .checkin-card, .reaction-picker, .reply-preview,
      .history-item, .install-step, .mood-btn, .photo-drop-area, .modal,
      .bottom-nav-inner, .auth-tabs-wrap, .auth-form-card, .google-login-intro-v2,
      .recent-memory-card
    ) {
      background: ${palette.card} !important;
      border-color: ${palette.border} !important;
      box-shadow: ${palette.shadow} !important;
      -webkit-backdrop-filter: blur(10px) saturate(112%);
      backdrop-filter: blur(10px) saturate(112%);
    }

    :root.dev-local-dark-card-preview[data-theme='dark'] :is(
      .btn-icon, .btn-ghost, .chip, .tab-pills, .mem-icon-btn,
      .memories-search-inner, .reply-button, .reaction-pill,
      .memory-reaction-summary, .memory-react-detail-btn, .memory-reply-count,
      .reaction-option, .theme-segmented, .theme-choice.active,
      .rm-heart-btn, .rm-inline-composer, .reminder-time-row,
      .messages-composer, .chat-bubble, .chat-text-bubble, .chat-reply-bubble,
      .messages-attach-menu, .message-referenced-checkin
    ) {
      background: ${palette.child} !important;
      border-color: ${palette.border} !important;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12) !important;
    }

    :root.dev-local-dark-card-preview[data-theme='dark'] :is(
      .message-quote, .messages-photo-button, .reminder-card-icon,
      .recent-memories-open-all
    ) {
      background: ${palette.soft} !important;
      border-color: ${palette.border} !important;
    }

    :root.dev-local-dark-card-preview[data-theme='dark'] :is(
      .chat-text-message.own .chat-text-bubble,
      .chat-message.own .chat-bubble,
      .chat-reply.own .chat-reply-bubble
    ) {
      background: var(--accent) !important;
      border-color: transparent !important;
    }
  `;
  document.head.appendChild(localDarkCardPreview);
  document.documentElement.classList.add('dev-local-dark-card-preview');
  document.documentElement.dataset.localDarkGlassVariant = selectedLocalDarkGlassVariant;
}

void import('./pages/profile').then(({ restoreReminderOnLoad }) => restoreReminderOnLoad());

if (navigator.userAgent.includes('LoveCheckAndroidWrapper')) {
  document.documentElement.classList.add('android-wrapper');
}

setupAndroidFcm();

function initMemoriesInlineReactionPicker(): void {
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const button = target.closest<HTMLButtonElement>('.memory-mini-composer .rm-reaction-choice');
    if (!button) return;

    const tile = button.closest<HTMLElement>('.memory-tile');
    const picker = tile?.querySelector<HTMLElement>('.memory-reaction-picker');
    if (!picker) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    document.querySelectorAll<HTMLElement>('.memory-reaction-picker.open').forEach((openPicker) => {
      if (openPicker !== picker) openPicker.classList.remove('open');
    });
    picker.classList.toggle('open');
  }, true);
}

initMemoriesInlineReactionPicker();

if ('serviceWorker' in navigator && isViteDev) {
  // A production service worker can otherwise cache old Vite modules and make
  // local UI work appear unchanged after a source edit.
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => registrations.forEach((registration) => registration.unregister()))
    .catch(() => {});
  if ('caches' in window) {
    caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).catch(() => {});
  }
} else if ('serviceWorker' in navigator) {
  const isAndroidWrapper = navigator.userAgent.includes('LoveCheckAndroidWrapper');
  if (isAndroidWrapper) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister());
    }).catch(() => {});
    if ('caches' in window) {
      caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).catch(() => {});
    }
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .then((registration) => {
          watchForServiceWorkerUpdate(registration);
          if (store.isAuthenticated() && 'Notification' in window && Notification.permission === 'granted') {
            ensurePushSubscription(false).catch((err) => logger.warn('Push subscription refresh failed', err));
          }
        })
        .catch((err) => logger.warn('SW registration failed', err));
    });
  }
}

function watchForServiceWorkerUpdate(registration: ServiceWorkerRegistration): void {
  const offerUpdate = () => {
    const waitingWorker = registration.waiting;
    if (!waitingWorker || !navigator.serviceWorker.controller) return;
    showModal({
      title: 'Đã có bản cập nhật mới',
      content: 'Cập nhật ngay để dùng phiên bản mới nhất? Dữ liệu đang mở sẽ được giữ lại.',
      confirmText: 'Cập nhật',
      cancelText: 'Để sau',
      onConfirm: () => {
        navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
        waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      },
    });
  };
  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    installing?.addEventListener('statechange', () => {
      if (installing.state === 'installed') offerUpdate();
    });
  });
  offerUpdate();
}

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isCardPreviewHost = window.location.hostname === 'preview.couple.io.vn' || window.location.hostname === 'preview.babyress.games';

function renderBlockedPage(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'page blocked-page animate-fade-in';
  el.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:32px;';
  el.innerHTML = `<div style="font-size:64px;margin-bottom:24px;">🔒</div><h1 style="font-size:24px;font-weight:700;margin-bottom:12px;color:var(--text-primary);">Tài khoản bị tạm khóa</h1><p style="color:var(--text-secondary);margin-bottom:32px;line-height:1.6;">Vui lòng liên hệ để được hỗ trợ mở khóa tài khoản.</p><button id="blocked-logout" class="btn-primary">Đăng xuất</button>`;
  el.querySelector('#blocked-logout')?.addEventListener('click', () => {
    clearPrivateClientState();
    navigate('/onboarding', true);
  });
  return el;
}

initRouter({
  '/': () => {
    if (isCardPreviewHost) return import('./pages/card-preview').then(({ renderCardPreviewPage }) => renderCardPreviewPage());
    if (store.isAuthenticated()) return import('./pages/home').then(({ renderHomePage }) => renderHomePage());
    if (isIOS && !isStandalone) return import('./pages/install').then(({ renderInstallPage }) => renderInstallPage());
    return import('./pages/onboarding').then(({ renderOnboardingPage }) => renderOnboardingPage());
  },
  '/preview/cards': () => import('./pages/card-preview').then(({ renderCardPreviewPage }) => renderCardPreviewPage()),
  '/test-mail': () => import('./pages/test-mail').then(({ renderTestMailPage }) => renderTestMailPage()),
  '/install': () => import('./pages/install').then(({ renderInstallPage }) => renderInstallPage()),
  '/login': () => import('./pages/login').then(({ renderLoginPage }) => renderLoginPage()),
  '/onboarding': () => import('./pages/onboarding').then(({ renderOnboardingPage }) => renderOnboardingPage()),
  '/app/onboarding': () => import('./pages/onboarding').then(({ renderOnboardingPage }) => renderOnboardingPage()),
  '/app/google-onboarding': () => import('./pages/google-onboarding').then(({ renderGoogleOnboardingPage }) => renderGoogleOnboardingPage()),
  '/blocked': () => renderBlockedPage(),
  '/app/home': () => import('./pages/home').then(({ renderHomePage }) => renderHomePage()),
  '/app/checkin': () => import('./pages/checkin').then(({ renderCheckinPage }) => renderCheckinPage()),
  '/app/memories': () => import('./pages/memories').then(({ renderMemoriesPage }) => renderMemoriesPage()),
  '/app/replies': () => import('./pages/replies').then(({ renderRepliesPage }) => renderRepliesPage()),
  '/app/random': () => import('./pages/random').then(({ renderRandomPage }) => renderRandomPage()),
  '/app/profile': () => import('./pages/profile').then(({ renderProfilePage }) => renderProfilePage()),
  '/app/messages': () => import('./pages/messages').then(({ renderMessagesPage }) => renderMessagesPage()),
});

const prefetchCommonRoutes = () => {
  void Promise.all([import('./pages/memories'), import('./pages/profile'), import('./pages/checkin')]);
};
const idleWindow = window as Window & { requestIdleCallback?: (callback: () => void) => number };
const connection = navigator as Navigator & { connection?: { saveData?: boolean } };
if (!connection.connection?.saveData && !isCardPreviewHost) {
  if (typeof idleWindow.requestIdleCallback === 'function') idleWindow.requestIdleCallback(prefetchCommonRoutes);
  else globalThis.setTimeout(prefetchCommonRoutes, 700);
}
