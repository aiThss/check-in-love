import { icon } from './icons/icons';
import { triggerHaptic } from './haptics';

export const INSTALL_DISMISSED_KEY = 'lovecheck_ui_v2_install_dismissed';

/** Sự kiện `beforeinstallprompt` (chưa có trong lib.dom). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PromptAction {
  label: string;
  primary?: boolean;
  onClick: () => void;
}

function getHost(): HTMLElement {
  let host = document.getElementById('c-pwa-prompts');
  if (!host) {
    host = document.createElement('div');
    host.id = 'c-pwa-prompts';
    host.className = 'c-pwa-prompts';
    document.body.appendChild(host);
  }
  return host;
}

function buildPrompt(id: string, iconName: 'refresh' | 'install', title: string, text: string, actions: PromptAction[]): HTMLElement {
  const el = document.createElement('div');
  el.className = 'c-pwa-prompt';
  el.dataset.prompt = id;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');

  const iconWrap = document.createElement('span');
  iconWrap.className = 'c-pwa-prompt__icon';
  iconWrap.setAttribute('aria-hidden', 'true');
  iconWrap.appendChild(icon(iconName, { size: 24 }));

  const body = document.createElement('div');
  body.className = 'c-pwa-prompt__body';
  const titleEl = document.createElement('strong');
  titleEl.textContent = title;
  const textEl = document.createElement('span');
  textEl.textContent = text;
  body.append(titleEl, textEl);

  const actionsEl = document.createElement('div');
  actionsEl.className = 'c-pwa-prompt__actions';
  for (const action of actions) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = action.primary ? 'c-pwa-prompt__btn is-primary' : 'c-pwa-prompt__btn';
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      triggerHaptic('tap');
      action.onClick();
    });
    actionsEl.appendChild(btn);
  }

  el.append(iconWrap, body, actionsEl);
  return el;
}

function dismissPrompt(el: HTMLElement): void {
  el.classList.add('is-leaving');
  const remove = () => el.remove();
  el.addEventListener('animationend', remove, { once: true });
  window.setTimeout(remove, 400);
}

/**
 * Toast cập nhật không chặn màn hình. `onConfirm` do caller cung cấp để giữ nguyên
 * luồng waiting worker + `controllerchange` ở main.ts.
 */
export function showUpdateToast(onConfirm: () => void): HTMLElement {
  const host = getHost();
  const existing = host.querySelector<HTMLElement>('[data-prompt="update"]');
  if (existing) return existing;

  const el = buildPrompt('update', 'refresh', 'Có phiên bản mới', 'Cập nhật để dùng bản mới nhất, dữ liệu vẫn được giữ nguyên.', [
    { label: 'Để sau', onClick: () => dismissPrompt(el) },
    { label: 'Cập nhật', primary: true, onClick: () => { dismissPrompt(el); onConfirm(); } },
  ]);
  host.appendChild(el);
  return el;
}

export function isInstallPromptDismissed(): boolean {
  try {
    return localStorage.getItem(INSTALL_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function isStandaloneDisplay(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches === true
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function showInstallBanner(deferred: BeforeInstallPromptEvent): void {
  const host = getHost();
  if (host.querySelector('[data-prompt="install"]')) return;

  const el = buildPrompt('install', 'install', 'Cài Check IN Love', 'Thêm vào màn hình chính để mở nhanh và nhận thông báo.', [
    {
      label: 'Để sau',
      onClick: () => {
        try { localStorage.setItem(INSTALL_DISMISSED_KEY, '1'); } catch { /* storage không khả dụng */ }
        dismissPrompt(el);
      },
    },
    {
      label: 'Cài đặt',
      primary: true,
      onClick: () => {
        dismissPrompt(el);
        void deferred.prompt()
          .then(() => deferred.userChoice)
          .then((choice) => {
            if (choice.outcome === 'dismissed') {
              try { localStorage.setItem(INSTALL_DISMISSED_KEY, '1'); } catch { /* storage không khả dụng */ }
            }
          })
          .catch(() => {});
      },
    },
  ]);
  host.appendChild(el);
}

/**
 * Banner cài đặt thông minh: chỉ hiện khi trình duyệt cho phép cài, người dùng đã
 * đăng nhập, chưa chọn "Để sau", và sau một khoảng chờ để không che trải nghiệm đầu.
 */
export function initInstallPrompt(options: { isAuthenticated: () => boolean; delayMs?: number }): void {
  if (isStandaloneDisplay() || isInstallPromptDismissed()) return;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    if (isInstallPromptDismissed()) return;
    const deferred = event as BeforeInstallPromptEvent;
    window.setTimeout(() => {
      if (options.isAuthenticated() && !isInstallPromptDismissed()) showInstallBanner(deferred);
    }, options.delayMs ?? 15000);
  });

  window.addEventListener('appinstalled', () => {
    document.querySelector<HTMLElement>('[data-prompt="install"]')?.remove();
  });
}
