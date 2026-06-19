import nodemailer from 'nodemailer';
import { env } from '../config/env';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: env.GMAIL_USER,
        pass: env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const mailer = getTransporter();

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
              <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.5);">Mã xác thực email của bạn</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 24px;font-size:15px;color:rgba(255,255,255,0.75);line-height:1.6;">
                Xin chào! Đây là mã xác thực <strong style="color:#ff6b9d;">6 chữ số</strong> để hoàn tất đăng ký tài khoản Check IN Love của bạn:
              </p>

              <!-- OTP Code Box -->
              <div style="text-align:center;margin:0 0 28px;">
                <div style="display:inline-block;background:rgba(255,107,157,0.08);border:2px solid rgba(255,107,157,0.3);border-radius:18px;padding:20px 40px;">
                  <span style="font-size:42px;font-weight:800;letter-spacing:12px;color:#ff6b9d;font-family:'Courier New',monospace;">${code}</span>
                </div>
              </div>

              <div style="background:rgba(255,255,255,0.04);border-radius:12px;padding:16px 20px;margin-bottom:24px;">
                <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.5);line-height:1.6;">
                  ⏰ Mã có hiệu lực trong <strong style="color:rgba(255,255,255,0.8);">10 phút</strong><br/>
                  🔒 Không chia sẻ mã này với bất kỳ ai<br/>
                  ❌ Nếu bạn không yêu cầu, hãy bỏ qua email này
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:0 40px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">
                Email được gửi từ <strong>Check IN Love</strong> — Ứng dụng check-in riêng tư cho cặp đôi 💕<br/>
                <a href="https://couple.babyress.games" style="color:rgba(255,255,255,0.4);text-decoration:none;">https://couple.babyress.games</a><br/>
                &copy; aiThs
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

  await mailer.sendMail({
    from: `"Check IN Love 💕" <${env.GMAIL_USER}>`,
    to,
    subject: `${code} – Mã xác thực Check IN Love của bạn`,
    html,
    text: `Mã xác thực Check IN Love của bạn: ${code}\n\nMã có hiệu lực trong 10 phút. Không chia sẻ mã này với ai.\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.`,
  });
}
