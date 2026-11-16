import { Hono } from 'hono';
import { z } from 'zod';
import {
  execute,
  findCoupleById,
  findCoupleMembers,
  findUserByEmailOrAlias,
  findUserById,
  queryOne,
} from '../db/d1';
import {
  parseJsonSafe,
  toCoupleDto,
  toUserDto,
  type CoupleRow,
  type OtpCodeRow,
  type TrustedDevice,
  type UserRow,
} from '../db/types';
import { sendOtpEmail } from '../services/email';
import type { HonoAppEnv } from '../types/hono';
import {
  generateOtpCode,
  hashPassword,
  signJwt,
  verifyGoogleIdToken,
  verifyJwt,
  verifyPassword,
} from '../utils/crypto';
import { AppError } from '../utils/errors';
import { generateCoupleCode, generateId } from '../utils/id';

export const authRoutes = new Hono<HonoAppEnv>();

const sendOtpSchema = z.object({
  email: z.string().trim().email('Email không hợp lệ'),
});

const verifyOtpSchema = z.object({
  email: z.string().trim().email('Email không hợp lệ'),
  code: z.string().trim().regex(/^\d{6}$/, 'Mã OTP phải gồm 6 chữ số'),
});

const startSchema = z.object({
  deviceId: z.string().trim().min(1).max(160).optional(),
  displayName: z.string().trim().min(1, 'Vui lòng nhập tên của bạn').max(60),
  partnerName: z.string().trim().max(60).optional().default(''),
  coupleCode: z.string().trim().min(4, 'Mã cặp đôi tối thiểu 4 ký tự').max(20),
  loveStartDate: z.string().trim().max(40).optional(),
  email: z.string().trim().email('Email không hợp lệ').optional(),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự').max(120).optional(),
  otpCode: z.string().trim().optional(),
});

const loginSendOtpSchema = z.object({
  email: z.string().trim().email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

const loginSchema = z.object({
  email: z.string().trim().email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
  otpCode: z.string().trim().optional(),
  deviceId: z.string().trim().max(160).optional(),
});

const googleLoginSchema = z.object({
  credential: z.string().trim().min(10, 'Google token không hợp lệ'),
  deviceId: z.string().trim().max(160).optional(),
});

function upsertTrustedDevice(rawJson: string, deviceId: string | undefined, nowIso: string): string {
  const existing = parseJsonSafe<Array<string | TrustedDevice>>(rawJson, []);
  if (!deviceId) return JSON.stringify(existing);
  const filtered = existing
    .filter((d) => (typeof d === 'string' ? d !== deviceId : d?.deviceId !== deviceId))
    .slice(0, 9);
  filtered.unshift({ deviceId, lastUsedAt: nowIso });
  return JSON.stringify(filtered);
}

async function checkOtpCooldown(db: D1Database, email: string, purpose: OtpCodeRow['purpose']): Promise<void> {
  const latest = await queryOne<OtpCodeRow>(
    db,
    `SELECT * FROM otp_codes
     WHERE lower(email) = ? AND purpose = ?
     ORDER BY created_at DESC LIMIT 1`,
    [email, purpose],
  );
  if (!latest) return;
  const elapsedMs = Date.now() - new Date(latest.created_at).getTime();
  if (elapsedMs >= 0 && elapsedMs < 45_000) {
    const waitSec = Math.ceil((45_000 - elapsedMs) / 1000);
    throw new AppError(`Vui lòng đợi ${waitSec} giây trước khi gửi lại mã OTP`, 429, 'RATE_LIMIT');
  }
}

async function verifyAndConsumeOtp(
  db: D1Database,
  email: string,
  code: string,
  purposes: Array<OtpCodeRow['purpose']>,
): Promise<boolean> {
  const placeholders = purposes.map(() => '?').join(', ');
  const nowIso = new Date().toISOString();
  const row = await queryOne<OtpCodeRow>(
    db,
    `SELECT * FROM otp_codes
     WHERE lower(email) = ? AND purpose IN (${placeholders}) AND expires_at > ?
     ORDER BY created_at DESC LIMIT 1`,
    [email, ...purposes, nowIso],
  );
  if (!row || row.code !== code) return false;
  await execute(db, 'UPDATE otp_codes SET verified = 1 WHERE id = ?', [row.id]);
  return true;
}

async function createAndJoinCouple(
  db: D1Database,
  params: {
    userId: string;
    displayName: string;
    partnerName: string;
    coupleCode: string;
    loveStartDate?: string;
    nowIso: string;
  },
): Promise<CoupleRow> {
  const normalizedCode = params.coupleCode.trim().toUpperCase() || generateCoupleCode();
  let couple = await queryOne<CoupleRow>(
    db,
    'SELECT * FROM couples WHERE upper(code) = ? LIMIT 1',
    [normalizedCode],
  );

  if (couple) {
    const members = await findCoupleMembers(db, couple.id);
    const alreadyMember = members.some((m) => m.id === params.userId);
    if (!alreadyMember && members.length >= 2) {
      throw new AppError('Mã cặp đôi này đã đủ 2 người tham gia', 409, 'COUPLE_FULL');
    }
    if (params.loveStartDate && !couple.love_start_date) {
      await execute(
        db,
        'UPDATE couples SET love_start_date = ?, updated_at = ? WHERE id = ?',
        [params.loveStartDate, params.nowIso, couple.id],
      );
      couple = { ...couple, love_start_date: params.loveStartDate, updated_at: params.nowIso };
    }
    return couple;
  }

  const coupleId = generateId();
  const newCouple: CoupleRow = {
    id: coupleId,
    code: normalizedCode,
    love_start_date: params.loveStartDate || null,
    streak: 0,
    last_checkin_date: null,
    chat_background_json: null,
    created_at: params.nowIso,
    updated_at: params.nowIso,
  };
  await execute(
    db,
    `INSERT INTO couples (id, code, love_start_date, streak, last_checkin_date, chat_background_json, created_at, updated_at)
     VALUES (?, ?, ?, 0, NULL, NULL, ?, ?)`,
    [newCouple.id, newCouple.code, newCouple.love_start_date, newCouple.created_at, newCouple.updated_at],
  );
  return newCouple;
}

async function buildAuthPayload(
  db: D1Database,
  jwtSecret: string,
  user: UserRow,
  couple: CoupleRow | null,
  isNewUser = false,
) {
  const memberIds = couple
    ? (await findCoupleMembers(db, couple.id)).map((m) => m.id)
    : [];
  const token = await signJwt(
    { userId: user.id, coupleId: couple?.id ?? null, role: user.role },
    jwtSecret,
    30 * 24 * 60 * 60,
  );
  return {
    token,
    user: toUserDto(user),
    couple: couple ? toCoupleDto(couple, memberIds) : null,
    isNewUser,
  };
}

authRoutes.post('/auth/send-otp', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = sendOtpSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message || 'Email không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await findUserByEmailOrAlias(c.env.DB, email);
  if (existing) {
    throw new AppError('Email này đã được đăng ký. Vui lòng đăng nhập.', 409, 'EMAIL_EXISTS');
  }

  await checkOtpCooldown(c.env.DB, email, 'auth');

  const code = generateOtpCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString();

  await execute(
    c.env.DB,
    `INSERT INTO otp_codes (id, email, code, purpose, expires_at, verified, created_at)
     VALUES (?, ?, ?, 'auth', ?, 0, ?)`,
    [generateId(), email, code, expiresAt, now.toISOString()],
  );

  const sent = await sendOtpEmail(c.get('config'), email, code, 'auth');
  if (!sent) {
    throw new AppError('Không thể gửi email OTP lúc này. Vui lòng thử lại.', 500, 'EMAIL_SEND_FAILED');
  }

  return c.json({ message: 'Mã OTP đã được gửi đến email của bạn', expiresIn: 300 });
});

authRoutes.post('/auth/verify-otp', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = verifyOtpSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message || 'Mã OTP không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const email = parsed.data.email.toLowerCase();
  const ok = await verifyAndConsumeOtp(c.env.DB, email, parsed.data.code, ['auth']);
  if (!ok) {
    throw new AppError('Mã OTP không đúng hoặc đã hết hạn', 400, 'INVALID_OTP');
  }

  return c.json({ verified: true, message: 'Xác thực OTP thành công' });
});

authRoutes.post('/auth/start', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message || 'Dữ liệu khởi tạo không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const data = parsed.data;
  const config = c.get('config');
  const nowIso = new Date().toISOString();

  // Check if called by an authenticated Google user completing onboarding
  let authUser: UserRow | null = null;
  const authHeader = c.req.header('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const tokenPayload = await verifyJwt<{ userId?: string; id?: string }>(
      authHeader.slice(7).trim(),
      config.JWT_SECRET,
    );
    const uid = tokenPayload?.userId ?? tokenPayload?.id;
    if (uid) {
      authUser = await findUserById(c.env.DB, String(uid));
      if (authUser && authUser.status === 'blocked') {
        throw new AppError('Tài khoản đã bị khóa', 403, 'USER_BLOCKED');
      }
    }
  }

  if (authUser) {
    const couple = await createAndJoinCouple(c.env.DB, {
      userId: authUser.id,
      displayName: data.displayName,
      partnerName: data.partnerName,
      coupleCode: data.coupleCode,
      loveStartDate: data.loveStartDate,
      nowIso,
    });

    const members = await findCoupleMembers(c.env.DB, couple.id);
    const partner = members.find((m) => m.id !== authUser!.id) ?? null;
    const effectivePartnerName = data.partnerName || partner?.display_name || authUser.partner_name;

    await execute(
      c.env.DB,
      `UPDATE users
       SET display_name = ?,
           partner_name = ?,
           partner_avatar_url = COALESCE(partner_avatar_url, ?),
           couple_id = ?,
           trusted_devices_json = ?,
           updated_at = ?
       WHERE id = ?`,
      [
        data.displayName,
        effectivePartnerName,
        partner?.avatar_url ?? null,
        couple.id,
        upsertTrustedDevice(authUser.trusted_devices_json, data.deviceId, nowIso),
        nowIso,
        authUser.id,
      ],
    );

    if (partner && (!partner.partner_name || partner.partner_avatar_url !== authUser.avatar_url)) {
      await execute(
        c.env.DB,
        `UPDATE users
         SET partner_name = CASE WHEN partner_name = '' THEN ? ELSE partner_name END,
             partner_avatar_url = COALESCE(partner_avatar_url, ?),
             updated_at = ?
         WHERE id = ?`,
        [data.displayName, authUser.avatar_url, nowIso, partner.id],
      );
    }

    const updatedUser = (await findUserById(c.env.DB, authUser.id))!;
    const response = await buildAuthPayload(c.env.DB, config.JWT_SECRET, updatedUser, couple, false);
    return c.json(response, 200);
  }

  // Standard email + password registration flow
  if (!data.email || !data.password) {
    throw new AppError('Vui lòng nhập đầy đủ email và mật khẩu', 400, 'VALIDATION_ERROR');
  }

  const normalizedEmail = data.email.toLowerCase();
  const existingUser = await findUserByEmailOrAlias(c.env.DB, normalizedEmail);
  if (existingUser) {
    throw new AppError('Email đã được đăng ký', 409, 'EMAIL_EXISTS');
  }

  let otpVerified: boolean;
  if (data.otpCode) {
    otpVerified = await verifyAndConsumeOtp(c.env.DB, normalizedEmail, data.otpCode, ['auth']);
  } else {
    const recentVerified = await queryOne<OtpCodeRow>(
      c.env.DB,
      `SELECT * FROM otp_codes
       WHERE lower(email) = ? AND purpose = 'auth' AND verified = 1 AND expires_at > ?
       ORDER BY created_at DESC LIMIT 1`,
      [normalizedEmail, new Date(Date.now() - 15 * 60 * 1000).toISOString()],
    );
    otpVerified = Boolean(recentVerified);
  }

  if (!otpVerified) {
    throw new AppError('Vui lòng xác thực mã OTP hợp lệ trước khi tạo tài khoản', 400, 'INVALID_OTP');
  }

  const userId = generateId();
  const couple = await createAndJoinCouple(c.env.DB, {
    userId,
    displayName: data.displayName,
    partnerName: data.partnerName,
    coupleCode: data.coupleCode,
    loveStartDate: data.loveStartDate,
    nowIso,
  });

  const members = await findCoupleMembers(c.env.DB, couple.id);
  const partner = members.find((m) => m.id !== userId) ?? null;
  const effectivePartnerName = data.partnerName || partner?.display_name || '';
  const passwordHash = await hashPassword(data.password);
  const trustedJson = upsertTrustedDevice('[]', data.deviceId, nowIso);

  await execute(
    c.env.DB,
    `INSERT INTO users (
      id, display_name, partner_name, email, email_aliases_json, password_hash,
      partner_avatar_url, trusted_devices_json, fcm_tokens_json,
      reminder_enabled, reminder_time, reminder_timezone, role, status, couple_id,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, '[]', ?, ?, ?, '[]', 0, '20:30', 'Asia/Ho_Chi_Minh', 'user', 'active', ?, ?, ?)`,
    [
      userId,
      data.displayName,
      effectivePartnerName,
      normalizedEmail,
      passwordHash,
      partner?.avatar_url ?? null,
      trustedJson,
      couple.id,
      nowIso,
      nowIso,
    ],
  );

  if (partner && !partner.partner_name) {
    await execute(
      c.env.DB,
      'UPDATE users SET partner_name = ?, updated_at = ? WHERE id = ?',
      [data.displayName, nowIso, partner.id],
    );
  }

  const createdUser = (await findUserById(c.env.DB, userId))!;
  const response = await buildAuthPayload(c.env.DB, config.JWT_SECRET, createdUser, couple, false);
  return c.json(response, 201);
});

authRoutes.post('/auth/login/send-otp', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSendOtpSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message || 'Thông tin đăng nhập không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const email = parsed.data.email.toLowerCase();
  const user = await findUserByEmailOrAlias(c.env.DB, email);
  if (!user || !user.password_hash) {
    throw new AppError('Email hoặc mật khẩu không chính xác', 401, 'INVALID_CREDENTIALS');
  }
  if (user.status === 'blocked') {
    throw new AppError('Tài khoản đã bị khóa', 403, 'USER_BLOCKED');
  }

  const passwordValid = await verifyPassword(parsed.data.password, user.password_hash);
  if (!passwordValid) {
    throw new AppError('Email hoặc mật khẩu không chính xác', 401, 'INVALID_CREDENTIALS');
  }

  await checkOtpCooldown(c.env.DB, email, 'login');

  const code = generateOtpCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString();

  await execute(
    c.env.DB,
    `INSERT INTO otp_codes (id, email, code, purpose, expires_at, verified, created_at)
     VALUES (?, ?, ?, 'login', ?, 0, ?)`,
    [generateId(), email, code, expiresAt, now.toISOString()],
  );

  const sent = await sendOtpEmail(c.get('config'), email, code, 'login');
  if (!sent) {
    throw new AppError('Không thể gửi mã OTP lúc này', 500, 'EMAIL_SEND_FAILED');
  }

  return c.json({ message: 'Mã OTP đăng nhập đã được gửi đến email của bạn', expiresIn: 300 });
});

authRoutes.post('/auth/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message || 'Thông tin đăng nhập không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const email = parsed.data.email.toLowerCase();
  const user = await findUserByEmailOrAlias(c.env.DB, email);
  if (!user || !user.password_hash) {
    throw new AppError('Email hoặc mật khẩu không chính xác', 401, 'INVALID_CREDENTIALS');
  }
  if (user.status === 'blocked') {
    throw new AppError('Tài khoản đã bị khóa', 403, 'USER_BLOCKED');
  }

  const passwordValid = await verifyPassword(parsed.data.password, user.password_hash);
  if (!passwordValid) {
    throw new AppError('Email hoặc mật khẩu không chính xác', 401, 'INVALID_CREDENTIALS');
  }

  const trustedDevices = parseJsonSafe<Array<string | TrustedDevice>>(user.trusted_devices_json, []);
  const isTrustedDevice = Boolean(
    parsed.data.deviceId &&
      trustedDevices.some((d) =>
        typeof d === 'string' ? d === parsed.data.deviceId : d?.deviceId === parsed.data.deviceId,
      ),
  );

  const nowIso = new Date().toISOString();
  if (!isTrustedDevice) {
    if (!parsed.data.otpCode) {
      throw new AppError('Vui lòng nhập mã OTP xác thực thiết bị', 400, 'OTP_REQUIRED');
    }
    const ok = await verifyAndConsumeOtp(c.env.DB, email, parsed.data.otpCode, ['login', 'auth']);
    if (!ok) {
      throw new AppError('Mã OTP không đúng hoặc đã hết hạn', 400, 'INVALID_OTP');
    }
    if (parsed.data.deviceId) {
      await execute(
        c.env.DB,
        'UPDATE users SET trusted_devices_json = ?, updated_at = ? WHERE id = ?',
        [upsertTrustedDevice(user.trusted_devices_json, parsed.data.deviceId, nowIso), nowIso, user.id],
      );
    }
  } else if (parsed.data.deviceId) {
    await execute(
      c.env.DB,
      'UPDATE users SET trusted_devices_json = ?, updated_at = ? WHERE id = ?',
      [upsertTrustedDevice(user.trusted_devices_json, parsed.data.deviceId, nowIso), nowIso, user.id],
    );
  }

  const couple = user.couple_id ? await findCoupleById(c.env.DB, user.couple_id) : null;
  const freshUser = (await findUserById(c.env.DB, user.id))!;
  const response = await buildAuthPayload(
    c.env.DB,
    c.get('config').JWT_SECRET,
    freshUser,
    couple,
    !freshUser.couple_id,
  );
  return c.json(response, 200);
});

authRoutes.post('/auth/google', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = googleLoginSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message || 'Google token không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const config = c.get('config');
  let payload;
  try {
    payload = await verifyGoogleIdToken(parsed.data.credential, config.GOOGLE_CLIENT_ID);
  } catch (err) {
    throw new AppError(err instanceof Error ? err.message : 'Xác thực Google thất bại', 401, 'INVALID_GOOGLE_TOKEN');
  }

  const normalizedEmail = payload.email?.trim().toLowerCase() ?? null;
  let user = await queryOne<UserRow>(
    c.env.DB,
    'SELECT * FROM users WHERE google_id = ? LIMIT 1',
    [payload.sub],
  );
  if (!user && normalizedEmail) {
    user = await findUserByEmailOrAlias(c.env.DB, normalizedEmail);
  }

  const nowIso = new Date().toISOString();

  if (user) {
    if (user.status === 'blocked') {
      throw new AppError('Tài khoản đã bị khóa', 403, 'USER_BLOCKED');
    }
    const nextAvatar = user.avatar_url || payload.picture || null;
    await execute(
      c.env.DB,
      `UPDATE users
       SET google_id = COALESCE(google_id, ?),
           avatar_url = ?,
           trusted_devices_json = ?,
           updated_at = ?
       WHERE id = ?`,
      [
        payload.sub,
        nextAvatar,
        upsertTrustedDevice(user.trusted_devices_json, parsed.data.deviceId, nowIso),
        nowIso,
        user.id,
      ],
    );
    const updatedUser = (await findUserById(c.env.DB, user.id))!;
    const couple = updatedUser.couple_id ? await findCoupleById(c.env.DB, updatedUser.couple_id) : null;
    return c.json(
      await buildAuthPayload(c.env.DB, config.JWT_SECRET, updatedUser, couple, !updatedUser.couple_id),
      200,
    );
  }

  const newUserId = generateId();
  const displayName = payload.name?.trim() || normalizedEmail?.split('@')[0] || 'Người dùng mới';
  await execute(
    c.env.DB,
    `INSERT INTO users (
      id, display_name, partner_name, email, email_aliases_json, google_id, avatar_url,
      trusted_devices_json, fcm_tokens_json, reminder_enabled, reminder_time,
      reminder_timezone, role, status, couple_id, created_at, updated_at
    ) VALUES (?, ?, '', ?, '[]', ?, ?, ?, '[]', 0, '20:30', 'Asia/Ho_Chi_Minh', 'user', 'active', NULL, ?, ?)`,
    [
      newUserId,
      displayName,
      normalizedEmail,
      payload.sub,
      payload.picture || null,
      upsertTrustedDevice('[]', parsed.data.deviceId, nowIso),
      nowIso,
      nowIso,
    ],
  );

  const createdUser = (await findUserById(c.env.DB, newUserId))!;
  return c.json(await buildAuthPayload(c.env.DB, config.JWT_SECRET, createdUser, null, true), 201);
});
