import { navigate } from '../router';
import { login, sendLoginOtp } from '../api/auth';
import { store } from '../store/index';
import { showToast } from '../components/toast';

type LoginStep = 'credentials' | 'otp';

export function renderLoginPage(): HTMLElement {
  let step: LoginStep = 'credentials';
  let email = '';
  let password = '';
  let otpCode = '';
  let cooldown = 0;
  let cooldownTimer: ReturnType<typeof setInterval> | null = null;

  const root = document.createElement('div');
  root.className = 'page-no-nav login-page-pwa animate-fade-in';

  function render(): void {
    root.innerHTML = '';

    const shell = document.createElement('div');
    shell.className = 'auth-shell animate-slide-up';

    const header = document.createElement('div');
    header.className = 'auth-header';
    header.innerHTML = `
      <button class="btn-icon" id="back-btn" aria-label="Quay lại">←</button>
      <div>
        <div class="auth-emoji">💕</div>
        <h1 class="onboarding-title">Đăng nhập</h1>
        <p class="onboarding-subtitle">
          ${step === 'credentials'
            ? 'Nhập email và mật khẩu để nhận mã xác thực.'
            : `Nhập mã 6 số được gửi tới ${escapeHtml(email)}.`}
        </p>
      </div>
      <span></span>
    `;

    shell.appendChild(header);

    if (step === 'credentials') {
      shell.appendChild(renderCredentialsStep());
    } else {
      shell.appendChild(renderOtpStep());
    }

    root.appendChild(shell);

    root.querySelector('#back-btn')?.addEventListener('click', () => {
      if (step === 'otp') {
        step = 'credentials';
        otpCode = '';
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
    passwordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') void handleSendOtp(sendBtn);
    });
    sendBtn.addEventListener('click', () => void handleSendOtp(sendBtn));
    form.querySelector('#go-onboarding-btn')?.addEventListener('click', () => {
      navigate('/onboarding', true);
    });

    requestAnimationFrame(() => emailInput.focus());
    return form;
  }

  function renderOtpStep(): HTMLElement {
    const form = document.createElement('div');
    form.className = 'auth-form';

    const otpWrapper = document.createElement('div');
    otpWrapper.className = 'otp-input-row';
    const inputs: HTMLInputElement[] = [];

    for (let i = 0; i < 6; i++) {
      const input = document.createElement('input');
      input.className = 'otp-input';
      input.type = 'text';
      input.inputMode = 'numeric';
      input.maxLength = 1;
      input.value = otpCode[i] ?? '';
      input.setAttribute('aria-label', `Số ${i + 1}`);
      input.addEventListener('input', () => {
        input.value = input.value.replace(/\D/g, '').slice(-1);
        otpCode = inputs.map((box) => box.value).join('');
        if (input.value && i < 5) inputs[i + 1]?.focus();
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && i > 0) {
          inputs[i - 1]?.focus();
        }
        if (e.key === 'Enter') {
          void handleLogin(loginBtn);
        }
      });
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = e.clipboardData?.getData('text').replace(/\D/g, '').slice(0, 6) ?? '';
        text.split('').forEach((char, idx) => {
          if (inputs[idx]) inputs[idx].value = char;
        });
        otpCode = inputs.map((box) => box.value).join('');
        inputs[Math.min(text.length, 5)]?.focus();
      });
      inputs.push(input);
      otpWrapper.appendChild(input);
    }

    const loginBtn = document.createElement('button');
    loginBtn.className = 'btn-primary btn-primary-full';
    loginBtn.textContent = 'Đăng nhập';
    loginBtn.addEventListener('click', () => void handleLogin(loginBtn));

    const resendBtn = document.createElement('button');
    resendBtn.className = 'btn-ghost';
    resendBtn.id = 'resend-login-otp-btn';
    resendBtn.textContent = cooldown > 0 ? `Gửi lại sau ${cooldown}s` : 'Gửi lại mã';
    resendBtn.disabled = cooldown > 0;
    resendBtn.addEventListener('click', () => void handleSendOtp(resendBtn, true));

    form.appendChild(otpWrapper);
    form.appendChild(loginBtn);
    form.appendChild(resendBtn);

    requestAnimationFrame(() => inputs[0]?.focus());
    return form;
  }

  async function handleSendOtp(button: HTMLButtonElement, isResend = false): Promise<void> {
    if (!validateCredentials()) return;
    if (cooldown > 0) return;

    button.disabled = true;
    button.innerHTML = `<span class="spinner" style="width:18px;height:18px;border-width:2px"></span> Đang gửi...`;

    try {
      await sendLoginOtp(email, password);
      showToast(isResend ? 'Đã gửi lại mã đăng nhập' : 'Mã đăng nhập đã được gửi', 'success');
      step = 'otp';
      startCooldown();
      render();
    } catch (err) {
      showToast(errorMessage(err, 'Không thể gửi mã đăng nhập'), 'error');
      button.disabled = false;
      button.textContent = isResend ? 'Gửi lại mã' : 'Gửi mã đăng nhập';
    }
  }

  async function handleLogin(button: HTMLButtonElement): Promise<void> {
    otpCode = otpCode.replace(/\D/g, '');
    if (otpCode.length !== 6) {
      showToast('Vui lòng nhập đủ 6 số', 'error');
      return;
    }

    button.disabled = true;
    button.innerHTML = `<span class="spinner" style="width:18px;height:18px;border-width:2px"></span> Đang đăng nhập...`;

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

  function validateCredentials(): boolean {
    if (!email) {
      showToast('Vui lòng nhập email', 'error');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('Email không hợp lệ', 'error');
      return false;
    }
    if (!password) {
      showToast('Vui lòng nhập mật khẩu', 'error');
      return false;
    }
    return true;
  }

  function startCooldown(): void {
    cooldown = 60;
    if (cooldownTimer) clearInterval(cooldownTimer);
    cooldownTimer = setInterval(() => {
      cooldown = Math.max(0, cooldown - 1);
      const resendBtn = root.querySelector<HTMLButtonElement>('#resend-login-otp-btn');
      if (resendBtn) {
        resendBtn.disabled = cooldown > 0;
        resendBtn.textContent = cooldown > 0 ? `Gửi lại sau ${cooldown}s` : 'Gửi lại mã';
      }
      if (cooldown === 0 && cooldownTimer) {
        clearInterval(cooldownTimer);
        cooldownTimer = null;
      }
    }, 1000);
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
