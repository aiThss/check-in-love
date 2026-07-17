import './styles/tokens.css';
import './styles/components.css';
import './styles/animations.css';
import { store } from './store/index';
import { initRouter, navigate } from './router';
import { clearPrivateClientState } from './session';
import { logger } from './utils/logger';
import { initKeyboardViewport } from './utils/keyboard';
import { ensurePushSubscription, setupAndroidFcm } from './api/push';
import { showModal } from './components/modal';

// ─── App-wide state integrations ─────────────────────────────────────────────
store.initTheme();
initKeyboardViewport();

// Restore check-in reminder timer after reload (browser-only best-effort)
void import('./pages/profile').then(({ restoreReminderOnLoad }) => restoreReminderOnLoad());

// Detect APK wrapper and add helper class to documentElement
if (navigator.userAgent.includes('LoveCheckAndroidWrapper')) {
  document.documentElement.classList.add('android-wrapper');
}

setupAndroidFcm();

// ─── Service Worker ───────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  const isAndroidWrapper = navigator.userAgent.includes('LoveCheckAndroidWrapper');
  if (isAndroidWrapper) {
    // Android WebView: unregister all existing SWs so the WebView always
    // fetches fresh code from the network (prevents stale-bundle issues).
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister());
    }).catch(() => {});

    // Force clear Cache Storage (PWA offline cache)
    if ('caches' in window) {
      caches.keys().then((keys) => {
        return Promise.all(keys.map((key) => caches.delete(key)));
      }).catch(() => {});
    }
  } else {
    // PWA (iOS / desktop): register service worker normally for offline support
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          watchForServiceWorkerUpdate(registration);
          if (store.isAuthenticated() && 'Notification' in window && Notification.permission === 'granted') {
            ensurePushSubscription(false).catch((err) => {
              logger.warn('Push subscription refresh failed', err);
            });
          }
        })
        .catch((err) => {
          logger.warn('SW registration failed', err);
        });
    });
  }
}

function watchForServiceWorkerUpdate(registration: ServiceWorkerRegistration): void {
  const offerUpdate = () => {
    const waitingWorker = registration.waiting;
    // A first install has no old app version to replace.
    if (!waitingWorker || !navigator.serviceWorker.controller) return;

    showModal({
      title: 'Đã có bản cập nhật mới',
      content: 'Cập nhật ngay để dùng phiên bản mới nhất? Dữ liệu đang mở sẽ được giữ lại.',
      confirmText: 'Cập nhật',
      cancelText: 'Để sau',
      onConfirm: () => {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload();
        }, { once: true });
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

// ─── iOS PWA Detection ────────────────────────────────────────────────────────
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;
const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

// Blocked page
function renderBlockedPage(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'page blocked-page animate-fade-in';
  el.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:32px;';
  el.innerHTML = `
    <div style="font-size:64px;margin-bottom:24px;">🔒</div>
    <h1 style="font-size:24px;font-weight:700;margin-bottom:12px;color:var(--text-primary);">Tài khoản bị tạm khóa</h1>
    <p style="color:var(--text-secondary);margin-bottom:32px;line-height:1.6;">
      Vui lòng liên hệ để được hỗ trợ mở khóa tài khoản.
    </p>
    <button id="blocked-logout" class="btn-primary">Đăng xuất</button>
  `;
  el.querySelector('#blocked-logout')?.addEventListener('click', () => {
    clearPrivateClientState();
    navigate('/onboarding', true);
  });
  return el;
}

// ─── Init Router ──────────────────────────────────────────────────────────────
initRouter({
  '/':           () => {
    if (store.isAuthenticated()) return import('./pages/home').then(({ renderHomePage }) => renderHomePage());
    if (isIOS && !isStandalone) return import('./pages/install').then(({ renderInstallPage }) => renderInstallPage());
    return import('./pages/onboarding').then(({ renderOnboardingPage }) => renderOnboardingPage());
  },
  '/install':    () => import('./pages/install').then(({ renderInstallPage }) => renderInstallPage()),
  '/login':      () => import('./pages/login').then(({ renderLoginPage }) => renderLoginPage()),
  '/onboarding': () => import('./pages/onboarding').then(({ renderOnboardingPage }) => renderOnboardingPage()),
  '/blocked':    () => renderBlockedPage(),
  '/app/home':      () => import('./pages/home').then(({ renderHomePage }) => renderHomePage()),
  '/app/checkin':   () => import('./pages/checkin').then(({ renderCheckinPage }) => renderCheckinPage()),
  '/app/memories':  () => import('./pages/memories').then(({ renderMemoriesPage }) => renderMemoriesPage()),
  '/app/random':    () => import('./pages/random').then(({ renderRandomPage }) => renderRandomPage()),
  '/app/profile':   () => import('./pages/profile').then(({ renderProfilePage }) => renderProfilePage()),
  '/app/messages':  () => import('./pages/messages').then(({ renderMessagesPage }) => renderMessagesPage()),
});

const prefetchCommonRoutes = () => {
  void Promise.all([
    import('./pages/memories'),
    import('./pages/profile'),
    import('./pages/checkin'),
  ]);
};

const idleWindow = window as Window & {
  requestIdleCallback?: (callback: () => void) => number;
};
if (typeof idleWindow.requestIdleCallback === 'function') {
  idleWindow.requestIdleCallback(prefetchCommonRoutes);
} else {
  globalThis.setTimeout(prefetchCommonRoutes, 700);
}
