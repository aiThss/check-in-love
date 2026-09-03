import bcrypt from 'bcryptjs';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { OtpCode } from '../db/models/OtpCode';
import { User } from '../db/models/User';
import { isEmailConfigured, sendOtpEmail } from '../services/email';

const sendResetOtpBodySchema = z.object({
  email: z.string().email(),
});

const confirmResetBodySchema = z.object({
  email: z.string().email(),
  otpCode: z.string().regex(/^\d{6}$/, 'Mã xác thực phải gồm 6 chữ số'),
  newPassword: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự').max(128),
});

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default async function passwordResetRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /auth/password-reset/send-otp
   * Send a reset code without revealing whether an account exists.
   */
  app.post(
    '/auth/password-reset/send-otp',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '10 minutes',
        },
      },
    },
    async (request, reply) => {
      const parsed = sendResetOtpBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.errors[0].message,
          code: 'VALIDATION_ERROR',
        });
      }

      if (!isEmailConfigured()) {
        return reply.status(503).send({
          error: 'Tính năng gửi email chưa được cấu hình',
          code: 'EMAIL_NOT_CONFIGURED',
        });
      }

      const email = parsed.data.email.toLowerCase();
      const user = await User.findOne({
        $or: [{ email }, { email_aliases: email }],
      });

      await OtpCode.deleteMany({ email, purpose: 'password-reset' });

      if (user) {
        const code = generateOtp();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await OtpCode.create({
          email,
          code,
          purpose: 'password-reset',
          expiresAt,
          verified: false,
        });

        try {
          await sendOtpEmail(email, code);
        } catch (err) {
          app.log.error(err, 'Failed to send password reset OTP email');
          return reply.status(500).send({
            error: 'Không thể gửi email đặt lại mật khẩu. Vui lòng thử lại.',
            code: 'EMAIL_SEND_FAILED',
          });
        }
      }

      return reply.status(200).send({
        message: 'Nếu email đã được đăng ký, mã đặt lại mật khẩu sẽ được gửi tới hộp thư của bạn.',
        expiresIn: 600,
      });
    },
  );

  /**
   * POST /auth/password-reset/confirm
   * Verify the reset code and replace the account password.
   */
  app.post(
    '/auth/password-reset/confirm',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '10 minutes',
        },
      },
    },
    async (request, reply) => {
      const parsed = confirmResetBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.errors[0].message,
          code: 'VALIDATION_ERROR',
        });
      }

      const { otpCode, newPassword } = parsed.data;
      const email = parsed.data.email.toLowerCase();

      const [user, resetOtp] = await Promise.all([
        User.findOne({
          $or: [{ email }, { email_aliases: email }],
        }),
        OtpCode.findOne({
          email,
          code: otpCode,
          purpose: 'password-reset',
          expiresAt: { $gt: new Date() },
        }),
      ]);

      if (!user || !resetOtp) {
        return reply.status(400).send({
          error: 'Mã xác thực không hợp lệ hoặc đã hết hạn',
          code: 'OTP_INVALID',
        });
      }

      user.passwordHash = await bcrypt.hash(newPassword, 12);
      user.trustedDevices = [];
      await user.save();

      const accountEmails = [user.email, ...(user.email_aliases ?? [])].filter(
        (value): value is string => Boolean(value),
      );

      await OtpCode.deleteMany({
        email: { $in: accountEmails },
        purpose: { $in: ['password-reset', 'login'] },
      });

      return reply.status(200).send({
        message: 'Đặt lại mật khẩu thành công. Hãy đăng nhập bằng mật khẩu mới.',
      });
    },
  );
}
