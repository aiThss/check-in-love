import { navigate } from '../router';
import {
  confirmPasswordReset,
  login,
  requestPasswordReset,
  sendLoginOtp,
} from '../api/auth';
import { store } from '../store/index';
import { showToast } from '../components/toast';

type LoginStep = 'credentials' | 'otp' | 'reset-email' | 'reset-password';

export function renderLoginPage(): HTMLElement {
  let step: LoginStep = 'credentials';
  let email = '';
  let password = '';
  let otpCode = '';
  let newPassword = '';
  let confirmPassword = '';
  let cooldown = 0;
  let cooldownTimer: ReturnType<typeof setInterval> | null = null;

  const root = document.createElement('div');
  root.className = 'page-no-nav login-page-pwa animate-fade-in';

  function render(): void {
    root.innerHTML = '';

    const shell = document.createElement('div');
    shell.className = 'auth-shell animate-slide-up';

    const isResetFlow = step === 'reset-email' || step === 'reset-password';
    const subtitle = (() => {
      switch (step) {
        case 'otp':
          return `Nhập mã 6 số được gửi tới ${escapeHtml(email)}.`;
        case 'reset-email':
          return 'Nhập email đã đăng ký để nhận mã đặt lại mật khẩu.';
        case 'reset-password':
          return `Nhập mã 6 số gửi tới ${escapeHtml(email)} và tạo mật khẩu mới.`;
        default:
          return 'Nhập email và mật khẩu để nhận mã xác thực.';
      }
    })();

    const header = document.createElement('div');
    header.className = 'auth-header';
    header.innerHTML = `
      <button class="btn-icon" id="back-btn" aria-label="Quay lại">←</button>
      <div>
        <div class="auth-emoji">${isResetFlow ? '🔐' : '💕'}</div>
        <h1 class="onboarding-title">${isResetFlow ? 'Quên mật khẩu' : 'Đăng nhập'}</h1>
        <p class="onboarding-subtitle">${subtitle}</p>
      </div>
      <span></span>
    `;

    shell.appendChild(header);

    switch (step) {
      case 'otp':
        shell.appendChild(renderOtpStep());
        break;
      case 'reset-email':
        shell.appendChild(renderResetEmailStep());
        break;
      case 'reset-password':
        shell.appendChild(renderResetPasswordStep());
        break;
      default:
        shell.appendChild(renderCredentialsStep());
    }

    root.appendChild(shell);

    root.querySelector('#back-btn')?.addEventListener('click', () => {
      if (step === 'otp') {
        step = 'credentials';
        otpCode = '';
        render();
        return;
      }
      if (step === 'reset-password') {
        step = 'reset-email';
        otpCode = '';
        newPassword = '';
        confirmPassword = '';
        render();
        return;
      }
      if (step === 'reset-email') {
        step = 'credentials';
        render();
        return;
      }
      navigate('/onboarding', true);
    });
  }

  function renderCredentialsStep(): HTMLElement {
    const form = document.createElement('div');
    form.className = 'auth-form';
    form.innerHTML = `
      <label class="input-group">
        <span class="input-label">Email</span>
        <input class="input" id="login-email" type="email" autocomplete="email" placeholder="Email đã đăng ký" value="${escapeHtml(email)}" />
      </label>
      <label class="input-group">
        <span class="input-label">Mật khẩu</span>
        <input class="input" id="login-password" type="password" autocomplete="current-password" placeholder="Mật khẩu" value="${escapeHtml(password)}" />
      </label>
      <button class="btn-ghost" id="forgot-password-btn">Quên mật khẩu?</button>
      <button class="btn-primary btn-primary-full" id="send-login-otp-btn">Gửi mã đăng nhập</button>
      <button class="btn-ghost" id="go-onboarding-btn">Tạo tài khoản mới</button>
    `;

    const emailInput = form.querySelector<HTMLInputElement>('#login-email')!;
    const passwordInput = form.querySelector<HTMLInputElement>('#login-password')!;
    const sendBtn = form.querySelector<HTMLButtonElement>('#send-login-otp-btn')!;

    const sync = () => {
      email = emailInput.value.trim();
      password = passwordInput.value;
    };

    emailInput.addEventListener('input', sync);
    passwordInput.addEventListener('input', sync);
    passwordInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') void handleSendLoginOtp(sendBtn);
    });
    sendBtn.addEventListener('click', () => void handleSendLoginOtp(sendBtn));
    form.querySelector('#forgot-password-btn')?.addEventListener('click', () => {
      sync();
      password = '';
      otpCode = '';
      step = 'reset-email';
      render();
    });
    form.querySelector('#go-onboarding-btn')?.addEventListener('click', () => {
      navigate('/onboarding', true);
    });

    requestAnimationFrame(() => emailInput.focus());
    return form;
  }

  function renderOtpStep(): HTMLElement {
    const form = document.createElement('div');
    form.className = 'auth-form';

    const loginBtn = document.createElement('button');
    loginBtn.className = 'btn-primary btn-primary-full';
    loginBtn.textContent = 'Đăng nhập';
    loginBtn.addEventListener('click', () => void handleLogin(loginBtn));

    const { wrapper, inputs } = createOtpInputs(() => void handleLogin(loginBtn));

    const resendBtn = document.createElement('button');
    resendBtn.className = 'btn-ghost';
    resendBtn.id = 'resend-login-otp-btn';
    resendBtn.textContent = cooldown > 0 ? `Gửi lại sau ${cooldown}s` : 'Gửi lại mã';
    resendBtn.disabled = cooldown > 0;
    resendBtn.addEventListener('click', () => void handleSendLoginOtp(resendBtn, true));

    form.appendChild(wrapper);
    form.appendChild(loginBtn);
    form.appendChild(resendBtn);

    requestAnimationFrame(() => inputs[0]?.focus());
    return form;
  }

  function renderResetEmailStep(): HTMLElement {
    const form = document.createElement('div');
    form.className = 'auth-form';
    form.innerHTML = `
      <label class="input-group">
        <span class="input-label">Email</span>
        <input class="input" id="reset-email" type="email" autocomplete="email" placeholder="Email đã đăng ký" value="${escapeHtml(email)}" />
      </label>
      <button class="btn-primary btn-primary-full" id="send-reset-otp-btn">Gửi mã đặt lại mật khẩu</button>
      <button class="btn-ghost" id="back-to-login-btn">Quay lại đăng nhập</button>
    `;

    const emailInput = form.querySelector<HTMLInputElement>('#reset-email')!;
    const sendBtn = form.querySelector<HTMLButtonElement>('#send-reset-otp-btn')!;

    const sync = () => {
      email = emailInput.value.trim();
    };

    emailInput.addEventListener('input', sync);
    emailInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') void handleSendResetOtp(sendBtn);
    });
    sendBtn.addEventListener('click', () => void handleSendResetOtp(sendBtn));
    form.querySelector('#back-to-login-btn')?.addEventListener('click', () => {
      sync();
      step = 'credentials';
      render();
    });

    requestAnimationFrame(() => emailInput.focus());
    return form;
  }

  function renderResetPasswordStep(): HTMLElement {
    const form = document.createElement('div');
    form.className = 'auth-form';

    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn-primary btn-primary-full';
    resetBtn.textContent = 'Đặt lại mật khẩu';
    resetBtn.addEventListener('click', () => void handleConfirmPasswordReset(resetBtn));

    const { wrapper, inputs } = createOtpInputs(() => void handleConfirmPasswordReset(resetBtn));
    form.appendChild(wrapper);

    const passwordFields = document.createElement('div');
    passwordFields.innerHTML = `
      <label class="input-group">
        <span class="input-label">Mật khẩu mới</span>
        <input class="input" id="new-password" type="password" autocomplete="new-password" placeholder="Tối thiểu 6 ký tự" value="${escapeHtml(newPassword)}" />
      </label>
      <label class="input-group">
        <span class="input-label">Nhập lại mật khẩu mới</span>
        <input class="input" id="confirm-password" type="password" autocomplete="new-password" placeholder="Nhập lại mật khẩu" value="${escapeHtml(confirmPassword)}" />
      </label>
    `;
    form.appendChild(passwordFields);
    form.appendChild(resetBtn);

    const resendBtn = document.createElement('button');
    resendBtn.className = 'btn-ghost';
    resendBtn.id = 'resend-reset-otp-btn';
    resendBtn.textContent = cooldown > 0 ? `Gửi lại sau ${cooldown}s` : 'Gửi lại mã';
    resendBtn.disabled = cooldown > 0;
    resendBtn.addEventListener('click', () => void handleSendResetOtp(resendBtn, true));
    form.appendChild(resendBtn);

    const newPasswordInput = form.querySelector<HTMLInputElement>('#new-password')!;
    const confirmPasswordInput = form.querySelector<HTMLInputElement>('#confirm-password')!;
    const syncPasswords = () => {
      newPassword = newPasswordInput.value;
      confirmPassword = confirmPasswordInput.value;
    };
    newPasswordInput.addEventListener('input', syncPasswords);
    confirmPasswordInput.addEventListener('input', syncPasswords);
    confirmPasswordInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') void handleConfirmPasswordReset(resetBtn);
    });

    requestAnimationFrame(() => inputs[0]?.focus());
    return form;
  }

  function createOtpInputs(onEnter: () => void): {
    wrapper: HTMLElement;
    inputs: HTMLInputElement[];
  } {
    const wrapper = document.createElement('div');
    wrapper.className = 'otp-input-row';
    const inputs: HTMLInputElement[] = [];

    for (let index = 0; index < 6; index++) {
      const input = document.createElement('input');
      input.className = 'otp-input';
      input.type = 'text';
      input.inputMode = 'numeric';
      input.maxLength = 1;
      input.value = otpCode[index] ?? '';
      input.setAttribute('aria-label', `Số ${index + 1}`);
      input.addEventListener('input', () => {
        input.value = input.value.replace(/\D/g, '').slice(-1);
        otpCode = inputs.map((box) => box.value).join('');
        if (input.value && index < 5) inputs[index + 1]?.focus();
      });
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Backspace' && !input.value && index > 0) {
          inputs[index - 1]?.focus();
        }
        if (event.key === 'Enter') onEnter();
      });
      input.addEventListener('paste', (event) => {
        event.preventDefault();
        const text = event.clipboardData?.getData('text').replace(/\D/g, '').slice(0, 6) ?? '';
        text.split('').forEach((char, pasteIndex) => {
          if (inputs[pasteIndex]) inputs[pasteIndex].value = char;
        });
        otpCode = inputs.map((box) => box.value).join('');
        inputs[Math.min(text.length, 5)]?.focus();
      });
      inputs.push(input);
      wrapper.appendChild(input);
    }

    return { wrapper, inputs };
  }

  async function handleSendLoginOtp(
    button: HTMLButtonElement,
    isResend = false,
  ): Promise<void> {
    if (!validateCredentials()) return;
    if (cooldown > 0) return;

    setButtonLoading(button, 'Đang gửi...');

    try {
      await sendLoginOtp(email, password);
      showToast(isResend ? 'Đã gửi lại mã đăng nhập' : 'Mã đăng nhập đã được gửi', 'success');
      step = 'otp';
      otpCode = '';
      startCooldown();
      render();
    } catch (err) {
      showToast(errorMessage(err, 'Không thể gửi mã đăng nhập'), 'error');
      button.disabled = false;
      button.textContent = isResend ? 'Gửi lại mã' : 'Gửi mã đăng nhập';
    }
  }

  async function handleSendResetOtp(
    button: HTMLButtonElement,
    isResend = false,
  ): Promise<void> {
    if (!validateEmail()) return;
    if (cooldown > 0) return;

    setButtonLoading(button, 'Đang gửi...');

    try {
      await requestPasswordReset(email);
      showToast(
        isResend
          ? 'Đã gửi lại mã đặt lại mật khẩu'
          : 'Nếu email đã đăng ký, mã đặt lại mật khẩu đã được gửi',
        'success',
      );
      step = 'reset-password';
      otpCode = '';
      startCooldown();
      render();
    } catch (err) {
      showToast(errorMessage(err, 'Không thể gửi mã đặt lại mật khẩu'), 'error');
      button.disabled = false;
      button.textContent = isResend ? 'Gửi lại mã' : 'Gửi mã đặt lại mật khẩu';
    }
  }

  async function handleLogin(button: HTMLButtonElement): Promise<void> {
    otpCode = otpCode.replace(/\D/g, '');
    if (otpCode.length !== 6) {
      showToast('Vui lòng nhập đủ 6 số', 'error');
      return;
    }

    setButtonLoading(button, 'Đang đăng nhập...');

    try {
      const result = await login({ email, password, otpCode });
      store.set({
        token: result.token,
        user: result.user,
        couple: result.couple,
      });
      localStorage.setItem('lovecheck_token', result.token);
      showToast('Đăng nhập thành công', 'success');
      navigate('/app/home', true);
    } catch (err) {
      showToast(errorMessage(err, 'Đăng nhập thất bại'), 'error');
      button.disabled = false;
      button.textContent = 'Đăng nhập';
    }
  }

  async function handleConfirmPasswordReset(button: HTMLButtonElement): Promise<void> {
    otpCode = otpCode.replace(/\D/g, '');
    if (otpCode.length !== 6) {
      showToast('Vui lòng nhập đủ 6 số', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast('Mật khẩu mới phải có ít nhất 6 ký tự', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Mật khẩu nhập lại chưa khớp', 'error');
      return;
    }

    setButtonLoading(button, 'Đang cập nhật...');

    try {
      await confirmPasswordReset(email, otpCode, newPassword);
      showToast('Đặt lại mật khẩu thành công', 'success');
      password = '';
      otpCode = '';
      newPassword = '';
      confirmPassword = '';
      stopCooldown();
      step = 'credentials';
      render();
    } catch (err) {
      showToast(errorMessage(err, 'Không thể đặt lại mật khẩu'), 'error');
      button.disabled = false;
      button.textContent = 'Đặt lại mật khẩu';
    }
  }

  function validateEmail(): boolean {
    if (!email) {
      showToast('Vui lòng nhập email', 'error');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('Email không hợp lệ', 'error');
      return false;
    }
    return true;
  }

  function validateCredentials(): boolean {
    if (!validateEmail()) return false;
    if (!password) {
      showToast('Vui lòng nhập mật khẩu', 'error');
      return false;
    }
    return true;
  }

  function setButtonLoading(button: HTMLButtonElement, label: string): void {
    button.disabled = true;
    button.innerHTML = `<span class="spinner" style="width:18px;height:18px;border-width:2px"></span> ${label}`;
  }

  function startCooldown(): void {
    cooldown = 60;
    if (cooldownTimer) clearInterval(cooldownTimer);
    cooldownTimer = setInterval(() => {
      cooldown = Math.max(0, cooldown - 1);
      updateCooldownButton('#resend-login-otp-btn');
      updateCooldownButton('#resend-reset-otp-btn');
      if (cooldown === 0) stopCooldown();
    }, 1000);
  }

  function updateCooldownButton(selector: string): void {
    const button = root.querySelector<HTMLButtonElement>(selector);
    if (!button) return;
    button.disabled = cooldown > 0;
    button.textContent = cooldown > 0 ? `Gửi lại sau ${cooldown}s` : 'Gửi lại mã';
  }

  function stopCooldown(): void {
    if (cooldownTimer) clearInterval(cooldownTimer);
    cooldownTimer = null;
    cooldown = 0;
  }

  render();
  return root;
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
