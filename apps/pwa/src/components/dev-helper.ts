import { navigate, getCurrentPath } from '../router';
import { showToast } from './toast';

export function initDevHelper(): void {
  // Only mount once
  if (document.getElementById('dev-helper-root')) return;

  const root = document.createElement('div');
  root.id = 'dev-helper-root';
  root.className = 'dev-helper-root';

  // Restore saved position if available
  const savedLeft = sessionStorage.getItem('dev_bubble_left');
  const savedTop = sessionStorage.getItem('dev_bubble_top');
  if (savedLeft && savedTop) {
    root.style.left = `${savedLeft}px`;
    root.style.top = `${savedTop}px`;
    root.style.right = 'auto';
    root.style.bottom = 'auto';
  }

  root.innerHTML = `
    <button class="dev-helper-toggle-btn" id="dev-toggle-btn" title="Kéo thả di chuyển / Click mở Dev Panel">
      <span class="dev-icon">📌</span>
      <span class="dev-label">Pin</span>
    </button>

    <div class="dev-helper-panel hidden-dev-panel" id="dev-panel">
      <div class="dev-panel-header">
        <strong>🛠️ Dev Quick Jump & Test</strong>
        <button class="dev-panel-close" id="dev-close-btn">✕</button>
      </div>

      <div class="dev-section-title">📍 Nhảy nhanh các trang & bước</div>
      <div class="dev-quick-links">
        <button class="dev-jump-btn" data-target="step-0">1️⃣ Step 1: Tên của bạn</button>
        <button class="dev-jump-btn" data-target="step-1">2️⃣ Step 2: Tên người ấy</button>
        <button class="dev-jump-btn" data-target="step-2">3️⃣ Step 3: Couple Code</button>
        <button class="dev-jump-btn" data-target="step-3">4️⃣ Step 4: Chọn Ngày yêu</button>
        <button class="dev-jump-btn" data-target="login-email">✉️ Login: Email & OTP</button>
        <button class="dev-jump-btn" data-target="login-google">🌐 Login: Google</button>
      </div>

      <div class="dev-section-title">🔔 Test Toast & Thông báo</div>
      <div class="dev-noti-links">
        <button class="dev-noti-btn" data-noti="success">💖 Success (Tim tích)</button>
        <button class="dev-noti-btn" data-noti="error">💔 Error (Tim vỡ lắc)</button>
        <button class="dev-noti-btn" data-noti="info">🎵 Info (Love EQ Sóng)</button>
        <button class="dev-noti-btn" data-noti="spark">✨ Loading (Love Spark)</button>
        <button class="dev-noti-btn" data-noti="chat">💬 Loading (Love Chat)</button>
      </div>

      <div class="dev-panel-footer">
        <button class="btn-dev-action" id="dev-fill-mock-btn">⚡ Điền dữ liệu mẫu</button>
        <button class="btn-dev-action btn-danger-sm" id="dev-clear-btn">🔄 Reset</button>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  const toggleBtn = root.querySelector<HTMLButtonElement>('#dev-toggle-btn')!;
  const panel = root.querySelector<HTMLElement>('#dev-panel')!;
  const closeBtn = root.querySelector<HTMLButtonElement>('#dev-close-btn')!;
  const fillMockBtn = root.querySelector<HTMLButtonElement>('#dev-fill-mock-btn')!;
  const clearBtn = root.querySelector<HTMLButtonElement>('#dev-clear-btn')!;

  // ── Drag & Drop Floating Bubble Logic ────────────────────────────────────
  let isDragging = false;
  let hasDragged = false;
  let startX = 0;
  let startY = 0;
  let initialLeft = 0;
  let initialTop = 0;

  function onDragStart(clientX: number, clientY: number) {
    isDragging = true;
    hasDragged = false;
    startX = clientX;
    startY = clientY;
    const rect = root.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;
  }

  function onDragMove(clientX: number, clientY: number) {
    if (!isDragging) return;
    const deltaX = clientX - startX;
    const deltaY = clientY - startY;

    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      hasDragged = true;
    }

    if (hasDragged) {
      const newLeft = Math.max(10, Math.min(window.innerWidth - 70, initialLeft + deltaX));
      const newTop = Math.max(10, Math.min(window.innerHeight - 50, initialTop + deltaY));

      root.style.left = `${newLeft}px`;
      root.style.top = `${newTop}px`;
      root.style.right = 'auto';
      root.style.bottom = 'auto';

      sessionStorage.setItem('dev_bubble_left', String(newLeft));
      sessionStorage.setItem('dev_bubble_top', String(newTop));
    }
  }

  function onDragEnd() {
    isDragging = false;
  }

  // Mouse Drag Events
  toggleBtn.addEventListener('mousedown', (e) => {
    onDragStart(e.clientX, e.clientY);

    const onMouseMove = (moveEvent: MouseEvent) => {
      onDragMove(moveEvent.clientX, moveEvent.clientY);
    };

    const onMouseUp = () => {
      onDragEnd();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });

  // Touch Drag Events (Mobile & Touch Emulation)
  toggleBtn.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    if (touch) onDragStart(touch.clientX, touch.clientY);
  }, { passive: true });

  toggleBtn.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    if (touch) onDragMove(touch.clientX, touch.clientY);
  }, { passive: true });

  toggleBtn.addEventListener('touchend', () => {
    onDragEnd();
  });

  toggleBtn.addEventListener('click', (e) => {
    if (hasDragged) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
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

  // Handle Notification Tests
  root.querySelectorAll<HTMLButtonElement>('.dev-noti-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const notiType = btn.getAttribute('data-noti');
      switch (notiType) {
        case 'success':
          showToast('Đã lưu cài đặt kỷ niệm thành công! 💕', 'success');
          break;
        case 'error':
          showToast('Mật khẩu không chính xác, vui lòng thử lại! 💔', 'error');
          break;
        case 'info':
          showToast('Đang kết nối Love Equalizer... 🎵', 'info');
          break;
        case 'spark':
          showToast('Đang tải dữ liệu lãng mạn... ✨', 'loading-spark');
          break;
        case 'chat':
          showToast('Đang gửi tin nhắn tình yêu... 💬', 'loading');
          break;
      }
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
    sessionStorage.removeItem('dev_bubble_left');
    sessionStorage.removeItem('dev_bubble_top');
    window.location.reload();
  });
}
