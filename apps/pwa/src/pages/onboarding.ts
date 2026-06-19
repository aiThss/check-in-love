import { navigate } from '../router';
import { store } from '../store/index';
import { startOnboarding } from '../api/auth';
import { showToast } from '../components/toast';

// ── UUID v4 ───────────────────────────────────────────────────────────────────

function generateDeviceId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback
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
  const TOTAL_STEPS = 4;

  const formData = {
    displayName: '',
    partnerName: '',
    coupleCode: '',
    loveStartDate: '',
    email: '',
    password: '',
    useAccount: false,
  };

  // Root container
  const root = document.createElement('div');
  root.className = 'page-no-nav';
  root.style.cssText = 'min-height:100dvh;background:var(--bg);position:relative;overflow:hidden;';

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderProgressDots(): HTMLElement {
    const dots = document.createElement('div');
    dots.className = 'progress-dots';
    for (let i = 0; i < TOTAL_STEPS; i++) {
      const dot = document.createElement('div');
      dot.className = `progress-dot${i === currentStep ? ' active' : ''}`;
      dots.appendChild(dot);
    }
    return dots;
  }

  function renderStep(content: HTMLElement): void {
    root.innerHTML = '';

    const step = document.createElement('div');
    step.className = 'onboarding-step animate-slide-up';

    // Top: dots + back button
    const topRow = document.createElement('div');
    topRow.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;width:100%;max-width:380px;margin-bottom:16px;';

    if (currentStep > 0) {
      const backBtn = document.createElement('button');
      backBtn.className = 'btn-icon';
      backBtn.setAttribute('aria-label', 'Quay lại');
      backBtn.innerHTML = '←';
      backBtn.addEventListener('click', () => {
        currentStep--;
        renderCurrentStep();
      });
      topRow.appendChild(backBtn);
    } else {
      topRow.appendChild(document.createElement('div'));
    }

    topRow.appendChild(renderProgressDots());
    topRow.appendChild(document.createElement('div')); // spacer

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
        <h1 class="onboarding-title">Tên người ấy<br>là gì?</h1>
        <p class="onboarding-subtitle" style="margin-top:8px">Tên người đặc biệt của bạn</p>
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
        <h1 class="onboarding-title">Couple Code<br>của hai đứa</h1>
        <p class="onboarding-subtitle" style="margin-top:8px">Hai đứa nhập cùng một code để kết nối.<br>Tạo code bất kỳ rồi chia sẻ với người ấy.</p>
      </div>
    `;

    const codeInput = document.createElement('input');
    codeInput.type = 'text';
    codeInput.className = 'input';
    codeInput.placeholder = 'VD: MYCOUPLE';
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
        <span style="font-size:14px;font-weight:500;line-height:1.4">Đăng ký tài khoản để đăng nhập trên thiết bị khác</span>
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

  // ── Step 4: Love start date ───────────────────────────────────────────────

  function renderStep4(): void {
    const content = document.createElement('div');
    content.style.cssText =
      'display:flex;flex-direction:column;align-items:center;gap:24px;width:100%;max-width:360px;';

    content.innerHTML = `
      <div style="font-size:72px;line-height:1" class="animate-pulse">📅</div>
      <div style="text-align:center">
        <h1 class="onboarding-title">Hai đứa bắt đầu<br>yêu nhau khi nào?</h1>
        <p class="onboarding-subtitle" style="margin-top:8px">Ngày đặc biệt ấy...</p>
      </div>
    `;

    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = 'input';
    dateInput.value = formData.loveStartDate;
    dateInput.max = new Date().toISOString().split('T')[0];
    dateInput.style.cssText = 'width:100%;font-size:18px;text-align:center;padding:16px;';

    const dayPreview = document.createElement('div');
    dayPreview.style.cssText =
      'text-align:center;padding:14px 20px;background:var(--accent-soft);border-radius:16px;width:100%;min-height:52px;display:flex;align-items:center;justify-content:center;';
    dayPreview.innerHTML = `<span style="color:var(--text-secondary);font-size:15px">Chọn ngày để xem số ngày 💕</span>`;

    function updatePreview() {
      const days = calcDaysTogether(dateInput.value);
      if (days >= 0 && dateInput.value) {
        dayPreview.innerHTML = `
          <span style="font-size:16px;font-weight:600;color:var(--accent)">
            💕 Hai đứa đã bên nhau <strong>${days}</strong> ngày rồi đó!
          </span>
        `;
      } else {
        dayPreview.innerHTML = `<span style="color:var(--text-secondary);font-size:15px">Chọn ngày để xem số ngày 💕</span>`;
      }
    }

    dateInput.addEventListener('input', () => {
      formData.loveStartDate = dateInput.value;
      updatePreview();
    });

    content.appendChild(dateInput);
    content.appendChild(dayPreview);

    const finishBtn = document.createElement('button');
    finishBtn.className = 'btn-primary btn-primary-full';
    finishBtn.style.cssText = 'width:100%;font-size:17px;padding:16px;';
    finishBtn.textContent = 'Bắt đầu 💕';
    finishBtn.addEventListener('click', handleSubmit);
    content.appendChild(finishBtn);

    const skipBtn = document.createElement('button');
    skipBtn.className = 'btn-ghost';
    skipBtn.style.cssText = 'width:100%;font-size:14px;';
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
      };

      const result = await startOnboarding(payload);

      store.set({
        token: result.token,
        user: result.user,
        couple: result.couple,
      });
      localStorage.setItem('lovecheck_token', result.token);

      // Success!
      showSuccessAndNavigate();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Có lỗi xảy ra, vui lòng thử lại';
      showToast(message, 'error');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Bắt đầu 💕';
      }
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
      case 3: renderStep4(); break;
    }
  }

  renderCurrentStep();
  return root;
}
