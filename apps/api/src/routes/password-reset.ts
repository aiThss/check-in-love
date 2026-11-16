import { Hono } from 'hono';
import { z } from 'zod';
import { execute, findUserByEmailOrAlias, queryOne } from '../db/d1';
import type { OtpCodeRow } from '../db/types';
import { sendOtpEmail } from '../services/email';
import type { HonoAppEnv } from '../types/hono';
import { generateOtpCode, hashPassword } from '../utils/crypto';
import { AppError } from '../utils/errors';
import { generateId } from '../utils/id';

export const passwordResetRoutes = new Hono<HonoAppEnv>();

const sendResetSchema = z.object({
  email: z.string().trim().email('Email không hợp lệ'),
});

const confirmResetSchema = z.object({
  email: z.string().trim().email('Email không hợp lệ'),
  otpCode: z.string().trim().regex(/^\d{6}$/, 'Mã OTP phải gồm 6 chữ số'),
  newPassword: z.string().min(6, 'Mật khẩu mới tối thiểu 6 ký tự').max(120),
});

passwordResetRoutes.post('/auth/password-reset/send-otp', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = sendResetSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message || 'Email không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const email = parsed.data.email.toLowerCase();
  const user = await findUserByEmailOrAlias(c.env.DB, email);
  if (!user) {
    return c.json({ message: 'Nếu email tồn tại, mã khôi phục đã được gửi', expiresIn: 300 });
  }

  const latest = await queryOne<OtpCodeRow>(
    c.env.DB,
    `SELECT * FROM otp_codes
     WHERE lower(email) = ? AND purpose = 'reset'
     ORDER BY created_at DESC LIMIT 1`,
    [email],
  );
  if (latest) {
    const elapsedMs = Date.now() - new Date(latest.created_at).getTime();
    if (elapsedMs >= 0 && elapsedMs < 45_000) {
      const waitSec = Math.ceil((45_000 - elapsedMs) / 1000);
      throw new AppError(`Vui lòng đợi ${waitSec} giây trước khi gửi lại mã`, 429, 'RATE_LIMIT');
    }
  }

  const code = generateOtpCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString();

  await execute(
    c.env.DB,
    `INSERT INTO otp_codes (id, email, code, purpose, expires_at, verified, created_at)
     VALUES (?, ?, ?, 'reset', ?, 0, ?)`,
    [generateId(), email, code, expiresAt, now.toISOString()],
  );

  const sent = await sendOtpEmail(c.get('config'), email, code, 'reset');
  if (!sent) {
    throw new AppError('Không thể gửi email khôi phục lúc này', 500, 'EMAIL_SEND_FAILED');
  }

  return c.json({ message: 'Nếu email tồn tại, mã khôi phục đã được gửi', expiresIn: 300 });
});

passwordResetRoutes.post('/auth/password-reset/confirm', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = confirmResetSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const email = parsed.data.email.toLowerCase();
  const nowIso = new Date().toISOString();
  const otp = await queryOne<OtpCodeRow>(
    c.env.DB,
    `SELECT * FROM otp_codes
     WHERE lower(email) = ? AND purpose = 'reset' AND verified = 0 AND expires_at > ?
     ORDER BY created_at DESC LIMIT 1`,
    [email, nowIso],
  );
  if (!otp || otp.code !== parsed.data.otpCode) {
    throw new AppError('Mã OTP không đúng hoặc đã hết hạn', 400, 'INVALID_OTP');
  }

  const user = await findUserByEmailOrAlias(c.env.DB, email);
  if (!user) {
    throw new AppError('Tài khoản không tồn tại', 404, 'USER_NOT_FOUND');
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await execute(
    c.env.DB,
    'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
    [passwordHash, nowIso, user.id],
  );
  await execute(c.env.DB, 'UPDATE otp_codes SET verified = 1 WHERE id = ?', [otp.id]);

  return c.json({ message: 'Đặt lại mật khẩu thành công' });
});
