import '../styles/10-components/dev-helper.css';
import { navigate, getCurrentPath } from '../router';
import { showToast } from './toast';
import { store, type AppState } from '../store';
import { iconMarkup } from '../ui/icons/icons';
import {
  clearMockPreviewData,
  clearMockNewUserData,
  MOCK_PREVIEW_TOKEN,
  MOCK_GOOGLE_NEW_USER_TOKEN,
  seedMockPreviewData,
} from '../dev/mock-data';

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
    <div class="dev-helper-actions">
      <button class="dev-theme-toggle-btn" id="dev-theme-toggle-btn" type="button" aria-pressed="false">
        <span class="dev-theme-icon" aria-hidden="true"></span>
      </button>
      <button class="dev-helper-toggle-btn" id="dev-toggle-btn" type="button" aria-label="Mở bảng công cụ Dev" title="Kéo thả di chuyển / Click mở Dev Panel">
        <span class="dev-icon" aria-hidden="true">${iconMarkup('settings', { size: 16 })}</span>
        <span class="dev-label">Dev</span>
      </button>
    </div>

    <div class="dev-helper-panel hidden-dev-panel" id="dev-panel" role="dialog" aria-label="Dev Quick Jump & Test">
      <div class="dev-panel-header">
        <strong>${iconMarkup('settings', { size: 16 })}<span>Dev Quick Jump & Test</span></strong>
        <button class="dev-panel-close" id="dev-close-btn" type="button" aria-label="Đóng bảng Dev">${iconMarkup('close', { size: 16 })}</button>
      </div>

      <div class="dev-section-title">${iconMarkup('route', { size: 16 })}<span>Nhảy nhanh các trang</span></div>
      <div class="dev-quick-links">
        <button class="dev-jump-btn" type="button" data-target="step-0"><span>1. Tên bạn</span></button>
        <button class="dev-jump-btn" type="button" data-target="step-1"><span>2. Người ấy</span></button>
        <button class="dev-jump-btn" type="button" data-target="step-2"><span>3. Couple Code</span></button>
        <button class="dev-jump-btn" type="button" data-target="step-3"><span>4. Ngày yêu</span></button>
        <button class="dev-jump-btn" type="button" data-target="login-email">${iconMarkup('mail', { size: 16 })}<span>Login Email</span></button>
        <button class="dev-jump-btn" type="button" data-target="login-google">${iconMarkup('google', { size: 16 })}<span>Login Google</span></button>
      </div>

      <div class="dev-section-title">${iconMarkup('bell', { size: 16 })}<span>Test Thông báo Toast</span></div>
      <div class="dev-noti-links">
        <button class="dev-noti-btn" type="button" data-noti="checkin-success">${iconMarkup('camera', { size: 16 })}<span>Check-in OK</span></button>
        <button class="dev-noti-btn" type="button" data-noti="checkin-error">${iconMarkup('alert', { size: 16 })}<span>Check-in Lỗi</span></button>
        <button class="dev-noti-btn" type="button" data-noti="eq-info">${iconMarkup('sparkle', { size: 16 })}<span>Love EQ Sóng</span></button>
        <button class="dev-noti-btn" type="button" data-noti="spark-loading">${iconMarkup('star', { size: 16 })}<span>Spark Kỷ niệm</span></button>
        <button class="dev-noti-btn" type="button" data-noti="chat-loading">${iconMarkup('chat', { size: 16 })}<span>Chat Kết nối</span></button>
        <button class="dev-noti-btn" type="button" data-noti="copy-code">${iconMarkup('copy', { size: 16 })}<span>Copy Code</span></button>
        <button class="dev-noti-btn" type="button" data-noti="otp-sent">${iconMarkup('mail', { size: 16 })}<span>Gửi Mã OTP</span></button>
      </div>

      <div class="dev-panel-footer">
        <button class="btn-dev-action" type="button" id="dev-load-preview-btn">${iconMarkup('sparkle', { size: 16 })}<span>Demo đầy đủ</span></button>
        <button class="btn-dev-action" type="button" id="dev-fill-mock-btn">${iconMarkup('edit', { size: 16 })}<span>Điền mẫu</span></button>
        <button class="btn-dev-action btn-danger-sm" type="button" id="dev-clear-btn">${iconMarkup('refresh', { size: 16 })}<span>Reset</span></button>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  const toggleBtn = root.querySelector<HTMLButtonElement>('#dev-toggle-btn')!;
  const themeToggleBtn = root.querySelector<HTMLButtonElement>('#dev-theme-toggle-btn')!;
  const themeIcon = root.querySelector<HTMLElement>('.dev-theme-icon')!;
  const panel = root.querySelector<HTMLElement>('#dev-panel')!;
  const closeBtn = root.querySelector<HTMLButtonElement>('#dev-close-btn')!;
  const loadPreviewBtn = root.querySelector<HTMLButtonElement>('#dev-load-preview-btn')!;
  const fillMockBtn = root.querySelector<HTMLButtonElement>('#dev-fill-mock-btn')!;
  const clearBtn = root.querySelector<HTMLButtonElement>('#dev-clear-btn')!;

  const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

  function getEffectiveTheme(theme: AppState['theme']): 'light' | 'dark' {
    if (theme === 'system') return systemThemeQuery.matches ? 'dark' : 'light';
    return theme;
  }

  function updateThemeToggle(theme: AppState['theme']): void {
    const isDark = getEffectiveTheme(theme) === 'dark';
    themeIcon.innerHTML = iconMarkup(isDark ? 'sun' : 'moon', { size: 16 });
    const targetTheme = isDark ? 'sáng' : 'tối';
    const label = `Chuyển sang giao diện ${targetTheme}`;
    themeToggleBtn.title = label;
    themeToggleBtn.setAttribute('aria-label', label);
    themeToggleBtn.setAttribute('aria-pressed', String(isDark));
  }

  updateThemeToggle(store.get().theme);
  store.subscribe((state) => updateThemeToggle(state.theme));
  systemThemeQuery.addEventListener('change', () => {
    if (store.get().theme === 'system') updateThemeToggle('system');
  });

  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = getEffectiveTheme(store.get().theme);
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    store.set({ theme: nextTheme });
    showToast(`Đã chuyển sang giao diện ${nextTheme === 'dark' ? 'tối' : 'sáng'}.`, 'success');
  });

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

  // Handle Real PWA Notification Tests
  root.querySelectorAll<HTMLButtonElement>('.dev-noti-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const notiType = btn.getAttribute('data-noti');
      switch (notiType) {
        case 'checkin-success':
          showToast('Gửi check-in thành công! 💕', 'success');
          break;
        case 'checkin-error':
          showToast('Vui lòng chọn hoặc chụp ảnh!', 'error');
          break;
        case 'eq-info':
          showToast('Upload ảnh chưa ổn, đang thử bản nhẹ hơn... 🎵', 'info');
          break;
        case 'spark-loading':
          showToast('Đang tải lại kỷ niệm... ✨', 'loading-spark');
          break;
        case 'chat-loading':
          showToast('Đang kết nối trò chuyện... 💬', 'loading');
          break;
        case 'copy-code':
          showToast('Đã sao chép couple code!', 'success');
          break;
        case 'otp-sent':
          showToast('Mã OTP đã được gửi tới email của bạn! ✉️', 'success');
          break;
      }
    });
  });

  // Load a complete local preview dataset so every app page has realistic data.
  loadPreviewBtn.addEventListener('click', () => {
    clearMockNewUserData();
    const preview = seedMockPreviewData();
    store.set({
      token: MOCK_PREVIEW_TOKEN,
      user: preview.user,
      couple: preview.couple,
    });
    showToast('Đã nạp đầy đủ dữ liệu demo local!', 'success');
    panel.classList.add('hidden-dev-panel');
    navigate('/app/home', true);
  });

  // Fill Mock Test Data Action
  fillMockBtn.addEventListener('click', () => {
    sessionStorage.setItem('dev_onboarding_displayName', 'Danh Thái');
    sessionStorage.setItem('dev_onboarding_partnerName', 'Thúy Hà');
    sessionStorage.setItem('dev_onboarding_coupleCode', 'LOVE2026');
    sessionStorage.setItem('dev_onboarding_loveStartDate', '2024-01-01');
    sessionStorage.setItem('dev_onboarding_email', 'danhthai4560@gmail.com');
    sessionStorage.setItem('dev_onboarding_useAccount', 'true');
    window.location.reload();
  });

  // Clear Dev Cache
  clearBtn.addEventListener('click', () => {
    clearMockPreviewData();
    clearMockNewUserData();
    if (store.get().token === MOCK_PREVIEW_TOKEN || store.get().token === MOCK_GOOGLE_NEW_USER_TOKEN) {
      store.clear();
    }
    sessionStorage.removeItem('google_authenticated_user');
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
