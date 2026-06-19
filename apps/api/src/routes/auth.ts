import bcrypt from 'bcryptjs';
import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';
import { Couple } from '../db/models/Couple';
import { User } from '../db/models/User';

// Safe user shape to return in responses (no passwordHash)
function toSafeUser(user: InstanceType<typeof User>) {
  return {
    id: user._id.toString(),
    displayName: user.displayName,
    partnerName: user.partnerName,
    email: user.email,
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

const startBodySchema = z.object({
  displayName: z.string().min(1),
  partnerName: z.string().min(1),
  coupleCode: z.string().min(1),
  loveStartDate: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: 'Invalid date',
  }),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  deviceId: z.string().optional(),
});

const loginBodySchema = z.object({
  email: z.string().email().optional(),
  password: z.string().optional(),
  deviceId: z.string().optional(),
  coupleCode: z.string().optional(),
});

export default async function authRoutes(app: FastifyInstance): Promise<void> {
  // Apply a tighter rate limit to all auth routes
  app.addHook('onRequest', async (request, reply) => {
    // Individual rate limit applied via plugin config, this is a placeholder hook
    void request;
    void reply;
  });

  /**
   * POST /auth/start
   * Onboarding: create user and join or create a couple.
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
      } = parsed.data;

      const normalizedCode = coupleCode.toUpperCase();

      // Find or create the couple
      let couple = await Couple.findOne({ code: normalizedCode });
      if (!couple) {
        couple = await Couple.create({
          code: normalizedCode,
          loveStartDate: new Date(loveStartDate),
          memberIds: [],
          streak: 0,
        });
      }

      // Check capacity
      if (couple.memberIds.length >= 2) {
        // If user already in couple, allow re-onboarding
        // (handled by finding existing user below — skip for new join)
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
        email: email ?? undefined,
        passwordHash,
        trustedDevices: deviceId ? [deviceId] : [],
        role: 'user',
        status: 'active',
        coupleId: couple._id,
      });

      // Add user to couple
      couple.memberIds.push(user._id);
      await couple.save();

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
   * POST /auth/login
   * Login an existing user by email+password or deviceId+coupleCode.
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

      const { email, password, deviceId, coupleCode } = parsed.data;

      let user: InstanceType<typeof User> | null = null;

      if (email && password) {
        // Email + password login
        user = await User.findOne({ email });
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
   * POST /auth/request-code
   * Stub for email verification feature.
   */
  app.post('/auth/request-code', async (_request, reply) => {
    return reply.status(200).send({ message: 'Tính năng sắp ra mắt' });
  });
}
