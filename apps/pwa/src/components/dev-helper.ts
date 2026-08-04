import { navigate, getCurrentPath } from '../router';

export function initDevHelper(): void {
  // Only mount once
  if (document.getElementById('dev-helper-root')) return;

  const root = document.createElement('div');
  root.id = 'dev-helper-root';
  root.className = 'dev-helper-root';

  root.innerHTML = `
    <button class="dev-helper-toggle-btn" id="dev-toggle-btn" title="Mở bảng điều khiển Dev">
      <span class="dev-icon">📌</span>
      <span class="dev-label">Ghim Trang Dev</span>
    </button>

    <div class="dev-helper-panel glass-card hidden-dev-panel" id="dev-panel">
      <div class="dev-panel-header">
        <strong>🛠️ Dev Quick Jump & Pin</strong>
        <button class="dev-panel-close" id="dev-close-btn">✕</button>
      </div>
      <p class="dev-panel-desc">Giữ đúng trang & bước đang sửa khi Ctrl+S (HMR Reload).</p>

      <div class="dev-quick-links">
        <button class="dev-jump-btn" data-target="step-0">1️⃣ Step 1: Tên của bạn</button>
        <button class="dev-jump-btn" data-target="step-1">2️⃣ Step 2: Tên người ấy</button>
        <button class="dev-jump-btn" data-target="step-2">3️⃣ Step 3: Couple Code</button>
        <button class="dev-jump-btn" data-target="step-3">4️⃣ Step 4: Ngày yêu</button>
        <button class="dev-jump-btn" data-target="login-email">✉️ Login: Email & OTP</button>
        <button class="dev-jump-btn" data-target="login-google">🌐 Login: Google</button>
      </div>

      <div class="dev-panel-footer">
        <button class="btn-dev-action" id="dev-fill-mock-btn">⚡ Điền dữ liệu mẫu</button>
        <button class="btn-dev-action btn-danger-sm" id="dev-clear-btn">🔄 Reset</button>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  const toggleBtn = root.querySelector('#dev-toggle-btn')!;
  const panel = root.querySelector('#dev-panel')!;
  const closeBtn = root.querySelector('#dev-close-btn')!;
  const fillMockBtn = root.querySelector('#dev-fill-mock-btn')!;
  const clearBtn = root.querySelector('#dev-clear-btn')!;

  toggleBtn.addEventListener('click', () => {
    panel.classList.toggle('hidden-dev-panel');
  });

  closeBtn.addEventListener('click', () => {
    panel.classList.add('hidden-dev-panel');
  });

  // Handle Quick Jumps
  root.querySelectorAll<HTMLButtonElement>('.dev-jump-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      if (!target) return;

      if (target.startsWith('step-')) {
        const stepNum = parseInt(target.replace('step-', ''), 10);
        sessionStorage.setItem('dev_onboarding_step', String(stepNum));
        if (getCurrentPath() === '/onboarding') {
          window.location.reload();
        } else {
          navigate('/onboarding', true);
        }
      } else if (target === 'login-email') {
        sessionStorage.setItem('dev_login_tab', 'email');
        if (getCurrentPath() === '/login') {
          window.location.reload();
        } else {
          navigate('/login', true);
        }
      } else if (target === 'login-google') {
        sessionStorage.setItem('dev_login_tab', 'google');
        if (getCurrentPath() === '/login') {
          window.location.reload();
        } else {
          navigate('/login', true);
        }
      }
      panel.classList.add('hidden-dev-panel');
    });
  });

  // Fill Mock Test Data Action
  fillMockBtn.addEventListener('click', () => {
    sessionStorage.setItem('dev_onboarding_displayName', 'Danh Thái');
    sessionStorage.setItem('dev_onboarding_partnerName', 'Phương Trang');
    sessionStorage.setItem('dev_onboarding_coupleCode', 'LOVE2026');
    sessionStorage.setItem('dev_onboarding_loveStartDate', '2024-01-01');
    sessionStorage.setItem('dev_onboarding_email', 'danhthai4560@gmail.com');
    sessionStorage.setItem('dev_onboarding_useAccount', 'true');
    window.location.reload();
  });

  // Clear Dev Cache
  clearBtn.addEventListener('click', () => {
    sessionStorage.removeItem('dev_onboarding_step');
    sessionStorage.removeItem('dev_onboarding_displayName');
    sessionStorage.removeItem('dev_onboarding_partnerName');
    sessionStorage.removeItem('dev_onboarding_coupleCode');
    sessionStorage.removeItem('dev_onboarding_loveStartDate');
    sessionStorage.removeItem('dev_onboarding_email');
    sessionStorage.removeItem('dev_onboarding_useAccount');
    sessionStorage.removeItem('dev_login_tab');
    window.location.reload();
  });
}
