import { showToast } from '../components/toast';
import { iconMarkup } from './icons/icons';

declare const __GOOGLE_CLIENT_ID__: string;

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleIdConfiguration {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  cancel_on_tap_outside?: boolean;
}

export interface GoogleButtonOptions {
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
    onNativeGoogleCredential?: (credential: string) => void;
    onNativeGoogleSignInError?: (message: string) => void;
  }
}

const GOOGLE_CLIENT_ID =
  typeof __GOOGLE_CLIENT_ID__ !== 'undefined' ? __GOOGLE_CLIENT_ID__ : '';
const GOOGLE_SDK_URL = 'https://accounts.google.com/gsi/client';
const GOOGLE_SDK_MAX_ATTEMPTS = 3;
let googleSdkPromise: Promise<void> | null = null;

export function isLocalDevHostname(hostname = window.location.hostname): boolean {
  return (
    hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname.startsWith('192.168.')
    || hostname.startsWith('10.')
    || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

export function loadGoogleSdkScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleSdkPromise) return googleSdkPromise;

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
        if (window.google?.accounts?.id) resolve();
        else retryOrReject();
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

export interface MountGoogleSignInOptions {
  buttonText?: GoogleButtonOptions['text'];
  width?: number;
}

export function mountGoogleSignInButton(
  mount: HTMLElement,
  status: HTMLElement,
  onCredential: (credential: string) => void,
  options: MountGoogleSignInOptions = {},
): void {
  const buttonText = options.buttonText ?? 'signin_with';
  const buttonWidth = options.width ?? 280;

  if (typeof window.LoveCheckAndroid !== 'undefined' && window.LoveCheckAndroid) {
    mountNativeGoogleSignInButton(
      mount,
      status,
      () => {
        // Phải gọi trực tiếp window.LoveCheckAndroid.signInWithGoogle() (không dùng optional chaining ?.())
        if (window.LoveCheckAndroid && typeof window.LoveCheckAndroid.signInWithGoogle === 'function') {
          window.LoveCheckAndroid.signInWithGoogle();
        }
      },
      onCredential,
    );
    return;
  }

  const createMockGoogleBtn = () => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'p-google-btn';
    btn.dataset.devGoogleLogin = 'true';
    btn.innerHTML = `${iconMarkup('google', { size: 20 })}<span>Dùng thử Google (Dev Local)</span>`;
    btn.addEventListener('click', () => onCredential('mock-google-new-user'));
    return btn;
  };

  if (!GOOGLE_CLIENT_ID) {
    if (isLocalDevHostname()) {
      mount.replaceChildren(createMockGoogleBtn());
      status.textContent = 'Chế độ Dev Local: bấm nút trên để thử luồng Google mẫu.';
    } else {
      status.textContent = 'Đăng nhập Google hiện chưa khả dụng. Vui lòng dùng Email & OTP.';
    }
    return;
  }

  status.textContent = 'Đang kết nối Google Identity…';

  void loadGoogleSdkScript()
    .then(() => {
      const googleId = window.google?.accounts?.id;
      if (!googleId) throw new Error('Google Identity Services SDK loaded without identity API');

      googleId.initialize({
        client_id: GOOGLE_CLIENT_ID,
        cancel_on_tap_outside: true,
        callback: (response) => onCredential(response.credential),
      });
      mount.replaceChildren();
      googleId.renderButton(mount, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: buttonText,
        shape: 'pill',
        width: buttonWidth,
        logo_alignment: 'left',
      });
      status.textContent = 'Google sẽ xác thực an toàn tài khoản của bạn.';

      if (isLocalDevHostname() && !mount.querySelector('[data-dev-google-login]')) {
        mount.appendChild(createMockGoogleBtn());
      }
    })
    .catch((error: unknown) => {
      console.error('[Google Sign-In] Failed to load Google Identity Services', error);
      status.textContent = 'Không thể tải đăng nhập Google. Kiểm tra kết nối mạng.';
      if (isLocalDevHostname()) {
        mount.replaceChildren(createMockGoogleBtn());
      }
    });
}

function mountNativeGoogleSignInButton(
  mount: HTMLElement,
  status: HTMLElement,
  signInWithGoogle: () => void,
  onCredential: (credential: string) => void,
): void {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'google-native-signin-button p-google-btn';
  button.innerHTML = `${iconMarkup('google', { size: 20 })}<span>Tiếp tục với Google</span>`;
  mount.replaceChildren(button);
  status.textContent = 'Google sẽ xác thực an toàn tài khoản của bạn.';

  window.onNativeGoogleCredential = (credential: string) => {
    button.disabled = false;
    status.textContent = 'Google sẽ xác thực an toàn tài khoản của bạn.';
    onCredential(credential);
  };
  window.onNativeGoogleSignInError = (message: string) => {
    button.disabled = false;
    if (message === 'CANCELLED' || message.includes('Cancellation') || message.includes('huỷ')) {
      status.textContent = 'Google sẽ xác thực an toàn tài khoản của bạn.';
      return;
    }
    const displayMsg = message || 'Không thể đăng nhập Google trên thiết bị này.';
    showToast(displayMsg, 'error');
    status.textContent = displayMsg;
  };

  button.addEventListener('click', () => {
    button.disabled = true;
    status.textContent = 'Đang mở Google…';
    try {
      signInWithGoogle();
    } catch (error) {
      button.disabled = false;
      const errMsg = error instanceof Error ? error.message : 'Không thể gọi native Google sign-in.';
      showToast(errMsg, 'error');
      status.textContent = errMsg;
    }
  });
}
