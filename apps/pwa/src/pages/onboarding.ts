import '../styles/20-pages/auth.css';
import '../styles/20-pages/onboarding-date.css';
import { navigate } from '../router';
import { createThemeToggleButton } from '../components/theme-toggle';
import { store } from '../store/index';
import { startOnboarding, sendOtp, verifyOtp, loginWithGoogle } from '../api/auth';
import { ApiError } from '../api/client';
import { showToast } from '../components/toast';
import { MOCK_PREVIEW_TOKEN, seedMockPreviewData } from '../dev/mock-data';
import { iconMarkup, type IconName } from '../ui/icons/icons';
import { createBadge, createButton, createIconButton } from '../ui/primitives';
import { triggerHaptic } from '../ui/haptics';
import { isLocalDevHostname, mountGoogleSignInButton } from '../ui/google-signin';

const WHEEL_ITEM_HEIGHT = 40;
const DEMO_OTP_PIN = '123456';

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

function formatLocalIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function calcDaysTogether(dateStr: string): number {
  if (!dateStr) return 0;
  const parts = dateStr.split('-').map((n) => parseInt(n, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return 0;
  const start = new Date(parts[0], parts[1] - 1, parts[2]);
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = todayMidnight.getTime() - start.getTime();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
}

function formatDateVietnamese(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-').map((n) => parseInt(n, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return '';
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  if (Number.isNaN(date.getTime())) return '';
  const daysOfWeek = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const dayName = daysOfWeek[date.getDay()];
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${dayName}, ${day}/${month}/${year}`;
}

export type OnboardingMode = 'email' | 'google';

export function renderOnboardingPage(options: { mode?: OnboardingMode } = {}): HTMLElement {
  const deviceId = getOrCreateDeviceId();

  const savedStep = sessionStorage.getItem('dev_onboarding_step');
  let currentStep = savedStep !== null ? Math.max(0, Math.min(4, parseInt(savedStep, 10))) : 0;
  const TOTAL_STEPS = 5;

  let isGoogleUser =
    options.mode === 'google'
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
    // Mandatory account connection when not Google-authenticated
    useAccount: !isGoogleUser,
    emailVerified: isGoogleUser,
  };

  // If browser refreshed on OTP or Date step before account was authenticated, return to Step 3 so password can be entered
  if (!isGoogleUser && currentStep >= 3 && (!formData.email || !formData.password)) {
    currentStep = 2;
  }

  const root = document.createElement('div');
  root.className = 'page-no-nav p-auth animate-fade-in';

  function renderStepShell(
    emblemOrNode: IconName | HTMLElement,
    title: string,
    subtitle: string,
    cardBody: HTMLElement,
    footerNode?: HTMLElement,
  ): void {
    root.replaceChildren();

    const visibleSteps = isGoogleUser ? TOTAL_STEPS - 1 : TOTAL_STEPS;
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
            if (currentStep === 4 && (isGoogleUser || formData.emailVerified)) {
              currentStep = 2;
            } else {
              currentStep = Math.max(0, currentStep - 1);
            }
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

    if (typeof emblemOrNode === 'string') {
      const emblem = document.createElement('div');
      emblem.className = 'p-auth-emblem';
      emblem.innerHTML = iconMarkup(emblemOrNode, { size: 32, variant: 'filled' });
      hero.appendChild(emblem);
    } else {
      hero.appendChild(emblemOrNode);
    }

    const titleEl = document.createElement('h1');
    titleEl.className = 'p-auth-title';
    titleEl.textContent = title;

    const subEl = document.createElement('p');
    subEl.className = 'p-auth-sub';
    subEl.textContent = subtitle;

    hero.append(titleEl, subEl);

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

  // ── Step 3: Couple Code + MANDATORY Email/Password OR Google OAuth ──
  function renderStep3(): void {
    const body = document.createElement('div');
    body.style.cssText = 'display:flex;flex-direction:column;gap:14px;';

    const boxCount = 6;
    formData.coupleCode = formData.coupleCode.slice(0, boxCount);
    const codeHead = document.createElement('div');
    codeHead.className = 'p-onboard-section-label';
    const codeLabel = document.createElement('span');
    codeLabel.textContent = 'Mã ghép đôi (6 ký tự)';
    codeHead.append(codeLabel);
    body.appendChild(codeHead);

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
            .slice(0, boxCount);
          if (!raw) return;
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

    let emailInput: HTMLInputElement | null = null;
    let passwordInput: HTMLInputElement | null = null;

    if (isGoogleUser) {
      formData.useAccount = false;
      formData.emailVerified = true;

      const connectedBox = document.createElement('div');
      connectedBox.className = 'p-onboard-google-connected';
      connectedBox.innerHTML = `
        ${iconMarkup('google', { size: 20 })}
        <div class="p-onboard-google-connected__body">
          <span>Đã xác thực tài khoản Google</span>
          <span class="p-onboard-google-connected__email">${formData.email || store.get().user?.email || 'Tài khoản Google của bạn'}</span>
        </div>
      `;
      body.appendChild(connectedBox);

      body.appendChild(
        createButton({
          label: 'Tiếp tục chọn ngày kỷ niệm',
          variant: 'primary',
          pill: true,
          block: true,
          trailingIcon: 'chevron-right',
          onClick: () => {
            syncCodeFromBoxes();
            if (!formData.coupleCode || formData.coupleCode.length !== 6) {
              showToast('Mã ghép đôi cần đủ 6 ký tự', 'error');
              codeBoxes[0]?.focus();
              return;
            }
            triggerHaptic('tap');
            currentStep = 3;
            renderCurrentStep();
          },
        }).element,
      );
    } else {
      formData.useAccount = true;

      const authBox = document.createElement('div');
      authBox.className = 'p-onboard-auth-box';

      const authHead = document.createElement('div');
      authHead.className = 'p-onboard-section-label';
      authHead.innerHTML = `<span>Tài khoản bảo mật (bắt buộc)</span>`;
      authBox.appendChild(authHead);

      const emailWrap = document.createElement('div');
      emailWrap.className = 'p-auth-input-wrap';
      emailWrap.innerHTML = `<span class="p-auth-input-wrap__lead">${iconMarkup('mail', { size: 20 })}</span>`;
      emailInput = document.createElement('input');
      emailInput.type = 'email';
      emailInput.className = 'c-input';
      emailInput.placeholder = 'Email của bạn (bắt buộc)';
      emailInput.autocomplete = 'email';
      emailInput.setAttribute('aria-label', 'Email của bạn');
      emailInput.value = formData.email;
      emailInput.addEventListener('input', () => {
        const nextEmail = emailInput!.value.trim();
        if (nextEmail !== formData.email) {
          formData.emailVerified = false;
          formData.otpCode = '';
        }
        formData.email = nextEmail;
      });
      emailWrap.appendChild(emailInput);

      const pwdWrap = document.createElement('div');
      pwdWrap.className = 'p-auth-input-wrap p-auth-input-wrap--trail';
      pwdWrap.innerHTML = `<span class="p-auth-input-wrap__lead">${iconMarkup('lock', { size: 20 })}</span>`;
      passwordInput = document.createElement('input');
      passwordInput.type = 'password';
      passwordInput.className = 'c-input';
      passwordInput.placeholder = 'Mật khẩu (tối thiểu 6 ký tự)';
      passwordInput.autocomplete = 'new-password';
      passwordInput.setAttribute('aria-label', 'Mật khẩu');
      passwordInput.value = formData.password;
      passwordInput.addEventListener('input', () => {
        formData.password = passwordInput!.value;
      });

      const eyeBtn = document.createElement('button');
      eyeBtn.type = 'button';
      eyeBtn.className = 'p-auth-eye-btn';
      eyeBtn.setAttribute('aria-label', 'Hiện mật khẩu');
      eyeBtn.innerHTML = iconMarkup('eye', { size: 20 });
      let pwdVisible = false;
      eyeBtn.addEventListener('click', () => {
        pwdVisible = !pwdVisible;
        passwordInput!.type = pwdVisible ? 'text' : 'password';
        eyeBtn.setAttribute('aria-label', pwdVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
        eyeBtn.innerHTML = iconMarkup(pwdVisible ? 'eye-off' : 'eye', { size: 20 });
      });

      pwdWrap.append(passwordInput, eyeBtn);
      authBox.append(emailWrap, pwdWrap);
      body.appendChild(authBox);

      const submitStep3Email = () => {
        syncCodeFromBoxes();
        if (!formData.coupleCode || formData.coupleCode.length !== 6) {
          showToast('Mã ghép đôi cần đủ 6 ký tự', 'error');
          codeBoxes[0]?.focus();
          return;
        }
        if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          showToast('Vui lòng nhập Email hợp lệ hoặc đăng nhập qua Google', 'error');
          emailInput?.focus();
          return;
        }
        if (formData.password.length < 6) {
          showToast('Mật khẩu cần ít nhất 6 ký tự', 'error');
          passwordInput?.focus();
          return;
        }
        triggerHaptic('tap');
        currentStep = formData.emailVerified ? 4 : 3;
        renderCurrentStep();
      };

      passwordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitStep3Email();
      });

      body.appendChild(
        createButton({
          label: 'Tiếp tục xác thực Email',
          variant: 'primary',
          pill: true,
          block: true,
          trailingIcon: 'chevron-right',
          onClick: submitStep3Email,
        }).element,
      );

      const divider = document.createElement('div');
      divider.className = 'p-auth-divider';
      divider.innerHTML = '<span>hoặc dùng Email</span>';
      body.insertBefore(divider, authBox);

      const googleWrap = document.createElement('div');
      googleWrap.className = 'p-onboard-google-wrap';
      googleWrap.setAttribute('aria-live', 'polite');

      const googleMount = document.createElement('div');
      googleMount.className = 'p-onboard-google-mount';
      googleMount.id = 'onboarding-google-signin';

      const googleStatus = document.createElement('p');
      googleStatus.className = 'p-onboard-google-status';
      googleStatus.textContent = 'Đang tải đăng nhập Google…';

      googleWrap.append(googleMount, googleStatus);
      body.insertBefore(googleWrap, divider);

      mountGoogleSignInButton(
        googleMount,
        googleStatus,
        (credential) => {
          syncCodeFromBoxes();
          void handleStep3GoogleCredential(credential, googleWrap, googleStatus);
        },
        { buttonText: 'continue_with', width: 280 },
      );
    }

    renderStepShell(
      'key',
      'Mã ghép đôi & Tài khoản',
      isGoogleUser
        ? 'Nhập chung một mã bí mật (6 ký tự) để nối hai thiết bị vào cùng một nhà.'
        : 'Nhập mã ghép đôi, rồi đăng nhập Google hoặc dùng Email.',
      body,
    );
    requestAnimationFrame(() => codeBoxes[0]?.focus());
  }

  async function handleStep3GoogleCredential(
    credential: string,
    googleWrap: HTMLElement,
    googleStatus: HTMLElement,
  ): Promise<void> {
    googleWrap.style.pointerEvents = 'none';
    googleWrap.setAttribute('aria-busy', 'true');
    googleStatus.textContent = 'Đang xác thực tài khoản Google…';

    try {
      const result = await loginWithGoogle({ credential });
      store.set({
        token: result.token,
        user: result.user,
        couple: result.couple,
      });
      localStorage.setItem('lovecheck_token', result.token);

      const isDevGoogleLogin = credential.startsWith('mock-google-');

      if (result.couple) {
        clearOnboardingSessionKeys();
        triggerHaptic('confirm');
        showToast('Đăng nhập Google thành công!', 'success');
        navigate(isDevGoogleLogin ? '/app/profile' : '/app/home', true);
        return;
      }

      isGoogleUser = true;
      formData.useAccount = false;
      formData.emailVerified = true;
      if (result.user.email) {
        formData.email = result.user.email;
        sessionStorage.setItem('dev_onboarding_email', result.user.email);
      }
      if (!formData.displayName && result.user.displayName) {
        formData.displayName = result.user.displayName;
      }
      sessionStorage.setItem('google_authenticated_user', 'true');
      triggerHaptic('confirm');

      if (formData.coupleCode && formData.coupleCode.length === 6) {
        showToast('Đã kết nối Google! Hãy chọn ngày bắt đầu yêu nhé.', 'success');
        currentStep = 3;
        renderCurrentStep();
      } else {
        showToast('Đã kết nối Google! Hãy nhập Couple Code để tiếp tục.', 'info');
        currentStep = 2;
        renderCurrentStep();
      }
    } catch (err) {
      googleWrap.style.pointerEvents = '';
      googleWrap.removeAttribute('aria-busy');
      googleStatus.textContent = 'Google sẽ xác thực an toàn tài khoản của bạn.';
      showToast(err instanceof Error ? err.message : 'Đăng nhập Google thất bại', 'error');
    }
  }

  // ── Step 4: Mandatory Email OTP Verification ──
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
      <div><strong>Chưa có kết nối mạng.</strong> Vui lòng kiểm tra kết nối Internet rồi bấm gửi lại mã xác thực.</div>
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

    const demoPin = isLocalDevHostname();
    if (demoPin) {
      const hint = document.createElement('p');
      hint.className = 'p-onboard-auth-note';
      hint.textContent = `Chế độ demo: nhập mã ${DEMO_OTP_PIN} để đi tiếp, không cần email thật.`;
      body.appendChild(hint);
    }

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

    const changeAuthBtn = createButton({
      label: 'Đổi Email hoặc dùng Google',
      variant: 'ghost',
      size: 'sm',
      pill: true,
      block: true,
      leadingIcon: 'back',
      onClick: () => {
        if (cooldownInterval) clearInterval(cooldownInterval);
        currentStep = 2;
        renderCurrentStep();
      },
    });

    body.append(verifyCtrl.element, resendCtrl.element, changeAuthBtn.element);

    renderStepShell(
      'mail',
      'Xác thực Email',
      `Nhập mã 6 chữ số vừa được gửi tới ${formData.email}`,
      body,
    );

    const isNetworkError = (err: unknown): boolean => {
      if (!navigator.onLine) return true;
      if (err instanceof ApiError && err.code === 'NETWORK_ERROR') return true;
      if (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) return true;
      if (err instanceof Error) {
        const m = err.message.toLowerCase();
        return m.includes('network') || m.includes('failed to fetch') || m.includes('offline');
      }
      return false;
    };

    async function handleSendOtp(isResend: boolean): Promise<void> {
      if (cooldown > 0) return;
      if (demoPin) {
        showToast(`Demo: dùng mã ${DEMO_OTP_PIN}`, 'info');
        return;
      }
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
        if (demoPin) {
          if (formData.otpCode !== DEMO_OTP_PIN) throw new Error(`Mã demo là ${DEMO_OTP_PIN}`);
        } else {
          await verifyOtp(formData.email, formData.otpCode);
        }
        formData.emailVerified = true;
        if (cooldownInterval) clearInterval(cooldownInterval);
        triggerHaptic('confirm');
        showToast('Xác thực Email thành công!', 'success');
        currentStep = 4;
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

  // ── Step 5: Love Start Date (Animated 3-Column Wheel + Clickable Items + Calendar Popup) ──
  function renderStepDate(): void {
    const body = document.createElement('div');
    body.style.cssText = 'display:flex;flex-direction:column;gap:14px;';

    const today = new Date();
    const todayStr = formatLocalIsoDate(today);

    if (!formData.loveStartDate) {
      const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      formData.loveStartDate = formatLocalIsoDate(oneYearAgo);
    }

    // Animated Mini Calendar Sticker Emblem in Hero
    const calEmblem = document.createElement('div');
    calEmblem.className = 'p-date-cal-emblem';
    const calMonthEl = document.createElement('span');
    calMonthEl.className = 'p-date-cal-emblem__month';
    const calDayEl = document.createElement('span');
    calDayEl.className = 'p-date-cal-emblem__day';
    const calTagEl = document.createElement('span');
    calTagEl.className = 'p-date-cal-emblem__tag';
    calTagEl.textContent = 'LOVE';
    calEmblem.append(calMonthEl, calDayEl, calTagEl);

    // Hidden native date input for full month-grid popup fallback
    const nativeDateInput = document.createElement('input');
    nativeDateInput.type = 'date';
    nativeDateInput.max = todayStr;
    nativeDateInput.value = formData.loveStartDate;
    nativeDateInput.tabIndex = -1;
    nativeDateInput.setAttribute('aria-label', 'Chọn ngày từ bảng lịch');
    nativeDateInput.style.cssText = 'position:absolute;opacity:0;pointer-events:none;width:1px;height:1px;';
    body.appendChild(nativeDateInput);

    // 1. Presets Header + Native Calendar Trigger
    const presetsHead = document.createElement('div');
    presetsHead.className = 'p-date-presets-head';
    presetsHead.innerHTML = `<span class="p-date-presets-title">Chọn nhanh cột mốc</span>`;

    const openCalBtn = document.createElement('button');
    openCalBtn.type = 'button';
    openCalBtn.className = 'p-date-cal-btn';
    openCalBtn.innerHTML = `${iconMarkup('calendar', { size: 16 })}<span>Mở lịch tháng</span>`;
    openCalBtn.addEventListener('click', () => {
      const pickerInput = nativeDateInput as HTMLInputElement & { showPicker?: () => void };
      if (typeof pickerInput.showPicker === 'function') {
        try {
          pickerInput.showPicker();
          return;
        } catch {
          // Fall back to click
        }
      }
      nativeDateInput.click();
    });
    presetsHead.appendChild(openCalBtn);
    body.appendChild(presetsHead);

    const presetsList = document.createElement('div');
    presetsList.className = 'p-date-presets-list';
    const presets = [
      { label: 'Hôm nay', days: 0 },
      { label: '100 ngày', days: 100 },
      { label: '6 tháng', days: 180 },
      { label: '1 năm', days: 365 },
      { label: '2 năm', days: 730 },
      { label: '3 năm', days: 1095 },
    ];
    body.appendChild(presetsList);

    // 2. Interactive Animated 3-Column Drum Wheel (Ngày / Tháng / Năm)
    const wheelWrap = document.createElement('div');
    wheelWrap.className = 'p-date-wheel-wrap';
    wheelWrap.innerHTML = `
      <div class="p-date-wheel-headers">
        <span>Ngày</span>
        <span>Tháng</span>
        <span>Năm</span>
      </div>
    `;

    const wheelStage = document.createElement('div');
    wheelStage.className = 'p-date-wheel';
    wheelStage.innerHTML = `
      <div class="p-date-wheel__highlight"></div>
      <div class="p-date-wheel__mask-top"></div>
      <div class="p-date-wheel__mask-bottom"></div>
      <div class="p-date-wheel__col" id="wheel-day" role="listbox" aria-label="Chọn ngày"></div>
      <div class="p-date-wheel__col" id="wheel-month" role="listbox" aria-label="Chọn tháng"></div>
      <div class="p-date-wheel__col" id="wheel-year" role="listbox" aria-label="Chọn năm"></div>
    `;
    wheelWrap.appendChild(wheelStage);
    body.appendChild(wheelWrap);

    const wheelDay = wheelStage.querySelector<HTMLElement>('#wheel-day')!;
    const wheelMonth = wheelStage.querySelector<HTMLElement>('#wheel-month')!;
    const wheelYear = wheelStage.querySelector<HTMLElement>('#wheel-year')!;

    const daysList: string[] = [];
    const dayButtons: HTMLButtonElement[] = [];
    for (let d = 1; d <= 31; d++) {
      const val = String(d).padStart(2, '0');
      daysList.push(val);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'p-date-wheel__item love-date-wheel-item';
      btn.dataset.value = val;
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-label', `Ngày ${val}`);
      btn.textContent = val;
      const idx = d - 1;
      btn.addEventListener('click', () => selectFromColumnClick('day', idx));
      dayButtons.push(btn);
      wheelDay.appendChild(btn);
    }

    const monthsList: string[] = [];
    const monthButtons: HTMLButtonElement[] = [];
    for (let m = 1; m <= 12; m++) {
      const val = String(m).padStart(2, '0');
      monthsList.push(val);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'p-date-wheel__item love-date-wheel-item';
      btn.dataset.value = val;
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-label', `Tháng ${m}`);
      btn.textContent = `Tháng ${m}`;
      const idx = m - 1;
      btn.addEventListener('click', () => selectFromColumnClick('month', idx));
      monthButtons.push(btn);
      wheelMonth.appendChild(btn);
    }

    const currentYear = today.getFullYear();
    const yearsList: string[] = [];
    const yearButtons: HTMLButtonElement[] = [];
    for (let y = currentYear; y >= 1990; y--) {
      const val = String(y);
      yearsList.push(val);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'p-date-wheel__item love-date-wheel-item';
      btn.dataset.value = val;
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-label', `Năm ${val}`);
      btn.textContent = val;
      const idx = yearsList.length - 1;
      btn.addEventListener('click', () => selectFromColumnClick('year', idx));
      yearButtons.push(btn);
      wheelYear.appendChild(btn);
    }

    // 3. Dark-Mode-Safe Live Preview Card
    const previewBox = document.createElement('div');
    previewBox.className = 'p-date-preview';
    const previewLabel = document.createElement('span');
    previewLabel.className = 'p-date-preview__label';
    previewLabel.textContent = 'Hai đứa đã đồng hành';
    const previewCount = document.createElement('strong');
    previewCount.className = 'p-date-preview__count';
    const previewSub = document.createElement('span');
    previewSub.className = 'p-date-preview__sub';
    const previewMilestone = document.createElement('span');
    previewMilestone.className = 'p-date-preview__milestone';
    previewBox.append(previewLabel, previewCount, previewSub, previewMilestone);
    body.appendChild(previewBox);

    // State & Animation Helpers
    let selectedIndices = { day: 0, month: 0, year: 0 };
    let isProgrammaticScroll = false;
    let programmaticTimer: ReturnType<typeof setTimeout> | null = null;
    let scrollSettleTimer: ReturnType<typeof setTimeout> | null = null;
    let displayedDaysCount: number | null = null;
    let countRafId: number | null = null;

    function applyColumnHighlight(buttons: HTMLButtonElement[], activeIdx: number): void {
      buttons.forEach((btn, idx) => {
        const dist = Math.abs(idx - activeIdx);
        btn.classList.toggle('selected', dist === 0);
        btn.classList.toggle('is-near', dist === 1);
        btn.setAttribute('aria-selected', String(dist === 0));
      });
    }

    function scrollColumnToIndex(col: HTMLElement, idx: number, animate: boolean): void {
      const targetTop = idx * WHEEL_ITEM_HEIGHT;
      if (animate && typeof col.scrollTo === 'function') {
        col.classList.add('is-animating');
        try {
          col.scrollTo({ top: targetTop, behavior: 'smooth' });
        } catch {
          col.scrollTop = targetTop;
        }
      } else {
        col.scrollTop = targetTop;
      }
    }

    function lockProgrammaticScroll(durationMs: number): void {
      isProgrammaticScroll = true;
      if (programmaticTimer) clearTimeout(programmaticTimer);
      programmaticTimer = setTimeout(() => {
        wheelDay.classList.remove('is-animating');
        wheelMonth.classList.remove('is-animating');
        wheelYear.classList.remove('is-animating');
        wheelDay.scrollTop = selectedIndices.day * WHEEL_ITEM_HEIGHT;
        wheelMonth.scrollTop = selectedIndices.month * WHEEL_ITEM_HEIGHT;
        wheelYear.scrollTop = selectedIndices.year * WHEEL_ITEM_HEIGHT;
        isProgrammaticScroll = false;
      }, durationMs);
    }

    function animateDaysCounter(nextDays: number, animate: boolean): void {
      if (countRafId !== null) {
        cancelAnimationFrame(countRafId);
        countRafId = null;
      }
      const prefersReducedMotion =
        typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (!animate || prefersReducedMotion || displayedDaysCount === null || displayedDaysCount === nextDays) {
        displayedDaysCount = nextDays;
        previewCount.textContent = `${nextDays.toLocaleString('vi-VN')} ngày`;
        return;
      }

      const startVal = displayedDaysCount;
      const startTime = performance.now();
      const duration = 220;

      const step = (now: number) => {
        const t = Math.min(1, (now - startTime) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        const cur = Math.round(startVal + (nextDays - startVal) * eased);
        previewCount.textContent = `${cur.toLocaleString('vi-VN')} ngày`;
        if (t < 1) {
          countRafId = requestAnimationFrame(step);
        } else {
          displayedDaysCount = nextDays;
          countRafId = null;
        }
      };
      countRafId = requestAnimationFrame(step);
    }

    function updatePreviewAndBadge(animate: boolean): void {
      const days = calcDaysTogether(formData.loveStartDate);
      animateDaysCounter(days, animate);

      previewSub.textContent = formatDateVietnamese(formData.loveStartDate);

      let milestoneText: string;
      if (days === 0) milestoneText = 'Ngày đầu tiên bên nhau';
      else if (days < 30) milestoneText = 'Những ngày đầu rực rỡ';
      else if (days < 100) milestoneText = 'Sắp chạm mốc 100 ngày';
      else if (days < 365) milestoneText = 'Hành trình đang đơm hoa';
      else milestoneText = `Đã gắn bó ${(days / 365).toFixed(1)} năm ngọt ngào`;
      previewMilestone.textContent = milestoneText;

      const parts = formData.loveStartDate.split('-');
      if (parts.length === 3) {
        calMonthEl.textContent = `THÁNG ${parseInt(parts[1], 10)}`;
        calDayEl.textContent = parts[2];
        if (animate) {
          calEmblem.classList.remove('is-popping');
          void calEmblem.offsetWidth;
          calEmblem.classList.add('is-popping');
        }
      }

      presetsList.querySelectorAll<HTMLButtonElement>('.p-date-preset-chip').forEach((chip) => {
        const targetDays = parseInt(chip.dataset.days || '-1', 10);
        chip.classList.toggle('active', targetDays >= 0 && Math.abs(days - targetDays) <= 1);
      });
    }

    function setDateFromIndices(dayIdx: number, monthIdx: number, yearIdx: number, animate: boolean): void {
      const clampedYearIdx = Math.max(0, Math.min(yearsList.length - 1, yearIdx));
      const clampedMonthIdx = Math.max(0, Math.min(monthsList.length - 1, monthIdx));
      const y = yearsList[clampedYearIdx];
      const m = monthsList[clampedMonthIdx];

      const maxDays = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
      const clampedDayIdx = Math.max(0, Math.min(maxDays - 1, dayIdx));
      const d = daysList[clampedDayIdx];

      const candidateDate = `${y}-${m}-${d}`;
      if (candidateDate > todayStr) {
        showToast('Ngày bắt đầu yêu không thể ở tương lai nhé', 'info');
        syncFromDateString(todayStr, true);
        return;
      }

      selectedIndices = { day: clampedDayIdx, month: clampedMonthIdx, year: clampedYearIdx };
      applyColumnHighlight(dayButtons, clampedDayIdx);
      applyColumnHighlight(monthButtons, clampedMonthIdx);
      applyColumnHighlight(yearButtons, clampedYearIdx);

      lockProgrammaticScroll(animate ? 300 : 60);
      scrollColumnToIndex(wheelDay, clampedDayIdx, animate);
      scrollColumnToIndex(wheelMonth, clampedMonthIdx, animate);
      scrollColumnToIndex(wheelYear, clampedYearIdx, animate);

      formData.loveStartDate = candidateDate;
      nativeDateInput.value = candidateDate;
      sessionStorage.setItem('dev_onboarding_loveStartDate', candidateDate);
      updatePreviewAndBadge(animate);
    }

    function syncFromDateString(dateStr: string, animate: boolean): void {
      if (!dateStr) return;
      const safeStr = dateStr > todayStr ? todayStr : dateStr;
      const parts = safeStr.split('-');
      if (parts.length !== 3) return;
      const yIdx = Math.max(0, yearsList.indexOf(parts[0]));
      const mIdx = Math.max(0, monthsList.indexOf(parts[1]));
      const dIdx = Math.max(0, daysList.indexOf(parts[2]));
      setDateFromIndices(dIdx, mIdx, yIdx, animate);
    }

    function selectFromColumnClick(colKey: 'day' | 'month' | 'year', idx: number): void {
      triggerHaptic('select');
      const next = { ...selectedIndices, [colKey]: idx };
      setDateFromIndices(next.day, next.month, next.year, true);
    }

    function readScrollIndex(col: HTMLElement, maxLen: number): number {
      const idx = Math.round(col.scrollTop / WHEEL_ITEM_HEIGHT);
      return Math.max(0, Math.min(maxLen - 1, idx));
    }

    function handleNativeWheelScroll(): void {
      if (isProgrammaticScroll) return;
      const dIdx = readScrollIndex(wheelDay, daysList.length);
      const mIdx = readScrollIndex(wheelMonth, monthsList.length);
      const yIdx = readScrollIndex(wheelYear, yearsList.length);
      applyColumnHighlight(dayButtons, dIdx);
      applyColumnHighlight(monthButtons, mIdx);
      applyColumnHighlight(yearButtons, yIdx);

      if (scrollSettleTimer) clearTimeout(scrollSettleTimer);
      scrollSettleTimer = setTimeout(() => {
        if (isProgrammaticScroll) return;
        const settledDay = readScrollIndex(wheelDay, daysList.length);
        const settledMonth = readScrollIndex(wheelMonth, monthsList.length);
        const settledYear = readScrollIndex(wheelYear, yearsList.length);
        if (
          settledDay !== selectedIndices.day
          || settledMonth !== selectedIndices.month
          || settledYear !== selectedIndices.year
        ) {
          triggerHaptic('select');
          setDateFromIndices(settledDay, settledMonth, settledYear, false);
        }
      }, 90);
    }

    wheelDay.addEventListener('scroll', handleNativeWheelScroll, { passive: true });
    wheelMonth.addEventListener('scroll', handleNativeWheelScroll, { passive: true });
    wheelYear.addEventListener('scroll', handleNativeWheelScroll, { passive: true });

    // Enable smooth mouse drag on desktop columns without interfering with single clicks
    function attachDesktopMouseDrag(col: HTMLElement): void {
      let dragging = false;
      let moved = false;
      let startY = 0;
      let startScrollTop = 0;

      col.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        dragging = true;
        moved = false;
        startY = e.clientY;
        startScrollTop = col.scrollTop;
      });

      window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const delta = e.clientY - startY;
        if (!moved && Math.abs(delta) > 5) {
          moved = true;
          col.classList.add('is-dragging');
        }
        if (moved) {
          col.scrollTop = startScrollTop - delta;
        }
      });

      window.addEventListener('mouseup', () => {
        if (!dragging) return;
        dragging = false;
        if (moved) {
          col.classList.remove('is-dragging');
          handleNativeWheelScroll();
        }
      });
    }

    attachDesktopMouseDrag(wheelDay);
    attachDesktopMouseDrag(wheelMonth);
    attachDesktopMouseDrag(wheelYear);

    // Build preset chips
    presets.forEach((p) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'p-date-preset-chip';
      chip.dataset.days = String(p.days);
      chip.textContent = p.label;
      chip.addEventListener('click', () => {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - p.days);
        triggerHaptic('select');
        syncFromDateString(formatLocalIsoDate(d), true);
      });
      presetsList.appendChild(chip);
    });

    nativeDateInput.addEventListener('change', () => {
      if (!nativeDateInput.value) return;
      if (nativeDateInput.value > todayStr) {
        showToast('Ngày kỷ niệm không thể ở tương lai nhé', 'info');
        syncFromDateString(todayStr, true);
        return;
      }
      triggerHaptic('select');
      syncFromDateString(nativeDateInput.value, true);
    });

    const finishCtrl = createButton({
      label: 'Mở không gian hai đứa',
      variant: 'primary',
      size: 'lg',
      pill: true,
      block: true,
      leadingIcon: 'heart',
      onClick: () => void handleSubmit(finishCtrl, false),
    });

    const skipBtn = createButton({
      label: 'Thiết lập sau',
      variant: 'ghost',
      size: 'sm',
      pill: true,
      block: true,
      onClick: () => void handleSubmit(finishCtrl, true),
    });

    body.append(finishCtrl.element, skipBtn.element);

    renderStepShell(
      calEmblem,
      'Ngày bắt đầu yêu nhau',
      'Cuộn hoặc chạm vào ngày bất kỳ để đếm từng cột mốc kỷ niệm của hai đứa.',
      body,
    );

    // Sync immediately for instant render + re-align scrollTop after layout paint
    syncFromDateString(formData.loveStartDate, false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        wheelDay.scrollTop = selectedIndices.day * WHEEL_ITEM_HEIGHT;
        wheelMonth.scrollTop = selectedIndices.month * WHEEL_ITEM_HEIGHT;
        wheelYear.scrollTop = selectedIndices.year * WHEEL_ITEM_HEIGHT;
      });
    });
  }

  async function handleSubmit(btnCtrl: ReturnType<typeof createButton>, skipLoveDate: boolean): Promise<void> {
    btnCtrl.setLoading(true, 'Đang khởi tạo...');

    try {
      if (isLocalDevHostname() && !isGoogleUser && formData.otpCode === DEMO_OTP_PIN) {
        throw new ApiError('Demo', 'NETWORK_ERROR', 0);
      }
      const payload: Parameters<typeof startOnboarding>[0] = {
        deviceId,
        displayName: formData.displayName,
        partnerName: formData.partnerName,
        coupleCode: formData.coupleCode.toUpperCase(),
        loveStartDate: skipLoveDate ? undefined : formData.loveStartDate || undefined,
        email: !isGoogleUser && formData.email ? formData.email : undefined,
        password: !isGoogleUser && formData.password ? formData.password : undefined,
        otpCode: !isGoogleUser && formData.otpCode ? formData.otpCode : undefined,
      };

      const result = await startOnboarding(payload);
      store.set({
        token: result.token,
        user: result.user,
        couple: result.couple,
      });
      localStorage.setItem('lovecheck_token', result.token);
      showSuccessAndNavigate();
    } catch (err) {
      const canFallbackToLocalPreview =
        isLocalDevHostname()
        && err instanceof ApiError
        && err.code === 'NETWORK_ERROR';

      if (canFallbackToLocalPreview) {
        showToast('Chế độ xem thử Local: Đang mở trang chính...', 'info');
        const preview = seedMockPreviewData({
          displayName: formData.displayName,
          partnerName: formData.partnerName,
          coupleCode: formData.coupleCode,
          loveStartDate: skipLoveDate ? undefined : formData.loveStartDate,
          email: !isGoogleUser ? formData.email : undefined,
        });

        store.set({
          token: MOCK_PREVIEW_TOKEN,
          user: preview.user,
          couple: preview.couple,
        });
        localStorage.setItem('lovecheck_token', MOCK_PREVIEW_TOKEN);
        showSuccessAndNavigate();
        return;
      }

      btnCtrl.setLoading(false);
      const msg = err instanceof Error ? err.message : 'Không thể khởi tạo tài khoản. Vui lòng thử lại.';
      showToast(msg, 'error');

      if (err instanceof ApiError) {
        if (err.code === 'EMAIL_EXISTS' || err.code === 'COUPLE_FULL') {
          currentStep = 2;
          renderCurrentStep();
        } else if (err.code === 'INVALID_OTP') {
          currentStep = 3;
          renderCurrentStep();
        }
      }
    }
  }

  function clearOnboardingSessionKeys(): void {
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
  }

  function showSuccessAndNavigate(): void {
    clearOnboardingSessionKeys();

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
    sessionStorage.setItem('dev_onboarding_email', formData.email);
    sessionStorage.setItem('dev_onboarding_useAccount', String(formData.useAccount));

    switch (currentStep) {
      case 0:
        renderStep1();
        break;
      case 1:
        renderStep2();
        break;
      case 2:
        renderStep3();
        break;
      case 3:
        if (!isGoogleUser && !formData.emailVerified) renderStep4OTP();
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
