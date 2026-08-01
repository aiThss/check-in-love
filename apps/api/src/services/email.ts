import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { OtpCode } from '../db/models/OtpCode';

let transporter: nodemailer.Transporter | null = null;

export function isEmailConfigured(): boolean {
  return Boolean(
    (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) ||
    (env.GMAIL_USER && env.GMAIL_APP_PASSWORD)
  );
}

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
      const port = env.SMTP_PORT ? parseInt(env.SMTP_PORT, 10) : 587;
      const secure = port === 465 || (env.SMTP_SECURE === 'true' && port !== 587);
      transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port,
        secure,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      });
    } else {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: env.GMAIL_USER,
          pass: env.GMAIL_APP_PASSWORD,
        },
      });
    }
  }
  return transporter;
}

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const mailer = getTransporter();
  const otpRecord = await OtpCode.findOne({
    email: to.toLowerCase(),
    code,
    verified: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  const isLogin = otpRecord?.purpose === 'login';
  const isPasswordReset = otpRecord?.purpose === 'password-reset';
  const headerLabel = isPasswordReset
    ? 'Mã đặt lại mật khẩu'
    : isLogin
      ? 'Mã xác thực đăng nhập'
      : 'Mã xác thực đăng ký tài khoản';
  const actionCopy = isPasswordReset
    ? 'đặt lại mật khẩu'
    : isLogin
      ? 'đăng nhập vào tài khoản'
      : 'hoàn tất đăng ký tài khoản';
  const subject = isPasswordReset
    ? `${code} – Mã đặt lại mật khẩu Check IN Love`
    : isLogin
      ? `${code} – Mã đăng nhập Check IN Love`
      : `${code} – Mã xác thực đăng ký Check IN Love`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#0f0f10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f10;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="100%" style="max-width:480px;background:linear-gradient(145deg,#1a1a2e,#16213e);border-radius:24px;overflow:hidden;border:1px solid rgba(255,107,157,0.2);">
          
          <!-- Header -->
          <tr>
            <td style="padding:40px 40px 24px;text-align:center;background:linear-gradient(135deg,rgba(255,107,157,0.15),rgba(255,168,107,0.08));">
              <div style="font-size:48px;margin-bottom:12px;">💕</div>
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px;">Check IN Love</h1>
              <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.5);">${headerLabel}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 8px;font-size:15px;font-weight:600;color:rgba(255,255,255,0.82);line-height:1.6;">
                Xin chào!
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:rgba(255,255,255,0.75);line-height:1.6;">
                Đây là mã xác thực <strong style="color:#ff6b9d;">6 chữ số</strong> để ${actionCopy} Check IN Love <span style="white-space:nowrap;">của&nbsp;bạn:</span>
              </p>

              <!-- OTP Code Box -->
              <div style="text-align:center;margin:0 0 28px;">
                <div style="display:inline-block;background:rgba(255,107,157,0.08);border:2px solid rgba(255,107,157,0.3);border-radius:18px;padding:20px 40px;">
                  <span style="font-size:42px;font-weight:800;letter-spacing:12px;color:#ff6b9d;font-family:'Courier New',monospace;">${code}</span>
                </div>
              </div>

              <div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:16px 20px;margin-bottom:24px;">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="font-size:13px;color:rgba(255,255,255,0.5);line-height:1.6;">
                  <tr>
                    <td width="26" valign="top" style="padding:0 8px 2px 0;">⏰</td>
                    <td valign="top" style="padding:0 0 2px;">Mã có hiệu lực trong <strong style="color:rgba(255,255,255,0.8);">10 phút</strong></td>
                  </tr>
                  <tr>
                    <td width="26" valign="top" style="padding:0 8px 2px 0;">🔒</td>
                    <td valign="top" style="padding:0 0 2px;">Không chia sẻ mã này với bất kỳ ai</td>
                  </tr>
                  <tr>
                    <td width="26" valign="top" style="padding:0 8px 0 0;">❌</td>
                    <td valign="top">Nếu bạn không yêu cầu, hãy bỏ qua email này</td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:0 40px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.42);line-height:1.6;">
                &copy; 2026 &bull; Made by <strong style="color:rgba(255,255,255,0.68);">aiThs</strong><br/>
                Contact for work<br/>
                <a href="mailto:danhthai4560@gmail.com" style="color:rgba(255,255,255,0.58);text-decoration:none;">danhthai4560@gmail.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const textAction = isPasswordReset
    ? 'đặt lại mật khẩu Check IN Love'
    : isLogin
      ? 'đăng nhập vào tài khoản Check IN Love'
      : 'hoàn tất đăng ký tài khoản Check IN Love';

  const fromAddress = env.SMTP_FROM || (env.SMTP_USER ? `"Check IN Love 💕" <${env.SMTP_USER}>` : `"Check IN Love 💕" <${env.GMAIL_USER}>`);

  await mailer.sendMail({
    from: fromAddress,
    to,
    subject,
    html,
    text: `Xin chào!\n\nĐây là mã xác thực 6 chữ số để ${textAction} của bạn: ${code}\n\nMã có hiệu lực trong 10 phút. Không chia sẻ mã này với ai.\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.\n\n© 2026 • Made by aiThs\nContact for work: danhthai4560@gmail.com`,
  });
}
