import type { AppConfig } from '../config/env';
import { logger } from '../utils/logger';

export type OtpEmailPurpose = 'auth' | 'reset' | 'login';

function encodeBase64Utf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function extractEmailAddress(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  return (match?.[1] ?? fromHeader).trim();
}

function buildOtpEmailContent(
  code: string,
  purpose: OtpEmailPurpose,
): { subject: string; html: string } {
  let heading = 'Mã xác thực tài khoản Check IN Love';
  let lead = 'Nhập mã OTP 6 chữ số dưới đây để tiếp tục hành trình lưu giữ kỷ niệm cùng người thương.';
  let subject = 'Mã xác thực OTP — Check IN Love';

  if (purpose === 'reset') {
    heading = 'Khôi phục mật khẩu Check IN Love';
    lead = 'Sử dụng mã OTP bên dưới để đặt lại mật khẩu tài khoản của bạn.';
    subject = 'Khôi phục mật khẩu OTP — Check IN Love';
  } else if (purpose === 'login') {
    heading = 'Xác thực thiết bị mới';
    lead = 'Bạn đang đăng nhập trên một thiết bị mới. Nhập mã OTP bên dưới để xác nhận.';
    subject = 'Mã xác thực đăng nhập — Check IN Love';
  }

  const html = `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:24px;background:#fff5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f1620;">
  <div style="max-width:460px;margin:0 auto;background:#ffffff;border-radius:24px;padding:28px;border:1px solid #ffd5e4;box-shadow:0 16px 40px rgba(255,59,127,0.12);">
    <div style="font-size:20px;font-weight:800;color:#ff3b7f;margin-bottom:8px;">💕 Check IN Love</div>
    <h1 style="font-size:18px;margin:0 0 10px;color:#1f1620;">${heading}</h1>
    <p style="font-size:14px;line-height:1.6;color:#5a4a57;margin:0 0 22px;">${lead}</p>
    <div style="background:linear-gradient(135deg,#fff0f6,#ffe5f0);border:1px solid #ffb3cf;border-radius:16px;padding:18px;text-align:center;margin-bottom:20px;">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:#9d4a6e;font-weight:700;margin-bottom:6px;">Mã OTP của bạn</div>
      <div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#e11d67;">${code}</div>
    </div>
    <p style="font-size:12px;color:#7a6a77;margin:0;">Mã có hiệu lực trong <strong>5 phút</strong>. Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email.</p>
  </div>
</body>
</html>`.trim();

  return { subject, html };
}

class SmtpLineReader {
  private buffer = '';
  private readonly decoder = new TextDecoder();

  constructor(private readonly reader: ReadableStreamDefaultReader<Uint8Array>) {}

  async readLine(): Promise<string> {
    while (true) {
      const idx = this.buffer.indexOf('\n');
      if (idx >= 0) {
        const line = this.buffer.slice(0, idx).replace(/\r$/, '');
        this.buffer = this.buffer.slice(idx + 1);
        return line;
      }
      const { value, done } = await this.reader.read();
      if (done) {
        if (this.buffer.length > 0) {
          const rest = this.buffer;
          this.buffer = '';
          return rest;
        }
        throw new Error('SMTP connection closed unexpectedly');
      }
      this.buffer += this.decoder.decode(value, { stream: true });
    }
  }

  async readResponse(): Promise<{ code: number; lines: string[] }> {
    const lines: string[] = [];
    while (true) {
      const line = await this.readLine();
      lines.push(line);
      if (line.length >= 4 && line[3] === ' ') {
        const code = Number.parseInt(line.slice(0, 3), 10);
        return { code, lines };
      }
      if (line.length === 3 && /^\d{3}$/.test(line)) {
        return { code: Number.parseInt(line, 10), lines };
      }
    }
  }

  async release(): Promise<void> {
    try {
      this.reader.releaseLock();
    } catch {
      // ignore
    }
  }
}

async function sendSmtpViaWorkersSocket(params: {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const { connect } = await import('cloudflare:sockets');
  const encoder = new TextEncoder();

  let socket = connect(
    { hostname: params.host, port: params.port },
    { secureTransport: params.secure ? 'on' : 'starttls', allowHalfOpen: false },
  );

  let writer = socket.writable.getWriter();
  let reader = new SmtpLineReader(socket.readable.getReader());

  const writeCmd = async (cmd: string): Promise<{ code: number; lines: string[] }> => {
    await writer.write(encoder.encode(`${cmd}\r\n`));
    return reader.readResponse();
  };

  const assertCode = (resp: { code: number; lines: string[] }, expectedPrefix: number, step: string) => {
    if (Math.floor(resp.code / 100) !== expectedPrefix && resp.code !== expectedPrefix) {
      throw new Error(`SMTP ${step} failed (${resp.code}): ${resp.lines.join(' | ')}`);
    }
  };

  try {
    const greeting = await reader.readResponse();
    assertCode(greeting, 2, 'greeting');

    const ehlo = await writeCmd('EHLO couple.io.vn');
    assertCode(ehlo, 2, 'EHLO');

    if (!params.secure && params.port === 587) {
      const startTlsResp = await writeCmd('STARTTLS');
      assertCode(startTlsResp, 2, 'STARTTLS');

      writer.releaseLock();
      await reader.release();

      socket = socket.startTls();
      writer = socket.writable.getWriter();
      reader = new SmtpLineReader(socket.readable.getReader());

      const ehloTls = await writeCmd('EHLO couple.io.vn');
      assertCode(ehloTls, 2, 'EHLO after STARTTLS');
    }

    const authLogin = await writeCmd('AUTH LOGIN');
    assertCode(authLogin, 334, 'AUTH LOGIN');

    const authUser = await writeCmd(encodeBase64Utf8(params.user));
    assertCode(authUser, 334, 'AUTH username');

    const authPass = await writeCmd(encodeBase64Utf8(params.pass));
    assertCode(authPass, 235, 'AUTH password');

    const fromAddr = extractEmailAddress(params.from || params.user);
    const mailFrom = await writeCmd(`MAIL FROM:<${fromAddr}>`);
    assertCode(mailFrom, 2, 'MAIL FROM');

    const rcptTo = await writeCmd(`RCPT TO:<${params.to}>`);
    assertCode(rcptTo, 2, 'RCPT TO');

    const dataCmd = await writeCmd('DATA');
    assertCode(dataCmd, 354, 'DATA');

    const encodedSubject = `=?UTF-8?B?${encodeBase64Utf8(params.subject)}?=`;
    const bodyLines = params.html
      .replace(/\r?\n/g, '\r\n')
      .split('\r\n')
      .map((line) => (line.startsWith('.') ? `.${line}` : line))
      .join('\r\n');

    const message = [
      `From: ${params.from}`,
      `To: <${params.to}>`,
      `Subject: ${encodedSubject}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${crypto.randomUUID()}@couple.io.vn>`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      bodyLines,
      '.',
    ].join('\r\n');

    await writer.write(encoder.encode(`${message}\r\n`));
    const dataDone = await reader.readResponse();
    assertCode(dataDone, 2, 'DATA end');

    await writeCmd('QUIT').catch(() => null);
  } finally {
    try {
      writer.releaseLock();
    } catch {
      // ignore
    }
    await reader.release();
    try {
      await socket.close();
    } catch {
      // ignore
    }
  }
}

export async function sendOtpEmail(
  config: AppConfig,
  email: string,
  code: string,
  purpose: OtpEmailPurpose = 'auth',
): Promise<boolean> {
  if (config.MOCK_EMAIL) {
    logger.info('MOCK_EMAIL OTP dispatched', { email, purpose });
    return true;
  }

  if (!config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASS) {
    logger.warn('SMTP is not configured; cannot send OTP email', { email, purpose });
    return false;
  }

  const { subject, html } = buildOtpEmailContent(code, purpose);

  try {
    await Promise.race([
      sendSmtpViaWorkersSocket({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_SECURE,
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
        from: config.SMTP_FROM || config.SMTP_USER,
        to: email,
        subject,
        html,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('SMTP timeout after 12000ms')), 12_000),
      ),
    ]);
    return true;
  } catch (err) {
    logger.error('Failed to send OTP email via Workers SMTP socket', err, { email, purpose });
    return false;
  }
}
