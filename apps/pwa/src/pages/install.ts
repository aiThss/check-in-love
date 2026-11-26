import '../styles/20-pages/auth.css';
import { navigate } from '../router';
import { iconMarkup } from '../ui/icons/icons';
import { createBadge, createButton } from '../ui/primitives';

function detectInAppBrowser(ua: string): string | null {
  if (/Zalo/i.test(ua)) return 'Zalo';
  if (/FBAN|FBAV|Messenger/i.test(ua)) return 'Facebook / Messenger';
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/BytedanceWebview|Musical_ly|TikTok/i.test(ua)) return 'TikTok';
  return null;
}

export function renderInstallPage(): HTMLElement {
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;

  if (isStandalone) {
    requestAnimationFrame(() => navigate('/onboarding', true));
    return document.createElement('div');
  }

  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
  const inAppName = detectInAppBrowser(ua);

  const page = document.createElement('div');
  page.className = 'page-no-nav p-auth animate-fade-in';
  page.style.justifyContent = 'center';

  if (!isIOS && !inAppName) {
    page.innerHTML = `
      <div class="p-auth-hero" style="margin:auto;">
        <div class="p-auth-emblem">${iconMarkup('couple', { size: 32, variant: 'filled' })}</div>
        <h1 class="p-auth-title">Check IN Love</h1>
        <p class="p-auth-sub">Không gian check-in riêng tư của hai đứa.<br>Đang chuẩn bị mở ứng dụng...</p>
      </div>
    `;
    setTimeout(() => navigate('/onboarding', true), 1200);
    return page;
  }

  const main = document.createElement('main');
  main.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:18px;margin:auto 0;';

  main.appendChild(createBadge('Trải nghiệm trọn vẹn nhất', 'gold'));

  const hero = document.createElement('div');
  hero.className = 'p-auth-hero';
  hero.innerHTML = `
    <div class="p-auth-emblem">${iconMarkup('install', { size: 32, variant: 'filled' })}</div>
    <h1 class="p-auth-title">Thêm Check IN Love vào màn hình chính</h1>
    <p class="p-auth-sub">Mở toàn màn hình mượt như ứng dụng riêng và nhận thông báo tức thì khi người ấy gửi ảnh.</p>
  `;
  main.appendChild(hero);

  if (inAppName) {
    const alert = document.createElement('div');
    alert.className = 'p-install-alert';
    alert.innerHTML = `
      ${iconMarkup('alert', { size: 20, variant: 'filled' })}
      <div>
        <strong>Bạn đang mở trong ${inAppName}.</strong><br>
        Hãy bấm nút menu <strong>⋯</strong> ở góc trên và chọn <strong>"Mở bằng trình duyệt Safari / Chrome"</strong> để cài đặt ứng dụng nhé.
      </div>
    `;
    main.appendChild(alert);
  }

  const steps = document.createElement('div');
  steps.className = 'p-install-steps';
  steps.innerHTML = `
    <div class="p-install-step">
      <span class="p-install-step__num">${iconMarkup('share', { size: 20 })}</span>
      <div>
        <strong style="display:block;font-size:14px;">Bước 1 · Bấm nút Chia sẻ (Share)</strong>
        <span class="u-text-secondary" style="font-size:12px;">Nằm ở thanh công cụ dưới cùng của trình duyệt Safari.</span>
      </div>
    </div>
    <div class="p-install-step">
      <span class="p-install-step__num">${iconMarkup('install', { size: 20 })}</span>
      <div>
        <strong style="display:block;font-size:14px;">Bước 2 · Chọn "Thêm vào Màn hình chính"</strong>
        <span class="u-text-secondary" style="font-size:12px;">Cuộn nhẹ danh sách tuỳ chọn rồi chạm "Add to Home Screen".</span>
      </div>
    </div>
    <div class="p-install-step">
      <span class="p-install-step__num">${iconMarkup('heart', { size: 20, variant: 'filled' })}</span>
      <div>
        <strong style="display:block;font-size:14px;">Bước 3 · Mở biểu tượng từ Màn hình chính</strong>
        <span class="u-text-secondary" style="font-size:12px;">Bấm "Thêm" ở góc phải trên cùng là hoàn tất.</span>
      </div>
    </div>
  `;
  main.appendChild(steps);

  const skipBtn = createButton({
    label: 'Tiếp tục ngay trong trình duyệt',
    variant: 'ghost',
    pill: true,
    block: true,
    onClick: () => navigate('/onboarding', true),
  });
  skipBtn.element.id = 'skip-install-btn';
  main.appendChild(skipBtn.element);

  page.appendChild(main);
  return page;
}
