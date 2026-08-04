import {
  loginWithGoogle,
  sendLoginOtp,
  login,
  requestPasswordReset,
  confirmPasswordReset,
} from '../api/auth';
import { showToast } from '../components/toast';
import { navigate } from '../router';
import { store } from '../store/index';

declare const __GOOGLE_CLIENT_ID__: string;

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleIdConfiguration {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  cancel_on_tap_outside?: boolean;
}

interface GoogleButtonOptions {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  width?: number;
  logo_alignment?: 'left' | 'center';
}

interface GoogleIdentityServices {
  initialize(configuration: GoogleIdConfiguration): void;
  renderButton(parent: HTMLElement, options: GoogleButtonOptions): void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleIdentityServices;
      };
    };
  }
}

const GOOGLE_CLIENT_ID =
  typeof __GOOGLE_CLIENT_ID__ !== 'undefined' ? __GOOGLE_CLIENT_ID__ : '';
const GOOGLE_SDK_URL = 'https://accounts.google.com/gsi/client';
const GOOGLE_SDK_MAX_ATTEMPTS = 3;
let googleSdkPromise: Promise<void> | null = null;

export function renderLoginPage(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'page-no-nav login-page-pwa animate-fade-in';

  // Floating ambient background elements
  const bgGlow = document.createElement('div');
  bgGlow.className = 'login-ambient-glow';
  bgGlow.innerHTML = `
    <div class="glow-orb orb-1"></div>
    <div class="glow-orb orb-2"></div>
  `;
  root.appendChild(bgGlow);

  const shell = document.createElement('div');
  shell.className = 'auth-shell animate-slide-up';

  const header = document.createElement('div');
  header.className = 'auth-header';
  header.innerHTML = `
    <button class="btn-icon auth-back-btn" id="back-btn" aria-label="Quay lại">←</button>
    <div class="auth-brand-center">
      <div class="auth-emoji pulse-heart">💕</div>
      <h1 class="onboarding-title">Đăng nhập</h1>
      <p class="onboarding-subtitle">Mừng bạn trở về nhà</p>
    </div>
    <span class="auth-header-spacer"></span>
  `;

  // Auth Tabs Container
  const tabsWrap = document.createElement('div');
  tabsWrap.className = 'auth-tabs-wrap';
  tabsWrap.innerHTML = `
    <div class="auth-tab-pill active" id="tab-email-btn" role="tab" aria-selected="true">
      <span class="tab-icon">✉️</span> Email & OTP
    </div>
    <div class="auth-tab-pill" id="tab-google-btn" role="tab" aria-selected="false">
      <span class="tab-icon">🌐</span> Google
    </div>
  `;

  // Form Shell Card
  const formCard = document.createElement('div');
  formCard.className = 'auth-form-card glass-card';

  // --- TAB 1: Email Login Panel ---
  const emailPanel = document.createElement('div');
  emailPanel.className = 'auth-tab-panel active';
  emailPanel.id = 'panel-email';

  emailPanel.innerHTML = `
    <!-- Step 1: Input Credentials -->
    <form id="email-login-form" class="auth-step-form">
      <div class="form-group-v2">
        <label class="form-label-v2" for="user-email">Địa chỉ Email</label>
        <div class="input-icon-wrapper">
          <span class="input-icon">📧</span>
          <input type="email" id="user-email" class="input input-with-icon" placeholder="nhapemail@gmail.com" required autocomplete="email" />
        </div>
      </div>

      <div class="form-group-v2">
        <div class="form-label-row">
          <label class="form-label-v2" for="user-password">Mật khẩu</label>
          <button type="button" class="link-btn-sm" id="forgot-password-link">Quên mật khẩu?</button>
        </div>
        <div class="input-icon-wrapper">
          <span class="input-icon">🔒</span>
          <input type="password" id="user-password" class="input input-with-icon" placeholder="••••••••" required autocomplete="current-password" />
          <button type="button" class="password-toggle-btn" id="toggle-pwd-btn" aria-label="Hiện mật khẩu">👁️</button>
        </div>
      </div>

      <button type="submit" class="btn-primary btn-full btn-glow" id="send-otp-btn">
        <span>Gửi mã OTP xác thực</span>
        <span class="btn-arrow">→</span>
      </button>
    </form>

    <!-- Step 2: Enter OTP (Hidden by default) -->
    <form id="otp-verify-form" class="auth-step-form hidden-step">
      <div class="otp-info-banner">
        <div class="otp-banner-icon">📩</div>
        <div class="otp-banner-text">
          <span>Mã OTP 6 chữ số đã được gửi tới</span>
          <strong id="otp-sent-target">email của bạn</strong>
        </div>
      </div>

      <div class="form-group-v2">
        <label class="form-label-v2">Mã xác thực OTP</label>
        <div class="otp-pin-container" id="otp-pin-boxes">
          <input type="text" maxlength="1" class="otp-box" data-index="0" inputmode="numeric" pattern="[0-9]*" />
          <input type="text" maxlength="1" class="otp-box" data-index="1" inputmode="numeric" pattern="[0-9]*" />
          <input type="text" maxlength="1" class="otp-box" data-index="2" inputmode="numeric" pattern="[0-9]*" />
          <input type="text" maxlength="1" class="otp-box" data-index="3" inputmode="numeric" pattern="[0-9]*" />
          <input type="text" maxlength="1" class="otp-box" data-index="4" inputmode="numeric" pattern="[0-9]*" />
          <input type="text" maxlength="1" class="otp-box" data-index="5" inputmode="numeric" pattern="[0-9]*" />
        </div>
      </div>

      <div class="otp-resend-row">
        <span id="otp-timer-text">Gửi lại mã sau <strong id="timer-sec">60</strong>s</span>
        <button type="button" class="link-btn-sm hidden-resend" id="resend-otp-btn">Gửi lại mã ngay</button>
      </div>

      <button type="submit" class="btn-primary btn-full btn-glow" id="final-login-btn">
        <span>Đăng nhập ngay</span>
      </button>

      <button type="button" class="btn-ghost-sm btn-full" id="back-to-step1-btn">
        ← Nhập lại Email / Mật khẩu
      </button>
    </form>
  `;

  // --- TAB 2: Google Login Panel ---
  const googlePanel = document.createElement('div');
  googlePanel.className = 'auth-tab-panel';
  googlePanel.id = 'panel-google';

  googlePanel.innerHTML = `
    <div class="google-login-card-inner">
      <div class="google-login-intro-v2">
        <div class="google-g-badge">G</div>
        <div class="google-intro-content">
          <strong>Đăng nhập bằng Google</strong>
          <span>Xác thực chuẩn Google.</span>
        </div>
      </div>

      <div class="google-button-wrap-v2" id="google-button-wrap" aria-live="polite">
        <div id="google-signin-button"></div>
        <p class="google-login-status" id="google-login-status">Đang tải nút đăng nhập Google…</p>
      </div>
    </div>
  `;

  formCard.appendChild(emailPanel);
  formCard.appendChild(googlePanel);

  // Footer Navigation & Register Action
  const footerAction = document.createElement('div');
  footerAction.className = 'auth-footer-action';
  footerAction.innerHTML = `
    <div class="auth-divider"><span>hoặc</span></div>
    <button class="btn-ghost btn-full" id="go-onboarding-btn">✨ Tạo tài khoản Couple mới</button>
  `;

  shell.appendChild(header);
  shell.appendChild(tabsWrap);
  shell.appendChild(formCard);
  shell.appendChild(footerAction);
  root.appendChild(shell);

  // --- Reset Password Modal ---
  const resetModal = createResetPasswordModal();
  root.appendChild(resetModal);

  // Event Listeners
  root.querySelector('#back-btn')?.addEventListener('click', () => navigate('/onboarding', true));
  root.querySelector('#go-onboarding-btn')?.addEventListener('click', () => navigate('/onboarding', true));
  root.querySelector('#forgot-password-link')?.addEventListener('click', () => openResetModal(resetModal));

  // Tab Switching Logic
  const tabEmail = tabsWrap.querySelector('#tab-email-btn')!;
  const tabGoogle = tabsWrap.querySelector('#tab-google-btn')!;

  const switchTab = (activeTab: 'email' | 'google') => {
    sessionStorage.setItem('dev_login_tab', activeTab);
    if (activeTab === 'email') {
      tabEmail.classList.add('active');
      tabEmail.setAttribute('aria-selected', 'true');
      tabGoogle.classList.remove('active');
      tabGoogle.setAttribute('aria-selected', 'false');
      emailPanel.classList.add('active');
      googlePanel.classList.remove('active');
    } else {
      tabGoogle.classList.add('active');
      tabGoogle.setAttribute('aria-selected', 'true');
      tabEmail.classList.remove('active');
      tabEmail.setAttribute('aria-selected', 'false');
      googlePanel.classList.add('active');
      emailPanel.classList.remove('active');
    }
  };

  tabEmail.addEventListener('click', () => switchTab('email'));
  tabGoogle.addEventListener('click', () => switchTab('google'));

  // Restore saved login tab on load
  const savedLoginTab = sessionStorage.getItem('dev_login_tab') as 'email' | 'google' | null;
  if (savedLoginTab) switchTab(savedLoginTab);

  // Email Step 1 Form Handler
  const emailForm = emailPanel.querySelector<HTMLFormElement>('#email-login-form')!;
  const otpForm = emailPanel.querySelector<HTMLFormElement>('#otp-verify-form')!;
  const emailInput = emailPanel.querySelector<HTMLInputElement>('#user-email')!;
  const passwordInput = emailPanel.querySelector<HTMLInputElement>('#user-password')!;
  const sendOtpBtn = emailPanel.querySelector<HTMLButtonElement>('#send-otp-btn')!;
  const togglePwdBtn = emailPanel.querySelector<HTMLButtonElement>('#toggle-pwd-btn')!;
  const backToStep1Btn = emailPanel.querySelector<HTMLButtonElement>('#back-to-step1-btn')!;
  const otpSentTarget = emailPanel.querySelector<HTMLElement>('#otp-sent-target')!;
  const resendOtpBtn = emailPanel.querySelector<HTMLButtonElement>('#resend-otp-btn')!;
  const timerSec = emailPanel.querySelector<HTMLElement>('#timer-sec')!;
  const timerText = emailPanel.querySelector<HTMLElement>('#otp-timer-text')!;

  let passwordVisible = false;
  togglePwdBtn.addEventListener('click', () => {
    passwordVisible = !passwordVisible;
    passwordInput.type = passwordVisible ? 'text' : 'password';
    togglePwdBtn.textContent = passwordVisible ? '🙈' : '👁️';
  });

  let resendTimer: number | null = null;

  const startCountdown = () => {
    let secondsLeft = 60;
    timerText.style.display = 'inline';
    resendOtpBtn.style.display = 'none';
    if (timerSec) timerSec.textContent = '60';

    if (resendTimer) clearInterval(resendTimer);
    resendTimer = window.setInterval(() => {
      secondsLeft -= 1;
      if (timerSec) timerSec.textContent = String(secondsLeft);
      if (secondsLeft <= 0) {
        if (resendTimer) clearInterval(resendTimer);
        timerText.style.display = 'none';
        resendOtpBtn.style.display = 'inline-block';
      }
    }, 1000);
  };

  emailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showToast('Vui lòng nhập đầy đủ Email và Mật khẩu', 'error');
      return;
    }

    sendOtpBtn.disabled = true;
    sendOtpBtn.innerHTML = '<span class="spinner"></span> Đang gửi mã OTP…';

    try {
      await sendLoginOtp(email, password);
      showToast(`Mã OTP đã được gửi tới ${email}`, 'success');
      otpSentTarget.textContent = email;

      // Switch to Step 2
      emailForm.classList.add('hidden-step');
      otpForm.classList.remove('hidden-step');

      startCountdown();

      // Focus first OTP box
      const firstOtpBox = otpForm.querySelector<HTMLInputElement>('.otp-box')!;
      firstOtpBox.focus();
    } catch (err) {
      showToast(errorMessage(err, 'Không thể gửi OTP. Kiểm tra thông tin đăng nhập!'), 'error');
    } finally {
      sendOtpBtn.disabled = false;
      sendOtpBtn.innerHTML = '<span>Gửi mã OTP xác thực</span> <span class="btn-arrow">→</span>';
    }
  });

  // OTP Boxes input behavior
  const otpBoxes = Array.from(otpForm.querySelectorAll<HTMLInputElement>('.otp-box'));

  otpBoxes.forEach((box, idx) => {
    box.addEventListener('input', () => {
      const val = box.value;
      if (val.length === 1 && idx < otpBoxes.length - 1) {
        otpBoxes[idx + 1].focus();
      }
    });

    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && idx > 0) {
        otpBoxes[idx - 1].focus();
      }
    });

    box.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = e.clipboardData?.getData('text').trim() || '';
      if (/^\d{6}$/.test(pasted)) {
        pasted.split('').forEach((ch, i) => {
          if (otpBoxes[i]) otpBoxes[i].value = ch;
        });
        otpBoxes[5].focus();
      }
    });
  });

  backToStep1Btn.addEventListener('click', () => {
    otpForm.classList.add('hidden-step');
    emailForm.classList.remove('hidden-step');
    if (resendTimer) clearInterval(resendTimer);
  });

  resendOtpBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    resendOtpBtn.disabled = true;
    resendOtpBtn.textContent = 'Đang gửi lại…';
    try {
      await sendLoginOtp(email, password);
      showToast('Đã gửi lại mã OTP mới!', 'success');
      startCountdown();
    } catch (err) {
      showToast(errorMessage(err, 'Lỗi khi gửi lại mã OTP'), 'error');
    } finally {
      resendOtpBtn.disabled = false;
      resendOtpBtn.textContent = 'Gửi lại mã ngay';
    }
  });

  // Final Login Submission
  otpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const otpCode = otpBoxes.map((b) => b.value).join('');

    if (otpCode.length !== 6) {
      showToast('Vui lòng nhập đủ 6 số OTP', 'error');
      return;
    }

    const finalLoginBtn = otpForm.querySelector<HTMLButtonElement>('#final-login-btn')!;
    finalLoginBtn.disabled = true;
    finalLoginBtn.innerHTML = '<span class="spinner"></span> Đang xác thực…';

    try {
      const result = await login({ email, password, otpCode });
      store.set({
        token: result.token,
        user: result.user,
        couple: result.couple,
      });
      localStorage.setItem('lovecheck_token', result.token);
      showToast('Đăng nhập thành công! 🎉', 'success');
      navigate('/app/home', true);
    } catch (err) {
      showToast(errorMessage(err, 'Đăng nhập thất bại. Mã OTP không đúng hoặc hết hạn!'), 'error');
    } finally {
      finalLoginBtn.disabled = false;
      finalLoginBtn.innerHTML = '<span>Đăng nhập ngay</span>';
    }
  });

  // Mount Google Sign-in Button
  const googleWrap = googlePanel.querySelector<HTMLElement>('#google-button-wrap')!;
  const googleMount = googlePanel.querySelector<HTMLElement>('#google-signin-button')!;
  const googleStatus = googlePanel.querySelector<HTMLElement>('#google-login-status')!;

  mountGoogleSignInButton(googleMount, googleStatus, (credential) => {
    void handleGoogleLogin(credential, googleWrap, googleStatus);
  });

  return root;
}

function loadGoogleSdkScript(): Promise<void> {
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  if (googleSdkPromise) {
    return googleSdkPromise;
  }

  googleSdkPromise = new Promise<void>((resolve, reject) => {
    let attempts = 0;

    const load = (): void => {
      if (window.google?.accounts?.id) {
        resolve();
        return;
      }

      attempts += 1;
      const script = document.createElement('script');
      script.id = 'google-gsi-script';
      script.src = GOOGLE_SDK_URL;
      script.async = true;
      script.defer = true;

      const retryOrReject = (): void => {
        script.remove();
        if (attempts >= GOOGLE_SDK_MAX_ATTEMPTS) {
          reject(new Error('Google Identity Services SDK failed to load'));
          return;
        }
        window.setTimeout(load, attempts * 500);
      };

      script.onload = () => {
        if (window.google?.accounts?.id) {
          resolve();
        } else {
          retryOrReject();
        }
      };
      script.onerror = retryOrReject;
      document.head.appendChild(script);
    };

    load();
  });

  googleSdkPromise = googleSdkPromise.catch((error: unknown) => {
    googleSdkPromise = null;
    throw error;
  });

  return googleSdkPromise;
}

function mountGoogleSignInButton(
  mount: HTMLElement,
  status: HTMLElement,
  onCredential: (credential: string) => void,
): void {
  if (!GOOGLE_CLIENT_ID) {
    status.textContent = 'Đăng nhập Google chưa được cấu hình cho môi trường này.';
    return;
  }

  status.textContent = 'Đang kết nối Google Identity…';

  void loadGoogleSdkScript()
    .then(() => {
      const googleId = window.google?.accounts?.id;
      if (!googleId) {
        throw new Error('Google Identity Services SDK loaded without the identity API');
      }

      googleId.initialize({
        client_id: GOOGLE_CLIENT_ID,
        cancel_on_tap_outside: true,
        callback: (response) => onCredential(response.credential),
      });
      googleId.renderButton(mount, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        width: 320,
        logo_alignment: 'left',
      });
      status.textContent = 'Google sẽ xác thực an toàn tài khoản của bạn.';
    })
    .catch((error: unknown) => {
      console.error('[Google Sign-In] Failed to load or initialize Google Identity Services', error);
      status.innerHTML = 'Không thể tải đăng nhập Google.<br>Vui lòng kiểm tra kết nối mạng.';
    });
}

async function handleGoogleLogin(
  credential: string,
  buttonWrap: HTMLElement,
  status: HTMLElement,
): Promise<void> {
  buttonWrap.style.pointerEvents = 'none';
  buttonWrap.setAttribute('aria-busy', 'true');
  status.textContent = 'Đang xác thực tài khoản Google…';

  try {
    const result = await loginWithGoogle({ credential });
    store.set({
      token: result.token,
      user: result.user,
      couple: result.couple,
    });
    localStorage.setItem('lovecheck_token', result.token);
    showToast('Đăng nhập Google thành công! 🎉', 'success');
    navigate('/app/home', true);
  } catch (err) {
    buttonWrap.style.pointerEvents = '';
    buttonWrap.removeAttribute('aria-busy');
    status.textContent = 'Google sẽ xác thực an toàn tài khoản của bạn.';
    showToast(errorMessage(err, 'Đăng nhập Google thất bại'), 'error');
  }
}

// Forgot Password Modal Component
function createResetPasswordModal(): HTMLElement {
  const backdrop = document.createElement('div');
  backdrop.className = 'auth-modal-backdrop hidden-modal';
  backdrop.id = 'reset-password-modal';

  backdrop.innerHTML = `
    <div class="auth-modal-card glass-card">
      <button class="auth-modal-close" id="close-modal-btn">✕</button>
      <h2 class="auth-modal-title">Khôi phục Mật khẩu</h2>
      <p class="auth-modal-subtitle">Nhập email để nhận mã xác thực đặt lại mật khẩu mới.</p>

      <!-- Modal Step 1 -->
      <form id="reset-step1-form" class="auth-step-form">
        <div class="form-group-v2">
          <label class="form-label-v2" for="reset-email">Email tài khoản</label>
          <div class="input-icon-wrapper">
            <span class="input-icon">📧</span>
            <input type="email" id="reset-email" class="input input-with-icon" placeholder="nhapemail@gmail.com" required />
          </div>
        </div>
        <button type="submit" class="btn-primary btn-full" id="reset-send-otp-btn">Gửi mã xác thực</button>
      </form>

      <!-- Modal Step 2 -->
      <form id="reset-step2-form" class="auth-step-form hidden-step">
        <div class="form-group-v2">
          <label class="form-label-v2" for="reset-otp">Mã OTP (6 chữ số)</label>
          <input type="text" id="reset-otp" class="input" placeholder="123456" maxlength="6" pattern="[0-9]*" inputmode="numeric" required />
        </div>
        <div class="form-group-v2">
          <label class="form-label-v2" for="reset-new-pwd">Mật khẩu mới</label>
          <input type="password" id="reset-new-pwd" class="input" placeholder="Mật khẩu mới (tối thiểu 6 ký tự)" minlength="6" required />
        </div>
        <button type="submit" class="btn-primary btn-full" id="reset-confirm-btn">Đổi mật khẩu & Đăng nhập</button>
      </form>
    </div>
  `;

  backdrop.querySelector('#close-modal-btn')?.addEventListener('click', () => closeResetModal(backdrop));
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeResetModal(backdrop);
  });

  const step1Form = backdrop.querySelector<HTMLFormElement>('#reset-step1-form')!;
  const step2Form = backdrop.querySelector<HTMLFormElement>('#reset-step2-form')!;
  const resetEmailInput = backdrop.querySelector<HTMLInputElement>('#reset-email')!;
  const resetOtpInput = backdrop.querySelector<HTMLInputElement>('#reset-otp')!;
  const resetNewPwdInput = backdrop.querySelector<HTMLInputElement>('#reset-new-pwd')!;

  step1Form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = resetEmailInput.value.trim();
    if (!email) return;

    const btn = backdrop.querySelector<HTMLButtonElement>('#reset-send-otp-btn')!;
    btn.disabled = true;
    btn.textContent = 'Đang gửi mã…';

    try {
      await requestPasswordReset(email);
      showToast(`Mã khôi phục đã được gửi tới ${email}`, 'success');
      step1Form.classList.add('hidden-step');
      step2Form.classList.remove('hidden-step');
    } catch (err) {
      showToast(errorMessage(err, 'Không thể gửi mã khôi phục!'), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Gửi mã xác thực';
    }
  });

  step2Form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = resetEmailInput.value.trim();
    const otp = resetOtpInput.value.trim();
    const newPwd = resetNewPwdInput.value;

    if (!email || !otp || !newPwd) return;

    const btn = backdrop.querySelector<HTMLButtonElement>('#reset-confirm-btn')!;
    btn.disabled = true;
    btn.textContent = 'Đang cập nhật…';

    try {
      await confirmPasswordReset(email, otp, newPwd);
      showToast('Đã đổi mật khẩu thành công! Vui lòng đăng nhập lại.', 'success');
      closeResetModal(backdrop);
    } catch (err) {
      showToast(errorMessage(err, 'Đổi mật khẩu thất bại. Kiểm tra lại mã OTP!'), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Đổi mật khẩu & Đăng nhập';
    }
  });

  return backdrop;
}

function openResetModal(modal: HTMLElement): void {
  modal.classList.remove('hidden-modal');
}

function closeResetModal(modal: HTMLElement): void {
  modal.classList.add('hidden-modal');
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
