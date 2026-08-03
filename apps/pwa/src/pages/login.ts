import { loginWithGoogle } from '../api/auth';
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

export function renderLoginPage(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'page-no-nav login-page-pwa animate-fade-in';

  const shell = document.createElement('div');
  shell.className = 'auth-shell animate-slide-up';

  const header = document.createElement('div');
  header.className = 'auth-header';
  header.innerHTML = `
    <button class="btn-icon" id="back-btn" aria-label="Quay lại">←</button>
    <div>
      <div class="auth-emoji">💕</div>
      <h1 class="onboarding-title">Đăng nhập</h1>
      <p class="onboarding-subtitle">Đăng nhập nhanh và an toàn bằng tài khoản Google của bạn.</p>
    </div>
    <span></span>
  `;

  const form = document.createElement('div');
  form.className = 'auth-form';
  form.innerHTML = `
    <div class="google-login-intro">
      <strong>Chào mừng bạn quay lại 💗</strong>
      <span>Dùng tài khoản Google có cùng email với tài khoản Check IN Love.</span>
    </div>
    <div class="google-button-wrap" id="google-button-wrap" aria-live="polite">
      <div id="google-signin-button"></div>
      <p class="google-login-status" id="google-login-status">Đang tải nút đăng nhập Google…</p>
    </div>
    <button class="btn-ghost" id="go-onboarding-btn">Tạo tài khoản mới</button>
  `;

  shell.appendChild(header);
  shell.appendChild(form);
  root.appendChild(shell);

  root.querySelector('#back-btn')?.addEventListener('click', () => {
    navigate('/onboarding', true);
  });
  root.querySelector('#go-onboarding-btn')?.addEventListener('click', () => {
    navigate('/onboarding', true);
  });

  const buttonWrap = form.querySelector<HTMLElement>('#google-button-wrap')!;
  const buttonMount = form.querySelector<HTMLElement>('#google-signin-button')!;
  const status = form.querySelector<HTMLElement>('#google-login-status')!;

  mountGoogleButton(buttonMount, status, (credential) => {
    void handleGoogleLogin(credential, buttonWrap, status);
  });

  return root;
}

function mountGoogleButton(
  mount: HTMLElement,
  status: HTMLElement,
  onCredential: (credential: string) => void,
): void {
  if (!GOOGLE_CLIENT_ID) {
    status.textContent = 'Đăng nhập Google chưa được cấu hình cho môi trường này.';
    return;
  }

  let attempts = 0;
  const tryRender = (): void => {
    const googleId = window.google?.accounts?.id;
    if (googleId) {
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
        width: 340,
        logo_alignment: 'left',
      });
      status.textContent = 'Google sẽ xác thực tài khoản của bạn.';
      return;
    }

    attempts += 1;
    if (attempts >= 50) {
      status.textContent = 'Không thể tải đăng nhập Google. Vui lòng kiểm tra kết nối mạng.';
      return;
    }
    window.setTimeout(tryRender, 100);
  };

  tryRender();
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
    showToast('Đăng nhập thành công', 'success');
    navigate('/app/home', true);
  } catch (err) {
    buttonWrap.style.pointerEvents = '';
    buttonWrap.removeAttribute('aria-busy');
    status.textContent = 'Google sẽ xác thực tài khoản của bạn.';
    showToast(errorMessage(err, 'Đăng nhập Google thất bại'), 'error');
  }
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
