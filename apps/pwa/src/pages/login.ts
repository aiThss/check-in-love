import '../styles/20-pages/auth.css';
import {
  loginWithGoogle,
  sendLoginOtp,
  login,
  requestPasswordReset,
  confirmPasswordReset,
} from '../api/auth';
import { showToast } from '../components/toast';
import { createThemeToggleButton } from '../components/theme-toggle';
import { navigate } from '../router';
import { store } from '../store/index';
import { iconMarkup } from '../ui/icons/icons';
import { createIconButton } from '../ui/primitives';
import { triggerHaptic } from '../ui/haptics';
import { mountGoogleSignInButton } from '../ui/google-signin';

export function renderLoginPage(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'page-no-nav login-page-pwa p-auth animate-fade-in';

  // Top Bar
  const topBar = document.createElement('header');
  topBar.className = 'p-auth-topbar';
  const backBtn = createIconButton({
    icon: 'back',
    ariaLabel: 'Quay lại',
    onClick: () => navigate('/onboarding', true),
  });
  backBtn.id = 'back-btn';
  const spacer = document.createElement('div');
  const rightWrap = document.createElement('div');
  rightWrap.style.justifySelf = 'end';
  rightWrap.appendChild(createThemeToggleButton());
  topBar.append(backBtn, spacer, rightWrap);
  root.appendChild(topBar);

  // Main Body
  const main = document.createElement('main');
  main.style.cssText = 'display:flex;flex-direction:column;gap:16px;my:auto;';

  const hero = document.createElement('div');
  hero.className = 'p-auth-hero';
  hero.innerHTML = `
    <div class="p-auth-emblem">${iconMarkup('couple', { size: 32, variant: 'filled' })}</div>
    <h1 class="p-auth-title">Mừng bạn trở về</h1>
    <p class="p-auth-sub">Đăng nhập để tiếp tục lưu giữ từng khoảnh khắc bên người thương</p>
  `;
  main.appendChild(hero);

  // Auth Tabs
  const tabsWrap = document.createElement('div');
  tabsWrap.className = 'p-auth-tabs';
  tabsWrap.setAttribute('role', 'tablist');
  tabsWrap.innerHTML = `
    <button type="button" class="p-auth-tab active" id="tab-email-btn" role="tab" aria-selected="true">
      ${iconMarkup('mail', { size: 16 })}<span>Email & OTP</span>
    </button>
    <button type="button" class="p-auth-tab" id="tab-google-btn" role="tab" aria-selected="false">
      ${iconMarkup('google', { size: 16 })}<span>Google</span>
    </button>
  `;
  main.appendChild(tabsWrap);

  // Form Sticker Card
  const formCard = document.createElement('div');
  formCard.className = 'p-auth-card u-grain-surface';

  const emailPanel = document.createElement('div');
  emailPanel.className = 'p-auth-panel active';
  emailPanel.id = 'panel-email';
  emailPanel.innerHTML = `
    <form id="email-login-form" class="p-auth-step">
      <div>
        <label class="c-field__label" for="user-email">Địa chỉ Email</label>
        <div class="p-auth-input-wrap" style="margin-top:6px;">
          <span class="p-auth-input-wrap__lead">${iconMarkup('mail', { size: 20 })}</span>
          <input type="email" id="user-email" class="c-input" placeholder="ban@gmail.com" required autocomplete="email" />
        </div>
      </div>

      <div>
        <div class="p-auth-label-row">
          <label class="c-field__label" for="user-password">Mật khẩu</label>
          <button type="button" class="p-auth-link" id="forgot-password-link">Quên mật khẩu?</button>
        </div>
        <div class="p-auth-input-wrap p-auth-input-wrap--trail">
          <span class="p-auth-input-wrap__lead">${iconMarkup('lock', { size: 20 })}</span>
          <input type="password" id="user-password" class="c-input" placeholder="Nhập mật khẩu" required autocomplete="current-password" />
          <button type="button" class="p-auth-eye-btn" id="toggle-pwd-btn" aria-label="Hiện mật khẩu">
            ${iconMarkup('eye', { size: 20 })}
          </button>
        </div>
      </div>

      <button type="submit" class="c-btn c-btn--primary c-btn--pill c-btn--block" id="send-otp-btn">
        <span>Gửi mã OTP xác thực</span>
        ${iconMarkup('chevron-right', { size: 16 })}
      </button>
    </form>

    <form id="otp-verify-form" class="p-auth-step hidden-step">
      <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;background:var(--surface-subtle);border:1px solid var(--border-subtle);color:var(--text-primary);font-size:12px;">
        ${iconMarkup('mail', { size: 20, variant: 'filled' })}
        <div>
          <span class="u-text-secondary">Mã 6 chữ số đã gửi tới </span>
          <strong id="otp-sent-target">email của bạn</strong>
        </div>
      </div>

      <div>
        <label class="c-field__label" style="display:block;text-align:center;margin-bottom:8px;">Mã xác thực OTP</label>
        <div class="p-otp-grid" id="otp-pin-boxes">
          <input type="text" maxlength="1" class="otp-box p-otp-cell" data-index="0" aria-label="Số OTP 1" inputmode="numeric" pattern="[0-9]*" />
          <input type="text" maxlength="1" class="otp-box p-otp-cell" data-index="1" aria-label="Số OTP 2" inputmode="numeric" pattern="[0-9]*" />
          <input type="text" maxlength="1" class="otp-box p-otp-cell" data-index="2" aria-label="Số OTP 3" inputmode="numeric" pattern="[0-9]*" />
          <input type="text" maxlength="1" class="otp-box p-otp-cell" data-index="3" aria-label="Số OTP 4" inputmode="numeric" pattern="[0-9]*" />
          <input type="text" maxlength="1" class="otp-box p-otp-cell" data-index="4" aria-label="Số OTP 5" inputmode="numeric" pattern="[0-9]*" />
          <input type="text" maxlength="1" class="otp-box p-otp-cell" data-index="5" aria-label="Số OTP 6" inputmode="numeric" pattern="[0-9]*" />
        </div>
      </div>

      <div style="text-align:center;font-size:12px;color:var(--text-secondary);">
        <span id="otp-timer-text">Gửi lại mã sau <strong id="timer-sec">60</strong>s</span>
        <button type="button" class="p-auth-link" id="resend-otp-btn" style="display:none;">Gửi lại mã ngay</button>
      </div>

      <button type="submit" class="c-btn c-btn--primary c-btn--pill c-btn--block" id="final-login-btn">
        ${iconMarkup('check', { size: 20 })}<span>Đăng nhập ngay</span>
      </button>

      <button type="button" class="c-btn c-btn--ghost c-btn--sm c-btn--pill c-btn--block" id="back-to-step1-btn">
        ${iconMarkup('back', { size: 16 })}<span>Đổi Email / Mật khẩu</span>
      </button>
    </form>
  `;

  const googlePanel = document.createElement('div');
  googlePanel.className = 'p-auth-panel';
  googlePanel.id = 'panel-google';
  googlePanel.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px;padding:8px 0;">
      <div style="display:flex;align-items:center;gap:10px;">
        ${iconMarkup('google', { size: 24 })}
        <div style="text-align:left;">
          <strong style="display:block;font-size:14px;">Đăng nhập bằng Google</strong>
          <span class="u-text-secondary" style="font-size:12px;">Một chạm an toàn, đồng bộ tức thì</span>
        </div>
      </div>
      <div id="google-button-wrap" aria-live="polite" style="display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;">
        <div id="google-signin-button" style="display:flex;flex-direction:column;align-items:center;gap:8px;width:100%;"></div>
        <p class="u-text-secondary" id="google-login-status" style="font-size:12px;margin:0;">Đang tải nút đăng nhập Google…</p>
      </div>
    </div>
  `;

  formCard.append(emailPanel, googlePanel);
  main.appendChild(formCard);

  const footerAction = document.createElement('footer');
  footerAction.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
  footerAction.innerHTML = `
    <div class="p-auth-divider"><span>hoặc</span></div>
    <button type="button" class="c-btn c-btn--secondary c-btn--pill c-btn--block" id="go-onboarding-btn">
      ${iconMarkup('sparkle', { size: 16 })}<span>Tạo không gian Couple mới</span>
    </button>
  `;

  root.append(main, footerAction);

  const resetModal = createResetPasswordModal();
  root.appendChild(resetModal);

  footerAction.querySelector('#go-onboarding-btn')?.addEventListener('click', () => navigate('/onboarding', true));
  emailPanel.querySelector('#forgot-password-link')?.addEventListener('click', () => openResetModal(resetModal));

  const tabEmail = tabsWrap.querySelector<HTMLButtonElement>('#tab-email-btn')!;
  const tabGoogle = tabsWrap.querySelector<HTMLButtonElement>('#tab-google-btn')!;

  const switchTab = (activeTab: 'email' | 'google') => {
    sessionStorage.setItem('dev_login_tab', activeTab);
    triggerHaptic('select');
    const isEmail = activeTab === 'email';
    tabEmail.classList.toggle('active', isEmail);
    tabEmail.setAttribute('aria-selected', String(isEmail));
    tabGoogle.classList.toggle('active', !isEmail);
    tabGoogle.setAttribute('aria-selected', String(!isEmail));
    emailPanel.classList.toggle('active', isEmail);
    googlePanel.classList.toggle('active', !isEmail);
  };

  tabEmail.addEventListener('click', () => switchTab('email'));
  tabGoogle.addEventListener('click', () => switchTab('google'));

  const requestedLoginTab = new URLSearchParams(window.location.search).get('tab') as 'email' | 'google' | null;
  const savedLoginTab = sessionStorage.getItem('dev_login_tab') as 'email' | 'google' | null;
  if (requestedLoginTab === 'email' || requestedLoginTab === 'google') {
    switchTab(requestedLoginTab);
  } else if (savedLoginTab) {
    switchTab(savedLoginTab);
  }

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
    togglePwdBtn.setAttribute('aria-label', passwordVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
    togglePwdBtn.innerHTML = iconMarkup(passwordVisible ? 'eye-off' : 'eye', { size: 20 });
  });

  let resendTimer: number | null = null;
  const startCountdown = () => {
    let secondsLeft = 60;
    timerText.style.display = 'inline';
    resendOtpBtn.style.display = 'none';
    timerSec.textContent = '60';
    if (resendTimer) clearInterval(resendTimer);
    resendTimer = window.setInterval(() => {
      secondsLeft -= 1;
      timerSec.textContent = String(secondsLeft);
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
    sendOtpBtn.innerHTML = '<span class="c-btn__spinner"></span><span>Đang gửi mã OTP…</span>';

    try {
      await sendLoginOtp(email, password);
      showToast(`Mã OTP đã được gửi tới ${email}`, 'success');
      otpSentTarget.textContent = email;
      emailForm.classList.add('hidden-step');
      otpForm.classList.remove('hidden-step');
      startCountdown();
      otpForm.querySelector<HTMLInputElement>('.otp-box')?.focus();
    } catch (err) {
      showToast(errorMessage(err, 'Không thể gửi OTP. Kiểm tra thông tin đăng nhập!'), 'error');
    } finally {
      sendOtpBtn.disabled = false;
      sendOtpBtn.innerHTML = `<span>Gửi mã OTP xác thực</span>${iconMarkup('chevron-right', { size: 16 })}`;
    }
  });

  const otpBoxes = Array.from(otpForm.querySelectorAll<HTMLInputElement>('.otp-box'));
  otpBoxes.forEach((box, idx) => {
    box.addEventListener('input', () => {
      const val = box.value.replace(/\D/g, '');
      box.value = val.slice(-1);
      if (box.value && idx < otpBoxes.length - 1) {
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
      const pasted = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
      if (pasted.length > 0) {
        pasted.split('').forEach((ch, i) => {
          if (otpBoxes[i]) otpBoxes[i].value = ch;
        });
        otpBoxes[Math.min(pasted.length, 5)]?.focus();
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
    finalLoginBtn.innerHTML = '<span class="c-btn__spinner"></span><span>Đang xác thực…</span>';

    try {
      const result = await login({ email, password, otpCode });
      store.set({
        token: result.token,
        user: result.user,
        couple: result.couple,
      });
      localStorage.setItem('lovecheck_token', result.token);
      triggerHaptic('confirm');
      showToast('Đăng nhập thành công!', 'success');
      navigate('/app/home', true);
    } catch (err) {
      showToast(errorMessage(err, 'Đăng nhập thất bại. Mã OTP không đúng hoặc hết hạn!'), 'error');
    } finally {
      finalLoginBtn.disabled = false;
      finalLoginBtn.innerHTML = `${iconMarkup('check', { size: 20 })}<span>Đăng nhập ngay</span>`;
    }
  });

  const googleWrap = googlePanel.querySelector<HTMLElement>('#google-button-wrap')!;
  const googleMount = googlePanel.querySelector<HTMLElement>('#google-signin-button')!;
  const googleStatus = googlePanel.querySelector<HTMLElement>('#google-login-status')!;

  mountGoogleSignInButton(googleMount, googleStatus, (credential) => {
    void handleGoogleLogin(credential, googleWrap, googleStatus);
  });

  return root;
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

    const isDevGoogleLogin = credential.startsWith('mock-google-');
    if (isDevGoogleLogin) {
      sessionStorage.setItem('google_authenticated_user', 'true');
    }

    if (!result.couple) {
      [
        'dev_onboarding_step',
        'dev_onboarding_partnerName',
        'dev_onboarding_coupleCode',
        'dev_onboarding_loveStartDate',
        'dev_onboarding_useAccount',
      ].forEach((key) => sessionStorage.removeItem(key));
      sessionStorage.setItem('google_authenticated_user', 'true');
      if (result.user.email) sessionStorage.setItem('dev_onboarding_email', result.user.email);
      if (result.user.displayName) sessionStorage.setItem('dev_onboarding_displayName', result.user.displayName);
      showToast('Đăng nhập Google thành công! Hãy hoàn tất ghép đôi nhé.', 'info');
      navigate('/app/google-onboarding', true);
    } else if (isDevGoogleLogin) {
      showToast('Đăng nhập Dev Google thành công!', 'info');
      navigate('/app/profile', true);
    } else {
      showToast('Đăng nhập Google thành công!', 'success');
      navigate('/app/home', true);
    }
  } catch (err) {
    buttonWrap.style.pointerEvents = '';
    buttonWrap.removeAttribute('aria-busy');
    status.textContent = 'Google sẽ xác thực an toàn tài khoản của bạn.';
    showToast(errorMessage(err, 'Đăng nhập Google thất bại'), 'error');
  }
}

function createResetPasswordModal(): HTMLElement {
  const backdrop = document.createElement('div');
  backdrop.className = 'p-auth-modal-backdrop hidden-modal';
  backdrop.id = 'reset-password-modal';

  backdrop.innerHTML = `
    <div class="p-auth-modal-card">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <h2 style="font-family:var(--font-display);font-size:20px;">Khôi phục mật khẩu</h2>
        <button type="button" class="c-icon-btn c-icon-btn--ghost" id="close-modal-btn" aria-label="Đóng">${iconMarkup('close', { size: 20 })}</button>
      </div>
      <p class="u-text-secondary" style="font-size:13px;margin:0;">Nhập email để nhận mã đặt lại mật khẩu mới</p>

      <form id="reset-step1-form" class="p-auth-step">
        <input type="email" id="reset-email" class="c-input" placeholder="ban@gmail.com" aria-label="Email tài khoản" required />
        <button type="submit" class="c-btn c-btn--primary c-btn--pill c-btn--block" id="reset-send-otp-btn">Gửi mã xác thực</button>
      </form>

      <form id="reset-step2-form" class="p-auth-step hidden-step">
        <input type="text" id="reset-otp" class="c-input" placeholder="Mã OTP 6 chữ số" maxlength="6" pattern="[0-9]*" inputmode="numeric" aria-label="Mã OTP" required />
        <input type="password" id="reset-new-pwd" class="c-input" placeholder="Mật khẩu mới (tối thiểu 6 ký tự)" minlength="6" aria-label="Mật khẩu mới" required />
        <button type="submit" class="c-btn c-btn--primary c-btn--pill c-btn--block" id="reset-confirm-btn">Đổi mật khẩu</button>
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
      showToast(`Mã khôi phục đã gửi tới ${email}`, 'success');
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
    btn.textContent = 'Đổi mật khẩu';

    try {
      await confirmPasswordReset(email, otp, newPwd);
      showToast('Đã đổi mật khẩu thành công! Hãy đăng nhập lại nhé.', 'success');
      closeResetModal(backdrop);
    } catch (err) {
      showToast(errorMessage(err, 'Đổi mật khẩu thất bại. Kiểm tra lại mã OTP!'), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Đổi mật khẩu';
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
