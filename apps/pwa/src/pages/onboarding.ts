import '../styles/20-pages/auth.css';
import { navigate } from '../router';
import { createThemeToggleButton } from '../components/theme-toggle';
import { store } from '../store/index';
import { startOnboarding, sendOtp, verifyOtp } from '../api/auth';
import { showToast } from '../components/toast';
import { MOCK_PREVIEW_TOKEN, seedMockPreviewData } from '../dev/mock-data';
import { iconMarkup, type IconName } from '../ui/icons/icons';
import { createBadge, createButton, createChip, createIconButton } from '../ui/primitives';
import { createSwitch } from '../ui/forms';
import { triggerHaptic } from '../ui/haptics';

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

function calcDaysTogether(dateStr: string): number {
  if (!dateStr) return 0;
  const start = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - start.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export type OnboardingMode = 'email' | 'google';

export function renderOnboardingPage(options: { mode?: OnboardingMode } = {}): HTMLElement {
  const deviceId = getOrCreateDeviceId();

  const savedStep = sessionStorage.getItem('dev_onboarding_step');
  let currentStep = savedStep !== null ? Math.max(0, Math.min(4, parseInt(savedStep, 10))) : 0;
  const TOTAL_STEPS = 5;

  const isGoogleUser = options.mode === 'google'
    || sessionStorage.getItem('google_authenticated_user') === 'true'
    || Boolean(store.get().user?.googleId);

  const formData = {
    displayName: sessionStorage.getItem('dev_onboarding_displayName') || store.get().user?.displayName || '',
    partnerName: sessionStorage.getItem('dev_onboarding_partnerName') || '',
    coupleCode: sessionStorage.getItem('dev_onboarding_coupleCode') || '',
    loveStartDate: sessionStorage.getItem('dev_onboarding_loveStartDate') || '',
    email: sessionStorage.getItem('dev_onboarding_email') || store.get().user?.email || '',
    password: '',
    otpCode: '',
    useAccount: isGoogleUser ? false : sessionStorage.getItem('dev_onboarding_useAccount') === 'true',
    emailVerified: isGoogleUser,
  };

  const root = document.createElement('div');
  root.className = 'page-no-nav p-auth animate-fade-in';

  function renderStepShell(
    emblemIcon: IconName,
    title: string,
    subtitle: string,
    cardBody: HTMLElement,
    footerNode?: HTMLElement,
  ): void {
    root.replaceChildren();

    const visibleSteps = formData.useAccount && !isGoogleUser ? TOTAL_STEPS : TOTAL_STEPS - 1;
    const stepDisplay = Math.min(visibleSteps, currentStep + 1);
    const ratio = Math.max(0.2, Math.min(1, stepDisplay / visibleSteps));

    const topBar = document.createElement('header');
    topBar.className = 'p-auth-topbar';

    const leftSlot = document.createElement('div');
    if (currentStep > 0) {
      leftSlot.appendChild(
        createIconButton({
          icon: 'back',
          ariaLabel: 'Quay lại bước trước',
          onClick: () => {
            currentStep--;
            triggerHaptic('tap');
            renderCurrentStep();
          },
        }),
      );
    }

    const progress = document.createElement('div');
    progress.className = 'p-auth-progress';
    progress.innerHTML = `
      <div class="p-auth-progress__track"><div class="p-auth-progress__bar" style="transform:scaleX(${ratio})"></div></div>
      <span class="p-auth-progress__label">Bước ${stepDisplay} / ${visibleSteps}</span>
    `;

    const rightSlot = document.createElement('div');
    rightSlot.style.justifySelf = 'end';
    rightSlot.appendChild(createThemeToggleButton());

    topBar.append(leftSlot, progress, rightSlot);
    root.appendChild(topBar);

    const centerWrap = document.createElement('main');
    centerWrap.style.cssText = 'display:flex;flex-direction:column;gap:18px;margin:auto 0;';

    const hero = document.createElement('div');
    hero.className = 'p-auth-hero';
    hero.innerHTML = `
      <div class="p-auth-emblem">${iconMarkup(emblemIcon, { size: 32, variant: 'filled' })}</div>
      <h1 class="p-auth-title">${title}</h1>
      <p class="p-auth-sub">${subtitle}</p>
    `;

    const card = document.createElement('div');
    card.className = 'p-auth-card u-grain-surface';
    card.appendChild(cardBody);

    centerWrap.append(hero, card);
    root.appendChild(centerWrap);

    if (footerNode) {
      root.appendChild(footerNode);
    } else {
      const spacer = document.createElement('div');
      root.appendChild(spacer);
    }
  }

  // ── Step 1: Display Name ──
  function renderStep1(): void {
    const body = document.createElement('div');
    body.style.cssText = 'display:flex;flex-direction:column;gap:14px;';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'c-input';
    input.placeholder = 'Ví dụ: Minh, Linh, Bảo...';
    input.setAttribute('aria-label', 'Tên hiển thị của bạn');
    input.value = formData.displayName;
    input.maxLength = 30;
    input.style.cssText = 'text-align:center;font-size:18px;font-weight:600;min-height:52px;';
    input.addEventListener('input', () => {
      formData.displayName = input.value.trim();
    });

    const goNext = () => {
      if (!formData.displayName) {
        showToast('Hãy nhập tên của bạn trước nhé', 'error');
        input.focus();
        return;
      }
      triggerHaptic('tap');
      currentStep++;
      renderCurrentStep();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') goNext();
    });

    const nextBtn = createButton({
      label: 'Tiếp tục',
      variant: 'primary',
      pill: true,
      block: true,
      trailingIcon: 'chevron-right',
      onClick: goNext,
    });

    body.append(input, nextBtn.element);

    let footer: HTMLElement | undefined;
    if (!isGoogleUser) {
      footer = document.createElement('footer');
      footer.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
      footer.appendChild(
        createButton({
          label: 'Đã có tài khoản? Đăng nhập',
          variant: 'ghost',
          pill: true,
          block: true,
          leadingIcon: 'user',
          onClick: () => navigate('/login', true),
        }).element,
      );
    }

    renderStepShell(
      'user',
      'Tên của bạn là gì?',
      'Chúng mình sẽ dùng tên này trên mọi tấm ảnh Polaroid và tin nhắn.',
      body,
      footer,
    );
    requestAnimationFrame(() => input.focus());
  }

  // ── Step 2: Partner Name ──
  function renderStep2(): void {
    const body = document.createElement('div');
    body.style.cssText = 'display:flex;flex-direction:column;gap:14px;';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'c-input';
    input.placeholder = 'Tên thương gọi của người ấy';
    input.setAttribute('aria-label', 'Tên người ấy');
    input.value = formData.partnerName;
    input.maxLength = 30;
    input.style.cssText = 'text-align:center;font-size:18px;font-weight:600;min-height:52px;';
    input.addEventListener('input', () => {
      formData.partnerName = input.value.trim();
    });

    const goNext = () => {
      if (!formData.partnerName) {
        showToast('Hãy nhập tên người thương nhé', 'error');
        input.focus();
        return;
      }
      triggerHaptic('tap');
      currentStep++;
      renderCurrentStep();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') goNext();
    });

    body.append(
      input,
      createButton({
        label: 'Tiếp tục',
        variant: 'primary',
        pill: true,
        block: true,
        trailingIcon: 'chevron-right',
        onClick: goNext,
      }).element,
    );

    renderStepShell(
      'couple',
      'Người thương của bạn tên gì?',
      'Gọi theo tên thân mật nhất mà hai đứa vẫn hay dành cho nhau.',
      body,
    );
    requestAnimationFrame(() => input.focus());
  }

  // ── Step 3: Couple Code (OTP-style Individual Boxes) + Optional Account ──
  function renderStep3(): void {
    const body = document.createElement('div');
    body.style.cssText = 'display:flex;flex-direction:column;gap:14px;';

    let boxCount = formData.coupleCode.length > 6 ? 8 : 6;
    const boxesContainer = document.createElement('div');
    boxesContainer.className = 'p-otp-grid';
    let codeBoxes: HTMLInputElement[] = [];

    const syncCodeFromBoxes = () => {
      formData.coupleCode = codeBoxes.map((b) => b.value).join('').toUpperCase();
    };

    const buildCodeBoxes = () => {
      boxesContainer.replaceChildren();
      codeBoxes = [];
      for (let i = 0; i < boxCount; i++) {
        const cell = document.createElement('input');
        cell.type = 'text';
        cell.maxLength = 1;
        cell.className = 'p-otp-cell';
        cell.setAttribute('aria-label', `Ký tự mã ghép đôi ${i + 1}`);
        cell.value = formData.coupleCode[i] ?? '';

        cell.addEventListener('input', () => {
          const clean = cell.value.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(-1);
          cell.value = clean;
          syncCodeFromBoxes();
          if (clean && i < codeBoxes.length - 1) {
            codeBoxes[i + 1]?.focus();
          }
        });

        cell.addEventListener('keydown', (e) => {
          if (e.key === 'Backspace' && !cell.value && i > 0) {
            codeBoxes[i - 1]?.focus();
          }
        });

        cell.addEventListener('paste', (e) => {
          e.preventDefault();
          const raw = (e.clipboardData?.getData('text') || '')
            .replace(/[^A-Z0-9]/gi, '')
            .toUpperCase()
            .slice(0, 8);
          if (!raw) return;
          if (raw.length > 6 && boxCount < 8) {
            boxCount = 8;
            formData.coupleCode = raw;
            buildCodeBoxes();
            codeBoxes[Math.min(raw.length - 1, 7)]?.focus();
            return;
          }
          raw.split('').forEach((ch, idx) => {
            if (codeBoxes[idx]) codeBoxes[idx].value = ch;
          });
          syncCodeFromBoxes();
          codeBoxes[Math.min(raw.length, codeBoxes.length - 1)]?.focus();
        });

        codeBoxes.push(cell);
        boxesContainer.appendChild(cell);
      }
    };

    buildCodeBoxes();
    body.appendChild(boxesContainer);

    const lenToggle = document.createElement('button');
    lenToggle.type = 'button';
    lenToggle.className = 'p-auth-link';
    lenToggle.style.alignSelf = 'center';
    lenToggle.textContent = boxCount === 6 ? 'Dùng mã 8 ký tự' : 'Dùng mã 6 ký tự';
    lenToggle.addEventListener('click', () => {
      boxCount = boxCount === 6 ? 8 : 6;
      formData.coupleCode = formData.coupleCode.slice(0, boxCount);
      lenToggle.textContent = boxCount === 6 ? 'Dùng mã 8 ký tự' : 'Dùng mã 6 ký tự';
      buildCodeBoxes();
      codeBoxes[0]?.focus();
    });
    body.appendChild(lenToggle);

    let emailInput: HTMLInputElement | null = null;
    let passwordInput: HTMLInputElement | null = null;

    if (!isGoogleUser) {
      const toggleRow = document.createElement('div');
      toggleRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:14px;background:var(--bg-canvas);border:1px solid var(--border-subtle);';
      const copy = document.createElement('span');
      copy.style.cssText = 'font-size:12px;font-weight:600;color:var(--text-primary);';
      copy.textContent = 'Đăng ký Email để đăng nhập trên máy khác';

      const accountFields = document.createElement('div');
      accountFields.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
      accountFields.hidden = !formData.useAccount;

      const sw = createSwitch({
        ariaLabel: 'Đăng ký tài khoản Email',
        checked: formData.useAccount,
        onChange: (checked) => {
          formData.useAccount = checked;
          accountFields.hidden = !checked;
        },
      });
      toggleRow.append(copy, sw.element);

      emailInput = document.createElement('input');
      emailInput.type = 'email';
      emailInput.className = 'c-input';
      emailInput.placeholder = 'Email của bạn';
      emailInput.setAttribute('aria-label', 'Email của bạn');
      emailInput.value = formData.email;
      emailInput.addEventListener('input', () => {
        formData.email = emailInput!.value.trim();
        formData.emailVerified = false;
        formData.otpCode = '';
      });

      passwordInput = document.createElement('input');
      passwordInput.type = 'password';
      passwordInput.className = 'c-input';
      passwordInput.placeholder = 'Mật khẩu (tối thiểu 6 ký tự)';
      passwordInput.setAttribute('aria-label', 'Mật khẩu');
      passwordInput.value = formData.password;
      passwordInput.addEventListener('input', () => {
        formData.password = passwordInput!.value;
      });

      accountFields.append(emailInput, passwordInput);
      body.append(toggleRow, accountFields);
    }

    body.appendChild(
      createButton({
        label: 'Tiếp tục',
        variant: 'primary',
        pill: true,
        block: true,
        trailingIcon: 'chevron-right',
        onClick: () => {
          syncCodeFromBoxes();
          if (!formData.coupleCode || formData.coupleCode.length < 4) {
            showToast('Couple Code cần ít nhất 4 ký tự', 'error');
            codeBoxes[0]?.focus();
            return;
          }
          if (formData.useAccount) {
            if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
              showToast('Vui lòng nhập Email hợp lệ', 'error');
              emailInput?.focus();
              return;
            }
            if (formData.password.length < 6) {
              showToast('Mật khẩu cần ít nhất 6 ký tự', 'error');
              passwordInput?.focus();
              return;
            }
          }
          triggerHaptic('tap');
          currentStep++;
          renderCurrentStep();
        },
      }).element,
    );

    renderStepShell(
      'key',
      'Mã ghép đôi hai đứa',
      'Hai người nhập chung một mã bí mật (4–8 ký tự) để nối hai thiết bị vào cùng một nhà.',
      body,
    );
    requestAnimationFrame(() => codeBoxes[0]?.focus());
  }

  // ── Step 4: Email OTP Verification ──
  function renderStep4OTP(): void {
    const body = document.createElement('div');
    body.style.cssText = 'display:flex;flex-direction:column;gap:14px;';

    let cooldown = 0;
    let cooldownInterval: ReturnType<typeof setInterval> | null = null;

    const offlineBanner = document.createElement('div');
    offlineBanner.className = 'p-install-alert';
    offlineBanner.hidden = true;
    offlineBanner.innerHTML = `
      ${iconMarkup('wifi-off', { size: 20 })}
      <div><strong>Chưa có kết nối mạng.</strong> Bạn có thể kết nối lại rồi thử, hoặc bấm bỏ qua xác thực bên dưới.</div>
    `;
    body.appendChild(offlineBanner);

    const otpWrapper = document.createElement('div');
    otpWrapper.className = 'p-otp-grid';
    const otpInputs: HTMLInputElement[] = [];

    const syncOtpValue = () => {
      formData.otpCode = otpInputs.map((i) => i.value).join('');
    };

    for (let i = 0; i < 6; i++) {
      const box = document.createElement('input');
      box.type = 'text';
      box.inputMode = 'numeric';
      box.maxLength = 1;
      box.className = 'p-otp-cell';
      box.setAttribute('aria-label', `Chữ số OTP ${i + 1}`);
      box.addEventListener('input', () => {
        const val = box.value.replace(/\D/g, '');
        box.value = val.slice(-1);
        syncOtpValue();
        if (val && i < 5) otpInputs[i + 1]?.focus();
      });
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && i > 0) otpInputs[i - 1]?.focus();
        if (e.key === 'Enter') void handleVerify();
      });
      box.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
        text.split('').forEach((ch, idx) => {
          if (otpInputs[idx]) otpInputs[idx].value = ch;
        });
        syncOtpValue();
        otpInputs[Math.min(text.length, 5)]?.focus();
      });
      otpInputs.push(box);
      otpWrapper.appendChild(box);
    }
    body.appendChild(otpWrapper);

    const verifyCtrl = createButton({
      label: 'Xác thực Email',
      variant: 'primary',
      pill: true,
      block: true,
      leadingIcon: 'check',
      onClick: () => void handleVerify(),
    });

    const resendCtrl = createButton({
      label: 'Gửi lại mã',
      variant: 'secondary',
      size: 'sm',
      pill: true,
      block: true,
      onClick: () => void handleSendOtp(true),
    });

    const skipBtn = createButton({
      label: 'Bỏ qua xác thực lúc này',
      variant: 'ghost',
      size: 'sm',
      pill: true,
      block: true,
      onClick: () => {
        if (cooldownInterval) clearInterval(cooldownInterval);
        formData.emailVerified = false;
        formData.otpCode = '';
        currentStep++;
        renderCurrentStep();
      },
    });

    body.append(verifyCtrl.element, resendCtrl.element, skipBtn.element);

    renderStepShell(
      'mail',
      'Xác thực Email',
      `Nhập mã 6 chữ số vừa được gửi tới ${formData.email}`,
      body,
    );

    const isNetworkError = (err: unknown): boolean => {
      if (!navigator.onLine) return true;
      if (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) return true;
      if (err instanceof Error) {
        const m = err.message.toLowerCase();
        return m.includes('network') || m.includes('failed to fetch') || m.includes('offline');
      }
      return false;
    };

    async function handleSendOtp(isResend: boolean): Promise<void> {
      if (cooldown > 0) return;
      resendCtrl.setDisabled(true);
      resendCtrl.setLabel('Đang gửi...');

      try {
        await sendOtp(formData.email);
        offlineBanner.hidden = true;
        showToast(isResend ? 'Đã gửi lại mã OTP mới!' : `Đã gửi mã OTP tới ${formData.email}`, 'success');
        cooldown = 60;
        resendCtrl.setLabel(`Gửi lại sau ${cooldown}s`);
        cooldownInterval = setInterval(() => {
          cooldown--;
          if (cooldown <= 0) {
            clearInterval(cooldownInterval!);
            resendCtrl.setLabel('Gửi lại mã');
            resendCtrl.setDisabled(false);
          } else {
            resendCtrl.setLabel(`Gửi lại sau ${cooldown}s`);
          }
        }, 1000);
      } catch (err) {
        resendCtrl.setDisabled(false);
        resendCtrl.setLabel('Thử gửi lại');
        if (isNetworkError(err)) offlineBanner.hidden = false;
        else showToast(err instanceof Error ? err.message : 'Gửi email thất bại', 'error');
      }
    }

    async function handleVerify(): Promise<void> {
      syncOtpValue();
      if (formData.otpCode.length !== 6) {
        showToast('Vui lòng nhập đủ 6 chữ số', 'error');
        otpInputs[0]?.focus();
        return;
      }

      verifyCtrl.setLoading(true, 'Đang xác thực...');
      try {
        await verifyOtp(formData.email, formData.otpCode);
        formData.emailVerified = true;
        if (cooldownInterval) clearInterval(cooldownInterval);
        triggerHaptic('confirm');
        showToast('Xác thực Email thành công!', 'success');
        currentStep++;
        renderCurrentStep();
      } catch (err) {
        verifyCtrl.setLoading(false);
        if (isNetworkError(err)) offlineBanner.hidden = false;
        else showToast(err instanceof Error ? err.message : 'Mã OTP chưa đúng', 'error');
      }
    }

    void handleSendOtp(false);
    requestAnimationFrame(() => otpInputs[0]?.focus());
  }

  // ── Step 5: Love Start Date ──
  function renderStepDate(): void {
    const body = document.createElement('div');
    body.style.cssText = 'display:flex;flex-direction:column;gap:14px;';

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (!formData.loveStartDate) {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(today.getFullYear() - 1);
      formData.loveStartDate = oneYearAgo.toISOString().split('T')[0];
    }

    const presetsWrap = document.createElement('div');
    presetsWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;justify-content:center;';
    const presets = [
      { label: 'Hôm nay', days: 0 },
      { label: '100 ngày', days: 100 },
      { label: '6 tháng', days: 180 },
      { label: '1 năm', days: 365 },
      { label: '2 năm', days: 730 },
    ];

    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = 'c-input';
    dateInput.max = todayStr;
    dateInput.value = formData.loveStartDate;
    dateInput.setAttribute('aria-label', 'Ngày bắt đầu yêu nhau');
    dateInput.style.cssText = 'text-align:center;font-size:16px;font-weight:700;min-height:50px;';

    const previewBox = document.createElement('div');
    previewBox.style.cssText = 'padding:14px;border-radius:16px;background:var(--accent-50);border:1.5px solid var(--accent-200);text-align:center;display:flex;flex-direction:column;align-items:center;gap:4px;';

    const updatePreview = () => {
      const days = calcDaysTogether(formData.loveStartDate);
      previewBox.innerHTML = `
        <span class="u-text-secondary" style="font-size:12px;">Hai đứa đã đồng hành</span>
        <strong style="font-family:var(--font-display);font-size:30px;color:var(--accent-600);line-height:1.1;">${days.toLocaleString('vi-VN')} ngày</strong>
      `;
    };

    presets.forEach((p) => {
      presetsWrap.appendChild(
        createChip({
          label: p.label,
          interactive: true,
          onClick: () => {
            const d = new Date();
            d.setDate(d.getDate() - p.days);
            const nextStr = d.toISOString().split('T')[0];
            formData.loveStartDate = nextStr;
            dateInput.value = nextStr;
            triggerHaptic('select');
            updatePreview();
          },
        }),
      );
    });

    dateInput.addEventListener('change', () => {
      if (dateInput.value > todayStr) {
        dateInput.value = todayStr;
        showToast('Ngày kỷ niệm không thể ở tương lai nhé', 'info');
      }
      formData.loveStartDate = dateInput.value;
      updatePreview();
    });

    updatePreview();

    const finishCtrl = createButton({
      label: 'Mở không gian hai đứa',
      variant: 'primary',
      size: 'lg',
      pill: true,
      block: true,
      leadingIcon: 'heart',
      onClick: () => void handleSubmit(finishCtrl),
    });

    const skipBtn = createButton({
      label: 'Thiết lập sau',
      variant: 'ghost',
      size: 'sm',
      pill: true,
      block: true,
      onClick: () => void handleSubmit(finishCtrl),
    });

    body.append(presetsWrap, dateInput, previewBox, finishCtrl.element, skipBtn.element);

    renderStepShell(
      'calendar',
      'Ngày bắt đầu yêu nhau',
      'Chọn cột mốc đầu tiên để ứng dụng đếm từng ngày kỷ niệm và chuẩn bị thiệp bất ngờ.',
      body,
    );
  }

  async function handleSubmit(btnCtrl: ReturnType<typeof createButton>): Promise<void> {
    btnCtrl.setLoading(true, 'Đang khởi tạo...');

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
    } catch {
      showToast('Chế độ xem thử Local: Đang mở trang chính...', 'info');
      const preview = seedMockPreviewData({
        displayName: formData.displayName,
        partnerName: formData.partnerName,
        coupleCode: formData.coupleCode,
        loveStartDate: formData.loveStartDate,
        email: formData.useAccount ? formData.email : undefined,
      });

      store.set({
        token: MOCK_PREVIEW_TOKEN,
        user: preview.user,
        couple: preview.couple,
      });
      localStorage.setItem('lovecheck_token', MOCK_PREVIEW_TOKEN);
      showSuccessAndNavigate();
    }
  }

  function showSuccessAndNavigate(): void {
    [
      'google_authenticated_user',
      'dev_onboarding_step',
      'dev_onboarding_displayName',
      'dev_onboarding_partnerName',
      'dev_onboarding_coupleCode',
      'dev_onboarding_loveStartDate',
      'dev_onboarding_email',
      'dev_onboarding_useAccount',
    ].forEach((k) => sessionStorage.removeItem(k));

    triggerHaptic('confirm');
    root.replaceChildren();
    const welcome = document.createElement('div');
    welcome.className = 'p-auth-hero';
    welcome.style.margin = 'auto';
    welcome.appendChild(createBadge('Đã sẵn sàng', 'gold'));
    welcome.insertAdjacentHTML(
      'beforeend',
      `
      <div class="p-auth-emblem" style="margin-top:12px;">${iconMarkup('heart-burst', { size: 32, variant: 'filled' })}</div>
      <h1 class="p-auth-title">Chào mừng, ${formData.displayName}!</h1>
      <p class="p-auth-sub">Bắt đầu hành trình yêu thương cùng ${formData.partnerName} ngay thôi.</p>
    `,
    );
    root.appendChild(welcome);
    setTimeout(() => navigate('/app/home', true), 1200);
  }

  function renderCurrentStep(): void {
    sessionStorage.setItem('dev_onboarding_step', String(currentStep));
    sessionStorage.setItem('dev_onboarding_displayName', formData.displayName);
    sessionStorage.setItem('dev_onboarding_partnerName', formData.partnerName);
    sessionStorage.setItem('dev_onboarding_coupleCode', formData.coupleCode);
    sessionStorage.setItem('dev_onboarding_loveStartDate', formData.loveStartDate);
    sessionStorage.setItem('dev_onboarding_useAccount', String(formData.useAccount));

    switch (currentStep) {
      case 0: renderStep1(); break;
      case 1: renderStep2(); break;
      case 2: renderStep3(); break;
      case 3:
        if (formData.useAccount && !isGoogleUser) renderStep4OTP();
        else renderStepDate();
        break;
      case 4:
        renderStepDate();
        break;
    }
  }

  renderCurrentStep();
  return root;
}
