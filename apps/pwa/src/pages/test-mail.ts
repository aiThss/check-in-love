import { sendOtp } from '../api/auth';
import { ApiError } from '../api/client';

export function renderTestMailPage(): HTMLElement {
  const page = document.createElement('div');
  page.className = 'page page-no-nav test-mail-page animate-fade-in';
  page.innerHTML = `
    <style>
      .test-mail-page {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 28px 18px;
        background:
          radial-gradient(circle at 15% 10%, rgba(255, 107, 157, 0.18), transparent 32%),
          radial-gradient(circle at 85% 88%, rgba(255, 168, 107, 0.13), transparent 30%),
          var(--bg-primary, #0f0f10);
      }

      .test-mail-card {
        width: min(100%, 520px);
        padding: 28px;
        border: 1px solid rgba(255, 107, 157, 0.22);
        border-radius: 24px;
        background: rgba(24, 24, 30, 0.92);
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.36);
        backdrop-filter: blur(18px);
      }

      .test-mail-badge {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 7px 11px;
        border: 1px solid rgba(255, 107, 157, 0.24);
        border-radius: 999px;
        color: #ff8bb2;
        background: rgba(255, 107, 157, 0.08);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.03em;
        text-transform: uppercase;
      }

      .test-mail-card h1 {
        margin: 18px 0 8px;
        color: var(--text-primary, #fff);
        font-size: clamp(27px, 7vw, 38px);
        line-height: 1.1;
        letter-spacing: -0.04em;
      }

      .test-mail-description,
      .test-mail-note {
        color: var(--text-secondary, rgba(255, 255, 255, 0.62));
        line-height: 1.65;
      }

      .test-mail-description {
        margin: 0 0 24px;
        font-size: 14px;
      }

      .test-mail-form {
        display: grid;
        gap: 12px;
      }

      .test-mail-label {
        color: var(--text-primary, #fff);
        font-size: 13px;
        font-weight: 700;
      }

      .test-mail-input {
        width: 100%;
        min-height: 52px;
        padding: 0 15px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 14px;
        outline: none;
        color: var(--text-primary, #fff);
        background: rgba(255, 255, 255, 0.055);
        font: inherit;
        transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
      }

      .test-mail-input:focus {
        border-color: rgba(255, 107, 157, 0.72);
        background: rgba(255, 255, 255, 0.075);
        box-shadow: 0 0 0 4px rgba(255, 107, 157, 0.1);
      }

      .test-mail-submit {
        min-height: 52px;
        border: 0;
        border-radius: 14px;
        color: #fff;
        background: linear-gradient(135deg, #ff5e93, #ff8b68);
        font: inherit;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 0 12px 28px rgba(255, 94, 147, 0.22);
        transition: transform 160ms ease, opacity 160ms ease;
      }

      .test-mail-submit:not(:disabled):active {
        transform: translateY(1px) scale(0.99);
      }

      .test-mail-submit:disabled {
        cursor: wait;
        opacity: 0.62;
      }

      .test-mail-status {
        display: none;
        margin-top: 16px;
        padding: 13px 14px;
        border-radius: 13px;
        font-size: 13px;
        line-height: 1.55;
        word-break: break-word;
      }

      .test-mail-status.is-visible {
        display: block;
      }

      .test-mail-status.is-success {
        color: #b9f6d0;
        border: 1px solid rgba(74, 222, 128, 0.25);
        background: rgba(74, 222, 128, 0.09);
      }

      .test-mail-status.is-error {
        color: #ffc2cc;
        border: 1px solid rgba(251, 113, 133, 0.28);
        background: rgba(251, 113, 133, 0.09);
      }

      .test-mail-note {
        margin: 18px 0 0;
        padding-top: 17px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        font-size: 12px;
      }

      .test-mail-endpoint {
        color: rgba(255, 255, 255, 0.72);
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
    </style>

    <section class="test-mail-card" aria-labelledby="test-mail-title">
      <span class="test-mail-badge">✉️ Internal mail test</span>
      <h1 id="test-mail-title">Gửi thử mã OTP</h1>
      <p class="test-mail-description">
        Nhập email nhận thử. Trang này gọi trực tiếp luồng OTP đăng ký đang chạy trên production,
        nên kết quả phản ánh đúng cấu hình SMTP hiện tại.
      </p>

      <form class="test-mail-form" novalidate>
        <label class="test-mail-label" for="test-mail-email">Email nhận mã</label>
        <input
          class="test-mail-input"
          id="test-mail-email"
          name="email"
          type="email"
          inputmode="email"
          autocomplete="email"
          placeholder="you@example.com"
          required
        />
        <button class="test-mail-submit" type="submit">Gửi mã test</button>
      </form>

      <div class="test-mail-status" role="status" aria-live="polite"></div>

      <p class="test-mail-note">
        Route này không được gắn vào menu. API sử dụng:
        <span class="test-mail-endpoint">POST /api/auth/send-otp</span>.
        Nếu email đã có tài khoản, hãy dùng một địa chỉ khác hoặc email alias để test.
      </p>
    </section>
  `;

  const form = page.querySelector<HTMLFormElement>('.test-mail-form');
  const emailInput = page.querySelector<HTMLInputElement>('#test-mail-email');
  const submitButton = page.querySelector<HTMLButtonElement>('.test-mail-submit');
  const status = page.querySelector<HTMLElement>('.test-mail-status');

  const presetEmail = new URLSearchParams(window.location.search).get('email');
  if (presetEmail && emailInput) emailInput.value = presetEmail;

  const showStatus = (message: string, kind: 'success' | 'error'): void => {
    if (!status) return;
    status.textContent = message;
    status.className = `test-mail-status is-visible is-${kind}`;
  };

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!emailInput || !submitButton) return;

    const email = emailInput.value.trim().toLowerCase();
    if (!emailInput.checkValidity() || !email) {
      emailInput.reportValidity();
      return;
    }

    const startedAt = performance.now();
    submitButton.disabled = true;
    submitButton.textContent = 'Đang gửi...';
    status?.classList.remove('is-visible', 'is-success', 'is-error');

    try {
      const response = await sendOtp(email);
      const elapsed = Math.round(performance.now() - startedAt);
      showStatus(`✅ ${response.message} · API phản hồi sau ${elapsed} ms. Hãy kiểm tra Inbox và Spam.`, 'success');
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;
      let message = apiError?.message || 'Không thể gửi mã test.';

      if (apiError?.code === 'EMAIL_ALREADY_EXISTS') {
        message = 'Email này đã được đăng ký nên endpoint signup từ chối gửi. Hãy dùng email khác hoặc alias như tenban+mailtest@gmail.com.';
      } else if (apiError?.code === 'EMAIL_NOT_CONFIGURED') {
        message = 'Server chưa nhận được cấu hình SMTP/Gmail trong environment production.';
      } else if (apiError?.code === 'EMAIL_SEND_FAILED') {
        message = 'API chạy được nhưng SMTP từ chối gửi. Cần kiểm tra host, port, tài khoản, mật khẩu và địa chỉ FROM.';
      } else if (apiError?.code === 'NETWORK_ERROR') {
        message = 'Không kết nối được tới api.couple.io.vn. Kiểm tra API container, DNS hoặc CORS.';
      }

      showStatus(`❌ ${message}${apiError ? ` · ${apiError.code} (${apiError.status})` : ''}`, 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Gửi lại mã test';
    }
  });

  queueMicrotask(() => emailInput?.focus());
  return page;
}
