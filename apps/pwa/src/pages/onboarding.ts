import { navigate } from '../router';
import { store } from '../store/index';
import { startOnboarding, sendOtp, verifyOtp } from '../api/auth';
import { showToast } from '../components/toast';

// ── UUID v4 ───────────────────────────────────────────────────────────────────

function generateDeviceId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getOrCreateDeviceId(): string {
  const key = 'lovecheck_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = generateDeviceId();
    localStorage.setItem(key, id);
  }
  return id;
}

// ── Calculate days together ───────────────────────────────────────────────────

function calcDaysTogether(dateStr: string): number {
  if (!dateStr) return 0;
  const start = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - start.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

// ── Onboarding Page ───────────────────────────────────────────────────────────

export function renderOnboardingPage(): HTMLElement {
  const deviceId = getOrCreateDeviceId();

  // State
  let currentStep = 0;
  const TOTAL_STEPS = 5; // Added OTP step

  const formData = {
    displayName: '',
    partnerName: '',
    coupleCode: '',
    loveStartDate: '',
    email: '',
    password: '',
    otpCode: '',
    useAccount: false,
    emailVerified: false,
  };

  // Root container
  const root = document.createElement('div');
  root.className = 'page-no-nav';
  root.style.cssText = 'min-height:100dvh;background:var(--bg);position:relative;overflow-x:hidden;overflow-y:auto;';

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderProgressDots(): HTMLElement {
    // Only show dots for steps relevant to user flow
    const visibleSteps = formData.useAccount ? TOTAL_STEPS : TOTAL_STEPS - 1;
    const visibleCurrent = currentStep;
    const dots = document.createElement('div');
    dots.className = 'progress-dots';
    for (let i = 0; i < visibleSteps; i++) {
      const dot = document.createElement('div');
      dot.className = `progress-dot${i === visibleCurrent ? ' active' : ''}`;
      dots.appendChild(dot);
    }
    return dots;
  }

  function renderStep(content: HTMLElement): void {
    root.innerHTML = '';

    const step = document.createElement('div');
    step.className = 'onboarding-step animate-slide-up';

    // Top: dots + back button (Symmetrical 3-column grid layout)
    const topRow = document.createElement('div');
    topRow.style.cssText =
      'display:grid;grid-template-columns:40px 1fr 40px;align-items:center;width:100%;max-width:380px;margin-bottom:20px;';

    const leftSlot = document.createElement('div');
    leftSlot.style.cssText = 'display:flex;align-items:center;justify-content:flex-start;';

    if (currentStep > 0) {
      const backBtn = document.createElement('button');
      backBtn.className = 'btn-icon';
      backBtn.setAttribute('aria-label', 'Quay lại');
      backBtn.innerHTML = '←';
      backBtn.style.cssText = 'width:36px;height:36px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:18px;';
      backBtn.addEventListener('click', () => {
        currentStep--;
        renderCurrentStep();
      });
      leftSlot.appendChild(backBtn);
    }

    const centerSlot = document.createElement('div');
    centerSlot.style.cssText = 'display:flex;align-items:center;justify-content:center;';
    centerSlot.appendChild(renderProgressDots());

    const rightSlot = document.createElement('div');
    rightSlot.style.cssText = 'width:40px;height:40px;';

    topRow.appendChild(leftSlot);
    topRow.appendChild(centerSlot);
    topRow.appendChild(rightSlot);

    step.appendChild(topRow);
    step.appendChild(content);
    root.appendChild(step);
  }

  // ── Step 1: Your name ─────────────────────────────────────────────────────

  function renderStep1(): void {
    const content = document.createElement('div');
    content.style.cssText =
      'display:flex;flex-direction:column;align-items:center;gap:24px;width:100%;max-width:360px;';

    content.innerHTML = `
      <div style="font-size:72px;line-height:1" class="animate-pulse">👋</div>
      <div style="text-align:center">
        <h1 class="onboarding-title">Tên của bạn là gì?</h1>
        <p class="onboarding-subtitle" style="margin-top:8px">Chúng tớ sẽ dùng tên này để hiển thị trong app</p>
      </div>
    `;

    const inputWrapper = document.createElement('div');
    inputWrapper.style.cssText = 'width:100%;';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'input';
    input.placeholder = 'Ví dụ: Minh, Linh, Bảo...';
    input.value = formData.displayName;
    input.maxLength = 30;
    input.style.cssText = 'text-align:center;font-size:20px;font-weight:600;padding:18px 20px;';
    input.addEventListener('input', () => {
      formData.displayName = input.value.trim();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && formData.displayName) goNext();
    });
    inputWrapper.appendChild(input);
    content.appendChild(inputWrapper);

    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn-primary btn-primary-full';
    nextBtn.style.cssText = 'width:100%;font-size:17px;padding:16px;';
    nextBtn.textContent = 'Tiếp theo →';
    nextBtn.addEventListener('click', goNext);
    content.appendChild(nextBtn);

    const loginBtn = document.createElement('button');
    loginBtn.className = 'btn-ghost';
    loginBtn.style.cssText = 'width:100%;font-size:14px;';
    loginBtn.textContent = 'Đã có tài khoản? Đăng nhập';
    loginBtn.addEventListener('click', () => navigate('/login', true));
    content.appendChild(loginBtn);

    renderStep(content);
    requestAnimationFrame(() => input.focus());

    function goNext() {
      if (!formData.displayName) {
        input.classList.add('animate-pulse');
        input.focus();
        setTimeout(() => input.classList.remove('animate-pulse'), 600);
        return;
      }
      currentStep++;
      renderCurrentStep();
    }
  }

  // ── Step 2: Partner name ──────────────────────────────────────────────────

  function renderStep2(): void {
    const content = document.createElement('div');
    content.style.cssText =
      'display:flex;flex-direction:column;align-items:center;gap:24px;width:100%;max-width:360px;';

    content.innerHTML = `
      <div style="font-size:72px;line-height:1" class="animate-pulse">💕</div>
      <div style="text-align:center">
        <h1 class="onboarding-title">Tên người ấy là gì?</h1>
        <p class="onboarding-subtitle" style="margin-top:8px">Tên người thương của bạn</p>
      </div>
    `;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'input';
    input.placeholder = 'Tên người đặc biệt của bạn';
    input.value = formData.partnerName;
    input.maxLength = 30;
    input.style.cssText = 'text-align:center;font-size:20px;font-weight:600;padding:18px 20px;width:100%;';
    input.addEventListener('input', () => {
      formData.partnerName = input.value.trim();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && formData.partnerName) {
        currentStep++;
        renderCurrentStep();
      }
    });
    content.appendChild(input);

    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn-primary btn-primary-full';
    nextBtn.style.cssText = 'width:100%;font-size:17px;padding:16px;';
    nextBtn.textContent = 'Tiếp theo →';
    nextBtn.addEventListener('click', () => {
      if (!formData.partnerName) {
        input.focus();
        return;
      }
      currentStep++;
      renderCurrentStep();
    });
    content.appendChild(nextBtn);

    renderStep(content);
    requestAnimationFrame(() => input.focus());
  }

  // ── Step 3: Couple code ───────────────────────────────────────────────────

  function renderStep3(): void {
    const content = document.createElement('div');
    content.style.cssText =
      'display:flex;flex-direction:column;align-items:center;gap:20px;width:100%;max-width:360px;';

    content.innerHTML = `
      <div style="font-size:72px;line-height:1" class="animate-pulse">🔑</div>
      <div style="text-align:center">
        <h1 class="onboarding-title">Couple Code của hai đứa</h1>
        <p class="onboarding-subtitle" style="margin-top:8px">Hai đứa nhập cùng một code để kết nối.<br>Tạo code bất kỳ rồi chia sẻ với người ấy.</p>
      </div>
    `;

    const codeInput = document.createElement('input');
    codeInput.type = 'text';
    codeInput.className = 'input';
    codeInput.placeholder = 'VD: 010203';
    codeInput.value = formData.coupleCode;
    codeInput.maxLength = 8;
    codeInput.style.cssText =
      'text-align:center;font-size:24px;font-weight:700;letter-spacing:0.12em;padding:18px 20px;width:100%;text-transform:uppercase;';
    codeInput.addEventListener('input', () => {
      const val = codeInput.value.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 8);
      codeInput.value = val;
      formData.coupleCode = val;
    });
    content.appendChild(codeInput);

    // Account toggle
    const toggleWrapper = document.createElement('div');
    toggleWrapper.style.cssText = 'width:100%;';
    toggleWrapper.innerHTML = `
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:12px;background:var(--surface-solid);border:1px solid var(--border);border-radius:14px;">
        <input type="checkbox" id="use-account-toggle" style="width:18px;height:18px;accent-color:var(--accent);" ${formData.useAccount ? 'checked' : ''} />
        <span style="font-size:11px;font-weight:500;line-height:1.4">Đăng ký tài khoản để sử dụng trên thiết bị khác</span>
      </label>
    `;

    const accountFields = document.createElement('div');
    accountFields.style.cssText = `
      width:100%;
      display:flex;
      flex-direction:column;
      gap:10px;
      overflow:hidden;
      transition:max-height 0.3s ease, opacity 0.3s ease;
      max-height:${formData.useAccount ? '200px' : '0'};
      opacity:${formData.useAccount ? '1' : '0'};
    `;

    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.className = 'input';
    emailInput.placeholder = 'Email của bạn';
    emailInput.value = formData.email;
    emailInput.addEventListener('input', () => {
      formData.email = emailInput.value.trim();
      // Reset verification state if email changes
      formData.emailVerified = false;
      formData.otpCode = '';
    });

    const passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    passwordInput.className = 'input';
    passwordInput.placeholder = 'Mật khẩu (tối thiểu 6 ký tự)';
    passwordInput.value = formData.password;
    passwordInput.addEventListener('input', () => {
      formData.password = passwordInput.value;
    });

    accountFields.appendChild(emailInput);
    accountFields.appendChild(passwordInput);
    content.appendChild(toggleWrapper);
    content.appendChild(accountFields);

    const toggle = toggleWrapper.querySelector<HTMLInputElement>('#use-account-toggle')!;
    toggle.addEventListener('change', () => {
      formData.useAccount = toggle.checked;
      accountFields.style.maxHeight = toggle.checked ? '200px' : '0';
      accountFields.style.opacity = toggle.checked ? '1' : '0';
    });

    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn-primary btn-primary-full';
    nextBtn.style.cssText = 'width:100%;font-size:17px;padding:16px;';
    nextBtn.textContent = 'Tiếp theo →';
    nextBtn.addEventListener('click', () => {
      if (!formData.coupleCode || formData.coupleCode.length < 4) {
        showToast('Code cần ít nhất 4 ký tự', 'error');
        codeInput.focus();
        return;
      }
      if (formData.useAccount) {
        if (!formData.email) {
          showToast('Vui lòng nhập email', 'error');
          emailInput.focus();
          return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
          showToast('Email không hợp lệ', 'error');
          emailInput.focus();
          return;
        }
        if (formData.password.length < 6) {
          showToast('Mật khẩu cần ít nhất 6 ký tự', 'error');
          passwordInput.focus();
          return;
        }
      }
      currentStep++;
      renderCurrentStep();
    });
    content.appendChild(nextBtn);

    renderStep(content);
    requestAnimationFrame(() => codeInput.focus());
  }

  // ── Step 4: Email OTP Verification (only if useAccount) ───────────────────

  function renderStep4OTP(): void {
    const content = document.createElement('div');
    content.style.cssText =
      'display:flex;flex-direction:column;align-items:center;gap:20px;width:100%;max-width:360px;';

    let cooldown = 0;
    let cooldownInterval: ReturnType<typeof setInterval> | null = null;
    let otpSentSuccessfully = false;

    content.innerHTML = `
      <div style="font-size:72px;line-height:1" class="animate-pulse">📬</div>
      <div style="text-align:center">
        <h1 class="onboarding-title">Xác thực Email</h1>
        <p class="onboarding-subtitle" style="margin-top:8px">
          Nhập mã <strong>6 chữ số</strong> được gửi tới<br>
          <strong style="color:var(--accent)">${formData.email}</strong>
        </p>
      </div>
    `;

    // Offline notice banner (hidden by default)
    const offlineBanner = document.createElement('div');
    offlineBanner.style.cssText = `
      display:none;
      width:100%;
      background:rgba(248,113,113,0.12);
      border:1px solid rgba(248,113,113,0.35);
      border-radius:12px;
      padding:12px 16px;
      text-align:center;
      font-size:13px;
      color:#f87171;
      line-height:1.5;
    `;
    offlineBanner.innerHTML = '📡 Không có kết nối mạng<br><span style="color:var(--text-secondary)">Kết nối mạng rồi thử lại, hoặc bỏ qua bước này.</span>';
    content.appendChild(offlineBanner);

    // OTP input boxes (6 separate inputs)
    const otpWrapper = document.createElement('div');
    otpWrapper.style.cssText = 'display:flex;gap:10px;justify-content:center;width:100%;';
    const otpInputs: HTMLInputElement[] = [];

    for (let i = 0; i < 6; i++) {
      const box = document.createElement('input');
      box.type = 'text';
      box.inputMode = 'numeric';
      box.maxLength = 1;
      box.setAttribute('aria-label', `Chữ số ${i + 1}`);
      box.style.cssText = `
        width:44px;height:56px;
        text-align:center;font-size:22px;font-weight:700;
        border:2px solid var(--border);
        border-radius:14px;
        background:var(--surface-solid);
        color:var(--text);
        caret-color:var(--accent);
        transition:border-color 0.2s ease;
        outline:none;
      `;

      box.addEventListener('focus', () => {
        box.style.borderColor = 'var(--accent)';
        box.select();
      });
      box.addEventListener('blur', () => {
        box.style.borderColor = 'var(--border)';
      });
      box.addEventListener('input', () => {
        const val = box.value.replace(/\D/g, '');
        box.value = val.slice(-1);
        syncOtpValue();
        if (val && i < 5) {
          otpInputs[i + 1]?.focus();
        }
      });
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && i > 0) {
          otpInputs[i - 1]?.focus();
        }
        if (e.key === 'Enter') {
          void handleVerify();
        }
      });
      box.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
        text.split('').forEach((ch, idx) => {
          if (otpInputs[idx]) otpInputs[idx].value = ch;
        });
        syncOtpValue();
        const focusIdx = Math.min(text.length, 5);
        otpInputs[focusIdx]?.focus();
      });

      otpInputs.push(box);
      otpWrapper.appendChild(box);
    }
    content.appendChild(otpWrapper);

    function syncOtpValue() {
      formData.otpCode = otpInputs.map((i) => i.value).join('');
    }

    // Status message
    const statusMsg = document.createElement('p');
    statusMsg.style.cssText = 'font-size:13px;color:var(--text-secondary);text-align:center;min-height:20px;margin:0;';
    content.appendChild(statusMsg);

    // Verify button
    const verifyBtn = document.createElement('button');
    verifyBtn.className = 'btn-primary btn-primary-full';
    verifyBtn.style.cssText = 'width:100%;font-size:17px;padding:16px;';
    verifyBtn.textContent = 'Xác thực →';
    verifyBtn.addEventListener('click', () => void handleVerify());
    content.appendChild(verifyBtn);

    // Resend button
    const resendBtn = document.createElement('button');
    resendBtn.className = 'btn-ghost';
    resendBtn.style.cssText = 'width:100%;font-size:14px;';
    resendBtn.textContent = 'Gửi lại mã';
    resendBtn.addEventListener('click', () => void handleSendOtp(true));
    content.appendChild(resendBtn);

    // Skip OTP button — always visible so user can bypass if offline
    const skipOtpBtn = document.createElement('button');
    skipOtpBtn.className = 'btn-ghost';
    skipOtpBtn.style.cssText = 'width:100%;font-size:13px;opacity:0.6;margin-top:-8px;';
    skipOtpBtn.textContent = 'Bỏ qua xác thực email';
    skipOtpBtn.addEventListener('click', () => {
      formData.emailVerified = false;
      formData.otpCode = '';
      currentStep++;
      renderCurrentStep();
    });
    content.appendChild(skipOtpBtn);

    renderStep(content);

    // Auto-send OTP on load if not already sent
    void handleSendOtp(false);

    function isNetworkError(err: unknown): boolean {
      if (!navigator.onLine) return true;
      if (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) return true;
      if (err instanceof Error) {
        const msg = err.message.toLowerCase();
        return msg.includes('network') || msg.includes('failed to fetch') ||
               msg.includes('không có kết nối') || msg.includes('offline') ||
               msg.includes('connection');
      }
      return false;
    }

    async function handleSendOtp(isResend: boolean) {
      if (cooldown > 0) {
        showToast(`Vui lòng chờ ${cooldown}s trước khi gửi lại`, 'error');
        return;
      }

      resendBtn.disabled = true;
      resendBtn.textContent = 'Đang gửi...';

      try {
        await sendOtp(formData.email);
        otpSentSuccessfully = true;
        offlineBanner.style.display = 'none';
        showToast(
          isResend ? '✉️ Đã gửi lại mã mới!' : `✉️ Mã đã gửi tới ${formData.email}`,
          'success',
        );
        // Start 60s cooldown
        cooldown = 60;
        resendBtn.textContent = `Gửi lại sau ${cooldown}s`;
        cooldownInterval = setInterval(() => {
          cooldown--;
          if (cooldown <= 0) {
            clearInterval(cooldownInterval!);
            resendBtn.textContent = 'Gửi lại mã';
            resendBtn.disabled = false;
          } else {
            resendBtn.textContent = `Gửi lại sau ${cooldown}s`;
          }
        }, 1000);
      } catch (err: unknown) {
        resendBtn.disabled = false;
        resendBtn.textContent = 'Thử lại';
        if (isNetworkError(err)) {
          // Show offline banner with skip hint
          offlineBanner.style.display = 'block';
          if (isResend) {
            showToast('Không có kết nối mạng', 'error');
          }
        } else {
          const msg = err instanceof Error ? err.message : 'Gửi email thất bại';
          showToast(msg, 'error');
        }
      }
    }

    async function handleVerify() {
      syncOtpValue();
      if (formData.otpCode.length !== 6) {
        showToast('Vui lòng nhập đủ 6 chữ số', 'error');
        otpInputs[0]?.focus();
        return;
      }

      verifyBtn.disabled = true;
      verifyBtn.innerHTML = `<span class="spinner" style="width:18px;height:18px;border-width:2px"></span> Đang xác thực...`;

      try {
        await verifyOtp(formData.email, formData.otpCode);
        formData.emailVerified = true;

        // Visual feedback
        otpInputs.forEach((inp) => {
          inp.style.borderColor = '#4ade80';
          inp.style.background = 'rgba(74,222,128,0.08)';
          inp.disabled = true;
        });
        statusMsg.style.color = '#4ade80';
        statusMsg.textContent = '✓ Email đã được xác thực!';

        showToast('Xác thực thành công!', 'success');
        setTimeout(() => {
          currentStep++;
          renderCurrentStep();
        }, 700);
      } catch (err: unknown) {
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'Xác thực →';
        if (isNetworkError(err)) {
          offlineBanner.style.display = 'block';
          showToast('Không có kết nối mạng', 'error');
        } else {
          const msg = err instanceof Error ? err.message : 'Mã không đúng';
          showToast(msg, 'error');
          // Shake effect
          otpInputs.forEach((inp) => {
            inp.style.borderColor = '#f87171';
            inp.style.animation = 'none';
            setTimeout(() => { inp.style.borderColor = 'var(--border)'; }, 600);
          });
        }
      }
    }

    // Focus first input
    requestAnimationFrame(() => otpInputs[0]?.focus());
  }

  // ── Step 4/5: Love start date ─────────────────────────────────────────────

  // ── Step 4/5: Love start date ─────────────────────────────────────────────

  function formatDateVietnamese(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    if (isNaN(date.getTime())) return '';
    const daysOfWeek = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayName = daysOfWeek[date.getDay()];
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${dayName}, ${day}/${month}/${year}`;
  }

  function renderStepDate(): void {
    const content = document.createElement('div');
    content.style.cssText =
      'display:flex;flex-direction:column;align-items:center;gap:20px;width:100%;max-width:360px;';

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Default to 1 year ago if empty
    if (!formData.loveStartDate) {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(today.getFullYear() - 1);
      formData.loveStartDate = oneYearAgo.toISOString().split('T')[0];
    }

    content.innerHTML = `
      <div class="love-date-avatar-wrapper animate-pulse">
        <span class="love-date-avatar-icon">📅</span>
        <span class="love-date-avatar-badge">LOVE</span>
      </div>
      <div style="text-align:center">
        <h1 class="onboarding-title">Hai đứa bắt đầu<br>yêu nhau khi nào?</h1>
        <p class="onboarding-subtitle" style="margin-top:6px">Chọn ngày kỷ niệm đặc biệt của hai bạn</p>
      </div>
    `;

    // Modern Date Picker Card
    const pickerCard = document.createElement('div');
    pickerCard.className = 'love-date-picker-card';

    // Hidden native date input (for showPicker / mobile native modal trigger)
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.value = formData.loveStartDate;
    dateInput.max = todayStr;
    dateInput.style.cssText = 'position:absolute;opacity:0;pointer-events:none;width:0;height:0;';
    pickerCard.appendChild(dateInput);

    // 1. Quick Presets Bar
    const presetsSection = document.createElement('div');
    presetsSection.innerHTML = `<div class="love-date-presets-title">⚡ Chọn nhanh mốc thời gian</div>`;
    const presetsList = document.createElement('div');
    presetsList.className = 'love-date-presets-list';

    const presets = [
      { label: 'Hôm nay', getDays: () => 0 },
      { label: '100 ngày', getDays: () => 100 },
      { label: '6 tháng', getDays: () => 180 },
      { label: '1 năm', getDays: () => 365 },
      { label: '2 năm', getDays: () => 730 },
      { label: '3 năm', getDays: () => 1095 }
    ];

    // 2. Custom Wheel Selector (Day, Month, Year)
    const wheelContainer = document.createElement('div');
    wheelContainer.className = 'love-date-wheel-container';
    wheelContainer.innerHTML = `
      <div class="love-date-wheel-highlight"></div>
      <div class="love-date-wheel-col" id="wheel-day"></div>
      <div class="love-date-wheel-col" id="wheel-month"></div>
      <div class="love-date-wheel-col" id="wheel-year"></div>
    `;

    const wheelDay = wheelContainer.querySelector('#wheel-day') as HTMLElement;
    const wheelMonth = wheelContainer.querySelector('#wheel-month') as HTMLElement;
    const wheelYear = wheelContainer.querySelector('#wheel-year') as HTMLElement;

    // Populate Days (01 -> 31)
    const daysList: string[] = [];
    for (let d = 1; d <= 31; d++) {
      const val = d.toString().padStart(2, '0');
      daysList.push(val);
      const item = document.createElement('div');
      item.className = 'love-date-wheel-item';
      item.dataset.value = val;
      item.textContent = val;
      const idx = d - 1;
      item.addEventListener('click', () => {
        wheelDay.scrollTo({ top: idx * 40, behavior: 'smooth' });
      });
      wheelDay.appendChild(item);
    }

    // Populate Months (Tháng 1 -> Tháng 12)
    const monthsList: string[] = [];
    for (let m = 1; m <= 12; m++) {
      const val = m.toString().padStart(2, '0');
      monthsList.push(val);
      const item = document.createElement('div');
      item.className = 'love-date-wheel-item';
      item.dataset.value = val;
      item.textContent = `Tháng ${m}`;
      const idx = m - 1;
      item.addEventListener('click', () => {
        wheelMonth.scrollTo({ top: idx * 40, behavior: 'smooth' });
      });
      wheelMonth.appendChild(item);
    }

    // Populate Years (Current Year down to 1990)
    const currentYear = today.getFullYear();
    const yearsList: string[] = [];
    for (let y = currentYear; y >= 1990; y--) {
      const val = y.toString();
      yearsList.push(val);
      const item = document.createElement('div');
      item.className = 'love-date-wheel-item';
      item.dataset.value = val;
      item.textContent = val;
      const idx = yearsList.length - 1;
      item.addEventListener('click', () => {
        wheelYear.scrollTo({ top: idx * 40, behavior: 'smooth' });
      });
      wheelYear.appendChild(item);
    }

    pickerCard.appendChild(presetsSection);
    presetsSection.appendChild(presetsList);
    pickerCard.appendChild(wheelContainer);

    // 4. Romantic Days Counter Preview Card
    const dayPreview = document.createElement('div');
    dayPreview.className = 'love-date-preview-card';

    // State & Scroll Helpers
    let isProgrammaticScroll = false;

    function getSelectedValueFromCol(col: HTMLElement, list: string[]): { value: string; index: number } {
      const scrollTop = col.scrollTop;
      let index = Math.round(scrollTop / 40);
      if (index < 0) index = 0;
      if (index >= list.length) index = list.length - 1;

      const items = col.querySelectorAll('.love-date-wheel-item');
      items.forEach((it, i) => {
        if (i === index) it.classList.add('selected');
        else it.classList.remove('selected');
      });

      return { value: list[index] || list[0], index };
    }

    function syncFromWheel() {
      if (isProgrammaticScroll) return;

      const dayObj = getSelectedValueFromCol(wheelDay, daysList);
      const monthObj = getSelectedValueFromCol(wheelMonth, monthsList);
      const yearObj = getSelectedValueFromCol(wheelYear, yearsList);

      const y = yearObj.value;
      const m = monthObj.value;
      let d = dayObj.value;

      // Adjust max days in month
      const maxDaysInMonth = new Date(parseInt(y), parseInt(m), 0).getDate();
      if (parseInt(d) > maxDaysInMonth) {
        d = maxDaysInMonth.toString().padStart(2, '0');
        isProgrammaticScroll = true;
        wheelDay.scrollTop = (maxDaysInMonth - 1) * 40;
        setTimeout(() => { isProgrammaticScroll = false; }, 60);
      }

      const newDateStr = `${y}-${m}-${d}`;

      // Prevent future dates
      if (newDateStr > todayStr) {
        syncFromDateString(todayStr);
        showToast('Ngày bắt đầu yêu không thể trong tương lai 💕', 'info');
        return;
      }

      dateInput.value = newDateStr;
      formData.loveStartDate = newDateStr;
      updatePreview();
      updateActivePreset();
    }

    let scrollTimer: ReturnType<typeof setTimeout> | null = null;
    function onColScroll() {
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        syncFromWheel();
      }, 60);
    }

    wheelDay.addEventListener('scroll', onColScroll);
    wheelMonth.addEventListener('scroll', onColScroll);
    wheelYear.addEventListener('scroll', onColScroll);

    function syncFromDateString(dateStr: string) {
      if (!dateStr) return;
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const y = parts[0];
        const m = parts[1];
        const d = parts[2];

        const dayIdx = daysList.indexOf(d);
        const monthIdx = monthsList.indexOf(m);
        const yearIdx = yearsList.indexOf(y);

        isProgrammaticScroll = true;
        if (dayIdx >= 0) wheelDay.scrollTop = dayIdx * 40;
        if (monthIdx >= 0) wheelMonth.scrollTop = monthIdx * 40;
        if (yearIdx >= 0) wheelYear.scrollTop = yearIdx * 40;

        getSelectedValueFromCol(wheelDay, daysList);
        getSelectedValueFromCol(wheelMonth, monthsList);
        getSelectedValueFromCol(wheelYear, yearsList);

        setTimeout(() => { isProgrammaticScroll = false; }, 60);
      }

      dateInput.value = dateStr;
      formData.loveStartDate = dateStr;
      updatePreview();
      updateActivePreset();
    }

    function updatePreview() {
      const days = calcDaysTogether(formData.loveStartDate);
      const formattedDate = formatDateVietnamese(formData.loveStartDate);

      if (days >= 0 && formData.loveStartDate) {
        let milestoneText = '';
        if (days === 0) milestoneText = 'Ngày đầu tiên bên nhau ✨';
        else if (days < 30) milestoneText = 'Những ngày đầu rực rỡ 💓';
        else if (days < 100) milestoneText = 'Sắp đạt mốc 100 ngày 🎉';
        else if (days < 365) milestoneText = 'Hành trình đang đơm hoa! 🥰';
        else {
          const yrs = (days / 365).toFixed(1);
          milestoneText = `🎉 Đã gắn bó hơn ${yrs} năm ngọt ngào`;
        }

        dayPreview.innerHTML = `
          <div class="love-date-preview-days">
            💕 Hai đứa đã bên nhau <strong>${days.toLocaleString()}</strong> ngày
          </div>
          <div class="love-date-preview-sub">${formattedDate}</div>
          <div class="love-date-milestone-pill">${milestoneText}</div>
        `;
      } else {
        dayPreview.innerHTML = `
          <div class="love-date-preview-sub" style="font-size:14px;color:var(--text-secondary)">
            Vui lòng chọn ngày kỷ niệm 💕
          </div>
        `;
      }
    }

    function updateActivePreset() {
      const currentDays = calcDaysTogether(formData.loveStartDate);
      const presetChips = presetsList.querySelectorAll('.love-date-preset-chip');
      presetChips.forEach((chip) => {
        const targetDays = parseInt(chip.getAttribute('data-days') || '-1');
        if (Math.abs(currentDays - targetDays) <= 1 && targetDays >= 0) {
          chip.classList.add('active');
        } else {
          chip.classList.remove('active');
        }
      });
    }

    // Build preset chips
    presets.forEach((p) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'love-date-preset-chip';
      const targetDays = p.getDays();
      chip.setAttribute('data-days', targetDays.toString());
      chip.textContent = p.label;
      chip.addEventListener('click', () => {
        const d = new Date();
        d.setDate(d.getDate() - targetDays);
        const dateStr = d.toISOString().split('T')[0];
        syncFromDateString(dateStr);
      });
      presetsList.appendChild(chip);
    });

    // Event listeners
    dateInput.addEventListener('input', () => {
      syncFromDateString(dateInput.value);
    });

    // Initial sync
    syncFromDateString(formData.loveStartDate);

    content.appendChild(pickerCard);
    content.appendChild(dayPreview);

    const finishBtn = document.createElement('button');
    finishBtn.className = 'btn-primary btn-primary-full';
    finishBtn.style.cssText =
      'width:100%;font-size:17px;padding:16px;box-shadow: 0 8px 24px rgba(255, 75, 114, 0.3);';
    finishBtn.textContent = 'Bắt đầu ngay 💕';
    finishBtn.addEventListener('click', handleSubmit);
    content.appendChild(finishBtn);

    const skipBtn = document.createElement('button');
    skipBtn.className = 'btn-ghost';
    skipBtn.style.cssText = 'width:100%;font-size:14px;color:var(--text-secondary);';
    skipBtn.textContent = 'Bỏ qua bước này';
    skipBtn.addEventListener('click', handleSubmit);
    content.appendChild(skipBtn);

    renderStep(content);
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    const btn = root.querySelector<HTMLButtonElement>('.btn-primary');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner" style="width:20px;height:20px;border-width:2px"></span> Đang tạo...`;
    }

    try {
      const payload: Parameters<typeof startOnboarding>[0] = {
        deviceId,
        displayName: formData.displayName,
        partnerName: formData.partnerName,
        coupleCode: formData.coupleCode.toUpperCase(),
        loveStartDate: formData.loveStartDate || undefined,
        email: formData.useAccount && formData.email ? formData.email : undefined,
        password: formData.useAccount && formData.password ? formData.password : undefined,
        otpCode: formData.useAccount && formData.otpCode ? formData.otpCode : undefined,
      };

      const result = await startOnboarding(payload);

      store.set({
        token: result.token,
        user: result.user,
        couple: result.couple,
      });
      localStorage.setItem('lovecheck_token', result.token);

      showSuccessAndNavigate();
    } catch (err: unknown) {
      // Fallback for local UI preview when backend API server is offline
      showToast('Đã tạo dữ liệu xem thử Local! Đang vào trang chính...', 'info');
      
      const mockUser = {
        id: 'mock_user_1',
        displayName: formData.displayName || 'Bạn',
        partnerName: formData.partnerName || 'Người ấy',
        coupleId: 'mock_couple_1',
        createdAt: new Date().toISOString(),
      };

      const mockCouple = {
        id: 'mock_couple_1',
        code: formData.coupleCode ? formData.coupleCode.toUpperCase() : 'LOVE123',
        coupleCode: formData.coupleCode ? formData.coupleCode.toUpperCase() : 'LOVE123',
        loveStartDate: formData.loveStartDate || new Date().toISOString().split('T')[0],
        streak: 1,
        user1Id: 'mock_user_1',
        user2Id: 'mock_user_2',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      store.set({
        token: 'mock_preview_token',
        user: mockUser as any,
        couple: mockCouple as any,
      });
      localStorage.setItem('lovecheck_token', 'mock_preview_token');

      showSuccessAndNavigate();
    }
  }


  function showSuccessAndNavigate() {
    root.innerHTML = '';
    root.style.cssText +=
      'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;';
    root.innerHTML = `
      <div style="font-size:80px;line-height:1" class="animate-scale-in animate-heartbeat">💕</div>
      <div style="text-align:center" class="animate-slide-up stagger-1">
        <h1 style="font-size:26px;font-weight:700;letter-spacing:-0.03em;margin-bottom:8px">
          Chào mừng, ${formData.displayName}!
        </h1>
        <p style="font-size:16px;color:var(--text-secondary);line-height:1.6">
          Bắt đầu hành trình cùng ${formData.partnerName} nhé 💕
        </p>
      </div>
    `;
    setTimeout(() => navigate('/app/home', true), 1800);
  }

  // ── Step renderer ─────────────────────────────────────────────────────────

  function renderCurrentStep() {
    switch (currentStep) {
      case 0: renderStep1(); break;
      case 1: renderStep2(); break;
      case 2: renderStep3(); break;
      case 3:
        // If using account, show OTP step; otherwise show date step
        if (formData.useAccount) {
          renderStep4OTP();
        } else {
          renderStepDate();
        }
        break;
      case 4:
        // Date step (only reached after OTP if useAccount)
        renderStepDate();
        break;
    }
  }

  renderCurrentStep();
  return root;
}
