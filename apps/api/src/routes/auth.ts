import bcrypt from 'bcryptjs';
import { FastifyInstance } from 'fastify';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';
import { OtpCode } from '../db/models/OtpCode';
import { Couple } from '../db/models/Couple';
import { User } from '../db/models/User';
import { isEmailConfigured, sendOtpEmail } from '../services/email';

// Safe user shape to return in responses (no passwordHash)
function toSafeUser(user: InstanceType<typeof User>) {
  return {
    id: user._id.toString(),
    displayName: user.displayName,
    partnerName: user.partnerName,
    email: user.email,
    email_aliases: user.email_aliases || [],
    avatarUrl: user.avatarUrl,
    partnerAvatarUrl: user.partnerAvatarUrl,
    role: user.role,
    status: user.status,
    coupleId: user.coupleId.toString(),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function signToken(userId: string, coupleId: string, role: string): string {
  return jwt.sign({ userId, coupleId, role }, env.JWT_SECRET, {
    expiresIn: '30d',
  });
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const startBodySchema = z.object({
  displayName: z.string().min(1),
  partnerName: z.string().min(1),
  coupleCode: z.string().min(1),
  loveStartDate: z
    .string()
    .optional()
    .refine((v) => !v || !isNaN(Date.parse(v)), {
      message: 'Invalid date',
    }),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  deviceId: z.string().optional(),
  otpCode: z.string().length(6).optional(),
});

const loginBodySchema = z.object({
  email: z.string().email().optional(),
  password: z.string().optional(),
  otpCode: z.string().length(6).optional(),
  deviceId: z.string().optional(),
  coupleCode: z.string().optional(),
});

const loginSendOtpBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const googleLoginBodySchema = z.object({
  credential: z.string().min(1).max(5000),
});

const sendOtpBodySchema = z.object({
  email: z.string().email(),
});

const verifyOtpBodySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export default async function authRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /auth/send-otp
   * Generate and send a 6-digit OTP code to the given email.
   */
  app.post(
    '/auth/send-otp',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '10 minutes',
        },
      },
    },
    async (request, reply) => {
      const parsed = sendOtpBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.errors[0].message,
          code: 'VALIDATION_ERROR',
        });
      }

      const { email } = parsed.data;

      // Check if email is already registered
      const existingUser = await User.findOne({
        $or: [
          { email: email.toLowerCase() },
          { email_aliases: email.toLowerCase() },
        ],
      });
      if (existingUser) {
        return reply.status(409).send({
          error: 'Email này đã được sử dụng',
          code: 'EMAIL_ALREADY_EXISTS',
        });
      }

      // Check if Gmail is configured
      if (!isEmailConfigured()) {
        return reply.status(503).send({
          error: 'Tính năng gửi email chưa được cấu hình',
          code: 'EMAIL_NOT_CONFIGURED',
        });
      }

      // Invalidate any existing OTPs for this email
      await OtpCode.deleteMany({ email: email.toLowerCase(), purpose: 'signup' });

      // Generate new OTP
      const code = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await OtpCode.create({
        email: email.toLowerCase(),
        code,
        purpose: 'signup',
        expiresAt,
        verified: false,
      });

      // Send email
      try {
        await sendOtpEmail(email, code);
      } catch (err) {
        app.log.error(err, 'Failed to send OTP email');
        return reply.status(500).send({
          error: 'Không thể gửi email. Vui lòng kiểm tra lại địa chỉ email.',
          code: 'EMAIL_SEND_FAILED',
        });
      }

      return reply.status(200).send({
        message: `Mã xác thực đã được gửi tới ${email}`,
        expiresIn: 600,
      });
    },
  );

  /**
   * POST /auth/verify-otp
   * Verify the OTP code for a given email, mark it as verified.
   */
  app.post(
    '/auth/verify-otp',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '10 minutes',
        },
      },
    },
    async (request, reply) => {
      const parsed = verifyOtpBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.errors[0].message,
          code: 'VALIDATION_ERROR',
        });
      }

      const { email, code } = parsed.data;

      const otpDoc = await OtpCode.findOne({
        email: email.toLowerCase(),
        purpose: 'signup',
        verified: false,
        expiresAt: { $gt: new Date() },
      });

      if (!otpDoc) {
        return reply.status(400).send({
          error: 'Mã xác thực không hợp lệ hoặc đã hết hạn',
          code: 'OTP_INVALID',
        });
      }

      if (otpDoc.code !== code) {
        return reply.status(400).send({
          error: 'Mã xác thực không đúng',
          code: 'OTP_WRONG',
        });
      }

      // Mark as verified
      otpDoc.verified = true;
      await otpDoc.save();

      return reply.status(200).send({
        verified: true,
        message: 'Email đã được xác thực thành công',
      });
    },
  );

  /**
   * POST /auth/start
   * Onboarding: create user and join or create a couple.
   * If email is provided, requires OTP to have been verified.
   */
  app.post(
    '/auth/start',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const parsed = startBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.errors[0].message, code: 'VALIDATION_ERROR' });
      }

      const {
        displayName,
        partnerName,
        coupleCode,
        loveStartDate,
        email,
        password,
        deviceId,
        otpCode,
      } = parsed.data;

      // If email provided, verify OTP was completed
      if (email) {
        if (!otpCode) {
          return reply.status(400).send({
            error: 'Vui lòng xác thực email trước khi đăng ký',
            code: 'OTP_REQUIRED',
          });
        }

        // Check verified OTP exists
        const verifiedOtp = await OtpCode.findOne({
          email: email.toLowerCase(),
          code: otpCode,
          purpose: 'signup',
          verified: true,
          expiresAt: { $gt: new Date() },
        });

        if (!verifiedOtp) {
          return reply.status(400).send({
            error: 'Mã xác thực không hợp lệ. Vui lòng xác thực email lại.',
            code: 'OTP_NOT_VERIFIED',
          });
        }
      }

      const normalizedCode = coupleCode.toUpperCase();

      // Find or create the couple
      let couple = await Couple.findOne({ code: normalizedCode });
      if (!couple) {
        couple = await Couple.create({
          code: normalizedCode,
          loveStartDate: loveStartDate ? new Date(loveStartDate) : undefined,
          memberIds: [],
          streak: 0,
        });
      }

      // Check capacity
      if (couple.memberIds.length >= 2) {
        return reply.status(409).send({
          error: 'Couple is already full',
          code: 'COUPLE_FULL',
        });
      }

      // Hash password if provided
      let passwordHash: string | undefined;
      if (email && password) {
        passwordHash = await bcrypt.hash(password, 12);
      }

      // Create user
      const user = await User.create({
        displayName,
        partnerName,
        email: email ? email.toLowerCase() : undefined,
        passwordHash,
        trustedDevices: deviceId ? [deviceId] : [],
        role: 'user',
        status: 'active',
        coupleId: couple._id,
      });

      // Add user to couple
      couple.memberIds.push(user._id);
      await couple.save();

      // Clean up used OTP
      if (email) {
        await OtpCode.deleteMany({ email: email.toLowerCase(), purpose: 'signup' });
      }

      const token = signToken(
        user._id.toString(),
        couple._id.toString(),
        'user',
      );

      return reply.status(201).send({
        token,
        user: toSafeUser(user),
        couple: {
          id: couple._id.toString(),
          code: couple.code,
          loveStartDate: couple.loveStartDate,
          memberIds: couple.memberIds.map((id) => id.toString()),
          streak: couple.streak,
        },
      });
    },
  );

  /**
   * POST /auth/login/send-otp
   * Validate credentials and send a fresh OTP code for login.
   */
  app.post(
    '/auth/login/send-otp',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '10 minutes',
        },
      },
    },
    async (request, reply) => {
      const parsed = loginSendOtpBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.errors[0].message,
          code: 'VALIDATION_ERROR',
        });
      }

      const { email, password } = parsed.data;
      const user = await User.findOne({
        $or: [
          { email: email.toLowerCase() },
          { email_aliases: email.toLowerCase() },
        ],
      });

      if (!user || !user.passwordHash) {
        return reply
          .status(401)
          .send({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return reply
          .status(401)
          .send({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
      }

      if (user.status === 'blocked') {
        return reply
          .status(403)
          .send({ error: 'Tài khoản bị khóa', code: 'USER_BLOCKED' });
      }

      if (!isEmailConfigured()) {
        return reply.status(503).send({
          error: 'Tính năng gửi email chưa được cấu hình',
          code: 'EMAIL_NOT_CONFIGURED',
        });
      }

      await OtpCode.deleteMany({ email: email.toLowerCase(), purpose: 'login' });

      const code = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await OtpCode.create({
        email: email.toLowerCase(),
        code,
        purpose: 'login',
        expiresAt,
        verified: false,
      });

      try {
        await sendOtpEmail(email, code);
      } catch (err) {
        app.log.error(err, 'Failed to send login OTP email');
        return reply.status(500).send({
          error: 'Không thể gửi email. Vui lòng kiểm tra lại địa chỉ email.',
          code: 'EMAIL_SEND_FAILED',
        });
      }

      return reply.status(200).send({
        message: `Mã đăng nhập đã được gửi tới ${email}`,
        expiresIn: 600,
      });
    },
  );

  /**
   * POST /auth/login
   * Login an existing user by email+password+OTP or deviceId+coupleCode.
   */
  app.post(
    '/auth/login',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const parsed = loginBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.errors[0].message, code: 'VALIDATION_ERROR' });
      }

      const { email, password, otpCode, deviceId, coupleCode } = parsed.data;

      let user: InstanceType<typeof User> | null = null;

      if (email && password) {
        // Email + password + OTP login
        user = await User.findOne({
          $or: [
            { email: email.toLowerCase() },
            { email_aliases: email.toLowerCase() },
          ],
        });
        if (!user || !user.passwordHash) {
          return reply
            .status(401)
            .send({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
        }
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          return reply
            .status(401)
            .send({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
        }

        if (!otpCode) {
          return reply.status(400).send({
            error: 'Vui lòng nhập mã xác thực email',
            code: 'OTP_REQUIRED',
          });
        }

        const loginOtp = await OtpCode.findOne({
          email: email.toLowerCase(),
          code: otpCode,
          purpose: 'login',
          expiresAt: { $gt: new Date() },
        });

        if (!loginOtp) {
          return reply.status(400).send({
            error: 'Mã đăng nhập không hợp lệ hoặc đã hết hạn',
            code: 'OTP_INVALID',
          });
        }
      } else if (deviceId && coupleCode) {
        // Device ID + couple code login
        const normalizedCode = coupleCode.toUpperCase();
        const couple = await Couple.findOne({ code: normalizedCode });
        if (!couple) {
          return reply
            .status(401)
            .send({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
        }
        // Find user who is in the couple and has this deviceId
        user = await User.findOne({
          coupleId: couple._id,
          trustedDevices: deviceId,
        });
        if (!user) {
          return reply
            .status(401)
            .send({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
        }
      } else {
        return reply.status(400).send({
          error: 'Provide email+password or deviceId+coupleCode',
          code: 'VALIDATION_ERROR',
        });
      }

      if (user.status === 'blocked') {
        return reply
          .status(403)
          .send({ error: 'Tài khoản bị khóa', code: 'USER_BLOCKED' });
      }

      const couple = await Couple.findById(user.coupleId);
      if (!couple) {
        return reply
          .status(500)
          .send({ error: 'Couple not found', code: 'INTERNAL_ERROR' });
      }

      const token = signToken(
        user._id.toString(),
        couple._id.toString(),
        user.role,
      );

      if (email && otpCode) {
        await OtpCode.deleteMany({ email: email.toLowerCase(), purpose: 'login' });
      }

      return reply.status(200).send({
        token,
        user: toSafeUser(user),
        couple: {
          id: couple._id.toString(),
          code: couple.code,
          loveStartDate: couple.loveStartDate,
          memberIds: couple.memberIds.map((id) => id.toString()),
          streak: couple.streak,
          lastCheckinDate: couple.lastCheckinDate,
        },
      });
    },
  );

  /**
   * POST /auth/google
   * Verify a Google Identity Services ID token and log in an existing user.
   * Google accounts are linked by verified email on the first successful login.
   */
  app.post(
    '/auth/google',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const parsed = googleLoginBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.errors[0].message, code: 'VALIDATION_ERROR' });
      }

      const clientId = env.GOOGLE_CLIENT_ID;
      if (!clientId) {
        return reply.status(503).send({
          error: 'Đăng nhập Google chưa được cấu hình',
          code: 'GOOGLE_AUTH_NOT_CONFIGURED',
        });
      }

      let googlePayload;
      try {
        const googleClient = new OAuth2Client(clientId);
        const ticket = await googleClient.verifyIdToken({
          idToken: parsed.data.credential,
          audience: clientId,
        });
        googlePayload = ticket.getPayload();
      } catch (err) {
        app.log.warn({ err }, 'Google ID token verification failed');
        return reply.status(401).send({
          error: 'Tài khoản Google không hợp lệ hoặc đã hết hạn',
          code: 'GOOGLE_TOKEN_INVALID',
        });
      }

      const googleId = googlePayload?.sub;
      const googleEmail = googlePayload?.email?.trim().toLowerCase();
      if (
        !googlePayload ||
        !googleId ||
        !googleEmail ||
        googlePayload.email_verified !== true
      ) {
        return reply.status(401).send({
          error: 'Tài khoản Google chưa được xác thực email',
          code: 'GOOGLE_EMAIL_NOT_VERIFIED',
        });
      }

      let user = await User.findOne({ googleId });
      if (!user) {
        user = await User.findOne({
          $or: [{ email: googleEmail }, { email_aliases: googleEmail }],
        });
      }

      if (!user) {
        return reply.status(404).send({
          error: 'Email Google chưa được đăng ký trong Check IN Love',
          code: 'GOOGLE_ACCOUNT_NOT_REGISTERED',
        });
      }

      if (user.googleId && user.googleId !== googleId) {
        return reply.status(409).send({
          error: 'Email này đã được liên kết với tài khoản Google khác',
          code: 'GOOGLE_ACCOUNT_MISMATCH',
        });
      }

      if (user.status === 'blocked') {
        return reply
          .status(403)
          .send({ error: 'Tài khoản bị khóa', code: 'USER_BLOCKED' });
      }

      if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
      }

      const couple = await Couple.findById(user.coupleId);
      if (!couple) {
        return reply
          .status(500)
          .send({ error: 'Couple not found', code: 'INTERNAL_ERROR' });
      }

      const token = signToken(
        user._id.toString(),
        couple._id.toString(),
        user.role,
      );

      return reply.status(200).send({
        token,
        user: toSafeUser(user),
        couple: {
          id: couple._id.toString(),
          code: couple.code,
          loveStartDate: couple.loveStartDate,
          memberIds: couple.memberIds.map((id) => id.toString()),
          streak: couple.streak,
          lastCheckinDate: couple.lastCheckinDate,
        },
      });
    },
  );
}
