import { adminApi } from '../api/admin';
import { ApiError } from '../api/client';
import { navigate } from '../router';

export function renderLoginPage(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'login-page';

  const card = document.createElement('div');
  card.className = 'login-card';

  card.innerHTML = `
    <div class="login-brand">
      <div class="login-brand-icon">💕</div>
      <div class="login-brand-title">Love<span>Check</span></div>
      <div class="login-brand-subtitle">Bảng điều khiển quản trị</div>
    </div>
  `;

  /* Error banner */
  const errorBanner = document.createElement('div');
  errorBanner.className = 'alert alert-danger';
  errorBanner.style.display = 'none';

  /* Form */
  const form = document.createElement('form');
  form.setAttribute('autocomplete', 'on');
  form.noValidate = true;

  /* Email */
  const emailGroup = document.createElement('div');
  emailGroup.className = 'form-group';
  emailGroup.innerHTML = `<label class="form-label" for="admin-email">Email</label>`;

  const emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.id = 'admin-email';
  emailInput.className = 'form-input';
  emailInput.placeholder = 'admin@checkinlove.com';
  emailInput.name = 'email';
  emailInput.autocomplete = 'username';
  emailInput.required = true;

  emailGroup.appendChild(emailInput);

  /* Password */
  const passwordGroup = document.createElement('div');
  passwordGroup.className = 'form-group';
  passwordGroup.innerHTML = `<label class="form-label" for="admin-password">Mật khẩu</label>`;

  const inputWrapper = document.createElement('div');
  inputWrapper.className = 'input-wrapper';

  const passwordInput = document.createElement('input');
  passwordInput.type = 'password';
  passwordInput.id = 'admin-password';
  passwordInput.className = 'form-input';
  passwordInput.placeholder = '••••••••';
  passwordInput.name = 'password';
  passwordInput.autocomplete = 'current-password';
  passwordInput.required = true;
  passwordInput.style.width = '100%';
  passwordInput.style.paddingRight = '44px';

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'input-toggle';
  toggleBtn.setAttribute('aria-label', 'Toggle password visibility');
  toggleBtn.textContent = '👁️';

  let passwordVisible = false;
  toggleBtn.addEventListener('click', () => {
    passwordVisible = !passwordVisible;
    passwordInput.type = passwordVisible ? 'text' : 'password';
    toggleBtn.textContent = passwordVisible ? '🙈' : '👁️';
  });

  inputWrapper.appendChild(passwordInput);
  inputWrapper.appendChild(toggleBtn);
  passwordGroup.appendChild(inputWrapper);

  /* Submit button */
  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'btn btn-primary btn-lg btn-full';
  submitBtn.style.marginTop = '8px';
  submitBtn.textContent = 'Đăng nhập';

  /* Assemble form */
  form.appendChild(emailGroup);
  form.appendChild(passwordGroup);
  form.appendChild(errorBanner);
  form.appendChild(submitBtn);

  /* Handle submit */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showError(errorBanner, 'Vui lòng nhập đầy đủ email và mật khẩu.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Đang đăng nhập…';
    errorBanner.style.display = 'none';
    emailInput.classList.remove('error');
    passwordInput.classList.remove('error');

    try {
      const { token } = await adminApi.login(email, password);
      localStorage.setItem('admin_token', token);
      navigate('/dashboard');
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Đã xảy ra lỗi. Vui lòng thử lại.';

      showError(errorBanner, message);

      if (err instanceof ApiError && err.status === 401) {
        emailInput.classList.add('error');
        passwordInput.classList.add('error');
      }

      submitBtn.disabled = false;
      submitBtn.textContent = 'Đăng nhập';
    }
  });

  card.appendChild(form);
  page.appendChild(card);

  /* Auto-focus email */
  requestAnimationFrame(() => emailInput.focus());

  return page;
}

function showError(banner: HTMLElement, message: string): void {
  banner.textContent = '⚠️ ' + message;
  banner.style.display = 'flex';
}
