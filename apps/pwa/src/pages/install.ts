import { navigate } from '../router';

// ── Install Page ──────────────────────────────────────────────────────────────

export function renderInstallPage(): HTMLElement {
  // Detect if already in standalone mode → redirect immediately
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  if (isStandalone) {
    requestAnimationFrame(() => navigate('/onboarding', true));
    return document.createElement('div');
  }

  // Detect iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;

  const page = document.createElement('div');
  page.className = 'page-no-nav animate-fade-in';
  page.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100dvh;
    padding: 32px 24px;
    gap: 28px;
    text-align: center;
    background: var(--bg);
  `;

  if (!isIOS) {
    // Non-iOS: show brief PWA message and auto-redirect
    page.innerHTML = `
      <div style="font-size:72px;line-height:1" class="animate-pulse">💕</div>
      <div>
        <h1 style="font-size:26px;font-weight:700;letter-spacing:-0.03em;margin-bottom:8px">Check IN Love</h1>
        <p style="font-size:15px;color:var(--text-secondary);line-height:1.6">App check-in riêng tư cho hai đứa.<br>Đang mở ứng dụng...</p>
      </div>
      <div class="spinner" style="width:32px;height:32px;border-width:3px"></div>
    `;
    setTimeout(() => navigate('/onboarding', true), 2000);
    return page;
  }

  // iOS guide
  page.innerHTML = `
    <div style="font-size:72px;line-height:1" class="animate-pulse">💕</div>

    <div>
      <h1 style="font-size:26px;font-weight:700;letter-spacing:-0.03em;margin-bottom:8px">
        Thêm Check IN Love<br>vào màn hình
      </h1>
      <p style="font-size:15px;color:var(--text-secondary);line-height:1.6">
        Để trải nghiệm tốt nhất, hãy thêm app<br>vào màn hình chính của bạn nhé 💕
      </p>
    </div>

    <div class="install-steps">
      <div class="install-step stagger-1 animate-slide-up">
        <span class="install-step-icon">📤</span>
        <span class="install-step-text">Bấm nút <strong>Share</strong> ở thanh dưới cùng Safari</span>
      </div>
      <div class="install-arrow animate-bounce">↓</div>
      <div class="install-step stagger-2 animate-slide-up">
        <span class="install-step-icon">📲</span>
        <span class="install-step-text">Kéo xuống và chọn <strong>"Thêm vào Màn hình chính"</strong></span>
      </div>
      <div class="install-arrow animate-bounce" style="animation-delay:200ms">↓</div>
      <div class="install-step stagger-3 animate-slide-up">
        <span class="install-step-icon">✅</span>
        <span class="install-step-text">Bấm <strong>"Thêm"</strong> rồi mở app từ màn hình chính</span>
      </div>
    </div>

    <div style="width:100%;max-width:320px;margin-top:8px">
      <div style="
        background:var(--accent-soft);
        border:1px solid var(--accent);
        border-radius:16px;
        padding:14px 16px;
        display:flex;
        align-items:center;
        gap:10px;
        text-align:left;
      ">
        <span style="font-size:22px">💡</span>
        <span style="font-size:13px;color:var(--accent);line-height:1.5;font-weight:500">
          Nút Share trông như thế này: <strong>□↑</strong> ở thanh dưới cùng trình duyệt Safari
        </span>
      </div>
    </div>

    <button
      id="skip-install-btn"
      class="btn-ghost"
      style="margin-top:8px;font-size:14px"
    >
      Bỏ qua, tiếp tục trong trình duyệt
    </button>
  `;

  page.querySelector('#skip-install-btn')?.addEventListener('click', () => {
    navigate('/onboarding', true);
  });

  return page;
}
