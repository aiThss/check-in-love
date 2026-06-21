import './styles/tokens.css';
import './styles/components.css';
import './styles/animations.css';
import { store } from './store/index';
import { initRouter } from './router';
import { logger } from './utils/logger';
import { renderInstallPage } from './pages/install';
import { renderLoginPage } from './pages/login';
import { renderOnboardingPage } from './pages/onboarding';
import { renderHomePage } from './pages/home';
import { renderCheckinPage } from './pages/checkin';
import { renderMemoriesPage } from './pages/memories';
import { renderRandomPage } from './pages/random';
import { renderProfilePage } from './pages/profile';
import { ensurePushSubscription, setupAndroidFcm } from './api/push';

// ─── Apply Theme ─────────────────────────────────────────────────────────────
function applyTheme() {
  const state = store.get();
  const theme = state.theme;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  const useDark = theme === 'dark' || (theme === 'system' && prefersDark);
  document.documentElement.setAttribute('data-theme', useDark ? 'dark' : 'light');
}

applyTheme();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
setupAndroidFcm();

// ─── Service Worker ───────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => {
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
    store.clear();
    window.location.href = '/onboarding';
  });
  return el;
}

// ─── Init Router ──────────────────────────────────────────────────────────────
initRouter({
  '/':           () => {
    if (store.isAuthenticated()) return renderHomePage();
    if (isIOS && !isStandalone) return renderInstallPage();
    return renderOnboardingPage();
  },
  '/install':    () => renderInstallPage(),
  '/login':      () => renderLoginPage(),
  '/onboarding': () => renderOnboardingPage(),
  '/blocked':    () => renderBlockedPage(),
  '/app/home':      () => renderHomePage(),
  '/app/checkin':   () => renderCheckinPage(),
  '/app/memories':  () => renderMemoriesPage(),
  '/app/random':    () => renderRandomPage(),
  '/app/profile':   () => renderProfilePage(),
});
