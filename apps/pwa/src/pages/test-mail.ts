import '../styles/20-pages/secondary.css';
import { sendOtp } from '../api/auth';
import { ApiError } from '../api/client';
import { iconMarkup } from '../ui/icons/icons';
import { createBadge, createButton, createCard } from '../ui/primitives';
import { createField } from '../ui/forms';

export function renderTestMailPage(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'page page-no-nav test-mail-page p-secondary animate-fade-in';
  page.style.justifyContent = 'center';

  const card = createCard({ variant: 'sticker', grain: true, className: 'test-mail-card' });
  card.style.padding = '24px';
  card.style.display = 'flex';
  card.style.flexDirection = 'column';
  card.style.gap = '16px';

  const badgeWrap = document.createElement('div');
  badgeWrap.appendChild(createBadge('Kiểm thử hệ thống gửi thư', 'gold'));
  card.appendChild(badgeWrap);

  const head = document.createElement('div');
  head.innerHTML = `
    <h1 class="p-sec-header__title" id="test-mail-title">Gửi thử mã OTP</h1>
    <p class="p-sec-header__sub" style="margin-top:6px;line-height:1.55;">
      Nhập địa chỉ email để kiểm tra trực tiếp cấu hình SMTP trên máy chủ hiện tại.
    </p>
  `;
  card.appendChild(head);

  const presetEmail = new URLSearchParams(window.location.search).get('email') ?? '';
  const emailField = createField({
    label: 'Email nhận mã thử',
    name: 'email',
    type: 'email',
    placeholder: 'ban@example.com',
    value: presetEmail,
    leadingIcon: 'mail',
    required: true,
    autocomplete: 'email',
  });
  emailField.input.id = 'test-mail-email';

  const submitCtrl = createButton({
    label: 'Gửi mã kiểm tra',
    type: 'submit',
    variant: 'primary',
    pill: true,
    block: true,
    leadingIcon: 'send',
  });

  const form = document.createElement('form');
  form.className = 'test-mail-form';
  form.noValidate = true;
  form.style.cssText = 'display:flex;flex-direction:column;gap:14px;';
  form.append(emailField.element, submitCtrl.element);
  card.appendChild(form);

  const status = document.createElement('div');
  status.className = 'test-mail-status p-mail-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  card.appendChild(status);

  const foot = document.createElement('p');
  foot.className = 'u-text-secondary';
  foot.style.cssText = 'font-size:11px;line-height:1.5;margin:0;';
  foot.innerHTML = 'API kiểm thử: <code>POST /api/auth/send-otp</code>. Dùng địa chỉ email chưa đăng ký hoặc alias để thử.';
  card.appendChild(foot);

  page.appendChild(card);

  const showStatus = (message: string, kind: 'success' | 'error'): void => {
    status.innerHTML = `${iconMarkup(kind === 'success' ? 'check' : 'alert', { size: 16 })}<span>${message}</span>`;
    status.className = `test-mail-status p-mail-status is-visible is-${kind}`;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const emailEl = emailField.input as HTMLInputElement;
    const email = emailEl.value.trim().toLowerCase();
    if (!emailEl.checkValidity() || !email) {
      emailField.setError('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }
    emailField.setError(null);

    const startedAt = performance.now();
    submitCtrl.setLoading(true, 'Đang gửi mã...');
    status.classList.remove('is-visible', 'is-success', 'is-error');

    try {
      const response = await sendOtp(email);
      const elapsed = Math.round(performance.now() - startedAt);
      showStatus(`${response.message} · Phản hồi sau ${elapsed} ms. Kiểm tra Hộp thư đến hoặc Spam.`, 'success');
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;
      let message = apiError?.message || 'Không thể gửi mã kiểm tra.';
      if (apiError?.code === 'EMAIL_ALREADY_EXISTS') {
        message = 'Email này đã có tài khoản. Hãy thử địa chỉ khác hoặc alias (+mailtest).';
      } else if (apiError?.code === 'EMAIL_NOT_CONFIGURED') {
        message = 'Máy chủ chưa cấu hình biến môi trường SMTP.';
      } else if (apiError?.code === 'EMAIL_SEND_FAILED') {
        message = 'Máy chủ kết nối được nhưng SMTP từ chối gửi thư.';
      } else if (apiError?.code === 'NETWORK_ERROR') {
        message = 'Không kết nối được tới máy chủ API.';
      }
      showStatus(`${message}${apiError ? ` · ${apiError.code} (${apiError.status})` : ''}`, 'error');
    } finally {
      submitCtrl.setLoading(false);
      submitCtrl.setLabel('Gửi lại mã kiểm tra');
    }
  });

  queueMicrotask(() => emailField.input.focus());
  return page;
}
