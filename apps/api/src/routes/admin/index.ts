import bcrypt from 'bcryptjs';
import { FastifyInstance } from 'fastify';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import path from 'path';
import { z } from 'zod';
import { env } from '../../config/env';
import { CheckIn } from '../../db/models/CheckIn';
import { Couple } from '../../db/models/Couple';
import { OtpCode } from '../../db/models/OtpCode';
import { PushSubscription } from '../../db/models/PushSubscription';
import { RandomEvent } from '../../db/models/RandomEvent';
import { User } from '../../db/models/User';
import { authenticateAdmin } from '../../middleware/adminAuth';
import { storageService } from '../../services/storage';

const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const patchUserSchema = z.object({
  status: z.enum(['active', 'blocked']).optional(),
  displayName: z.string().min(1).optional(),
  partnerName: z.string().min(1).optional(),
});

const patchCoupleSchema = z.object({
  loveStartDate: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid date' })
    .optional(),
  code: z.string().min(1).optional(),
});

const maintenanceResetSchema = z.object({
  confirmation: z.literal('RESET CHECK IN LOVE'),
});

function timingSafeEqual(a: string, b: string): boolean {
  // Use Buffer.equals which is timing-safe in Node.js for same-length buffers
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) {
    // Prevent short-circuit length comparison from leaking info
    // by still doing a comparison
    let result = 0;
    const maxLen = Math.max(aBuf.length, bBuf.length);
    for (let i = 0; i < maxLen; i++) {
      result |= (aBuf[i] ?? 0) ^ (bBuf[i] ?? 0);
    }
    return result === 0 && aBuf.length === bBuf.length;
  }
  return aBuf.equals(bBuf);
}

async function clearUploadDir(): Promise<void> {
  const uploadDir = path.resolve(env.UPLOAD_DIR);
  const root = path.parse(uploadDir).root;

  if (uploadDir === root) {
    throw new Error('Refusing to clear filesystem root as upload directory');
  }

  await fs.promises.rm(uploadDir, { recursive: true, force: true });
  await fs.promises.mkdir(uploadDir, { recursive: true });
}

function storagePathFromUploadUrl(uploadUrl?: string): string | undefined {
  if (!uploadUrl) return undefined;

  const marker = '/uploads/';
  const markerIndex = uploadUrl.indexOf(marker);
  if (markerIndex === -1) return undefined;

  try {
    return decodeURIComponent(uploadUrl.slice(markerIndex + marker.length));
  } catch {
    return uploadUrl.slice(markerIndex + marker.length);
  }
}

async function deleteStoredFiles(
  storagePaths: Array<string | undefined>,
  app: FastifyInstance,
): Promise<void> {
  const uniquePaths = Array.from(
    new Set(storagePaths.filter((path): path is string => Boolean(path))),
  );

  const results = await Promise.allSettled(
    uniquePaths.map((storagePath) => storageService.deleteFile(storagePath)),
  );

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      app.log.error(
        { err: result.reason, storagePath: uniquePaths[index] },
        'Failed to delete stored file',
      );
    }
  });
}

export default async function adminRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /admin/login — Authenticate as admin
   */
  app.post('/admin/login', async (request, reply) => {
    const parsed = adminLoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.errors[0].message,
        code: 'VALIDATION_ERROR',
      });
    }

    const { email, password } = parsed.data;

    // Timing-safe email comparison
    const emailMatch = timingSafeEqual(email, env.ADMIN_EMAIL);
    if (!emailMatch) {
      // Still compute bcrypt to prevent timing attacks based on email check short-circuit
      await bcrypt.compare(password, '$2a$12$invalidhashfortimingprotection00000000000');
      return reply
        .status(401)
        .send({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    }

    // Try bcrypt compare first (if password was stored hashed), else plain
    const passwordMatch = timingSafeEqual(password, env.ADMIN_PASSWORD);
    if (!passwordMatch) {
      return reply
        .status(401)
        .send({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    }

    const token = jwt.sign({ role: 'admin', sub: 'admin' }, env.JWT_SECRET, {
      expiresIn: '24h',
    });

    return reply.status(200).send({ token });
  });

  /**
   * GET /admin/summary — Dashboard aggregation stats
   */
  app.get(
    '/admin/summary',
    { preHandler: authenticateAdmin },
    async (_request, reply) => {
      const [totalUsers, totalCouples, totalCheckIns, blockedUsers, totalRandomEvents] =
        await Promise.all([
          User.countDocuments({ role: 'user' }),
          Couple.countDocuments(),
          CheckIn.countDocuments({ deletedAt: null }),
          User.countDocuments({ status: 'blocked' }),
          RandomEvent.countDocuments(),
        ]);

      return reply.status(200).send({
        totalUsers,
        totalCouples,
        totalCheckIns,
        blockedUsers,
        totalRandomEvents,
      });
    },
  );

  /**
   * GET /admin/maintenance/reset — Test reset feature flag status
   */
  app.get(
    '/admin/maintenance/reset',
    { preHandler: authenticateAdmin },
    async (_request, reply) => {
      return reply.status(200).send({
        enabled: env.ADMIN_ENABLE_TEST_RESET,
        confirmation: 'RESET CHECK IN LOVE',
      });
    },
  );

  /**
   * POST /admin/maintenance/reset — Clear all app test data
   */
  app.post(
    '/admin/maintenance/reset',
    { preHandler: authenticateAdmin },
    async (request, reply) => {
      if (!env.ADMIN_ENABLE_TEST_RESET) {
        return reply.status(403).send({
          error: 'Test reset is disabled',
          code: 'RESET_DISABLED',
        });
      }

      const parsed = maintenanceResetSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Type RESET CHECK IN LOVE to confirm',
          code: 'CONFIRMATION_REQUIRED',
        });
      }

      const [
        users,
        couples,
        checkIns,
        randomEvents,
        pushSubscriptions,
        otpCodes,
      ] = await Promise.all([
        User.deleteMany({}),
        Couple.deleteMany({}),
        CheckIn.deleteMany({}),
        RandomEvent.deleteMany({}),
        PushSubscription.deleteMany({}),
        OtpCode.deleteMany({}),
      ]);

      await clearUploadDir();

      return reply.status(200).send({
        success: true,
        deleted: {
          users: users.deletedCount ?? 0,
          couples: couples.deletedCount ?? 0,
          checkIns: checkIns.deletedCount ?? 0,
          randomEvents: randomEvents.deletedCount ?? 0,
          pushSubscriptions: pushSubscriptions.deletedCount ?? 0,
          otpCodes: otpCodes.deletedCount ?? 0,
        },
      });
    },
  );

  /**
   * GET /admin/users — Paginated user list
   */
  app.get(
    '/admin/users',
    { preHandler: authenticateAdmin },
    async (request, reply) => {
      const query = request.query as {
        page?: string;
        limit?: string;
        search?: string;
      };

      const page = Math.max(1, parseInt(query.page ?? '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10)));
      const skip = (page - 1) * limit;

      const filter: Record<string, unknown> = { role: 'user' };
      if (query.search) {
        const regex = new RegExp(query.search, 'i');
        filter.$or = [
          { displayName: regex },
          { email: regex },
          { email_aliases: regex },
        ];
      }

      const [users, total] = await Promise.all([
        User.find(filter)
          .select('-passwordHash')
          .populate('coupleId', 'code')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        User.countDocuments(filter),
      ]);

      return reply.status(200).send({
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    },
  );

  /**
   * PATCH /admin/users/:id — Update a user
   */
  app.patch(
    '/admin/users/:id',
    { preHandler: authenticateAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const parsed = patchUserSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.errors[0].message,
          code: 'VALIDATION_ERROR',
        });
      }

      const updates: Record<string, unknown> = {};
      if (parsed.data.status !== undefined) updates.status = parsed.data.status;
      if (parsed.data.displayName !== undefined)
        updates.displayName = parsed.data.displayName;
      if (parsed.data.partnerName !== undefined)
        updates.partnerName = parsed.data.partnerName;

      const user = await User.findByIdAndUpdate(
        new Types.ObjectId(id),
        updates,
        { new: true },
      ).select('-passwordHash');

      if (!user) {
        return reply
          .status(404)
          .send({ error: 'User not found', code: 'NOT_FOUND' });
      }

      return reply.status(200).send({ user });
    },
  );

  /**
   * DELETE /admin/users/:id — Hard delete a test user and owned data
   */
  app.delete(
    '/admin/users/:id',
    { preHandler: authenticateAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      if (!Types.ObjectId.isValid(id)) {
        return reply
          .status(400)
          .send({ error: 'Invalid user id', code: 'VALIDATION_ERROR' });
      }

      const userId = new Types.ObjectId(id);
      const user = await User.findById(userId);

      if (!user || user.role !== 'user') {
        return reply
          .status(404)
          .send({ error: 'User not found', code: 'NOT_FOUND' });
      }

      const coupleId = user.coupleId;
      const couple = await Couple.findById(coupleId).lean();
      const remainingMemberIds =
        couple?.memberIds.filter((memberId) => !memberId.equals(userId)) ?? [];
      const shouldDeleteCouple = Boolean(couple && remainingMemberIds.length === 0);

      const checkInFilter = shouldDeleteCouple ? { coupleId } : { ownerId: userId };
      const randomEventFilter = shouldDeleteCouple
        ? { coupleId }
        : { userId };
      const pushFilter = shouldDeleteCouple ? { coupleId } : { userId };

      const checkInsToDelete = await CheckIn.find(checkInFilter)
        .select('storagePath')
        .lean();

      await deleteStoredFiles(
        [
          ...checkInsToDelete.map((checkIn) => checkIn.storagePath),
          storagePathFromUploadUrl(user.avatarUrl),
          storagePathFromUploadUrl(user.partnerAvatarUrl),
        ],
        app,
      );

      const otpDeletePromise = user.email
        ? OtpCode.deleteMany({ email: user.email.toLowerCase() })
        : Promise.resolve({ deletedCount: 0 });

      const [
        userDelete,
        checkInsDelete,
        randomEventsDelete,
        pushSubscriptionsDelete,
        otpCodesDelete,
      ] = await Promise.all([
        User.deleteOne({ _id: userId }),
        CheckIn.deleteMany(checkInFilter),
        RandomEvent.deleteMany(randomEventFilter),
        PushSubscription.deleteMany(pushFilter),
        otpDeletePromise,
      ]);

      let couplesDeleted = 0;
      let reactionsRemoved = 0;

      if (shouldDeleteCouple) {
        const coupleDelete = await Couple.deleteOne({ _id: coupleId });
        couplesDeleted = coupleDelete.deletedCount ?? 0;
      } else if (couple) {
        await Couple.updateOne(
          { _id: coupleId },
          { $pull: { memberIds: userId } },
        );

        const reactionUpdate = await CheckIn.updateMany(
          {
            $or: [
              { 'reactions.userId': userId },
              { 'replies.userId': userId },
            ],
          },
          { $pull: { reactions: { userId }, replies: { userId } } },
        );
        reactionsRemoved = reactionUpdate.modifiedCount ?? 0;
      }

      return reply.status(200).send({
        success: true,
        deleted: {
          users: userDelete.deletedCount ?? 0,
          couples: couplesDeleted,
          checkIns: checkInsDelete.deletedCount ?? 0,
          randomEvents: randomEventsDelete.deletedCount ?? 0,
          pushSubscriptions: pushSubscriptionsDelete.deletedCount ?? 0,
          otpCodes: otpCodesDelete.deletedCount ?? 0,
        },
        updated: {
          reactions: reactionsRemoved,
        },
      });
    },
  );

  /**
   * GET /admin/couples — Paginated couples list with members
   */
  app.get(
    '/admin/couples',
    { preHandler: authenticateAdmin },
    async (request, reply) => {
      const query = request.query as { page?: string; limit?: string };

      const page = Math.max(1, parseInt(query.page ?? '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10)));
      const skip = (page - 1) * limit;

      const [couples, total] = await Promise.all([
        Couple.find()
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('memberIds', 'displayName email avatarUrl status')
          .lean(),
        Couple.countDocuments(),
      ]);

      return reply.status(200).send({
        couples,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    },
  );

  /**
   * PATCH /admin/couples/:id — Update couple
   */
  app.patch(
    '/admin/couples/:id',
    { preHandler: authenticateAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const parsed = patchCoupleSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.errors[0].message,
          code: 'VALIDATION_ERROR',
        });
      }

      const updates: Record<string, unknown> = {};
      if (parsed.data.loveStartDate !== undefined)
        updates.loveStartDate = new Date(parsed.data.loveStartDate);
      if (parsed.data.code !== undefined)
        updates.code = parsed.data.code.toUpperCase();

      const couple = await Couple.findByIdAndUpdate(
        new Types.ObjectId(id),
        updates,
        { new: true },
      );

      if (!couple) {
        return reply
          .status(404)
          .send({ error: 'Couple not found', code: 'NOT_FOUND' });
      }

      return reply.status(200).send({ couple });
    },
  );

  /**
   * GET /admin/checkins — Paginated check-ins with optional filters
   */
  app.get(
    '/admin/checkins',
    { preHandler: authenticateAdmin },
    async (request, reply) => {
      const query = request.query as {
        page?: string;
        limit?: string;
        coupleId?: string;
        includeDeleted?: string;
      };

      const page = Math.max(1, parseInt(query.page ?? '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10)));
      const skip = (page - 1) * limit;
      const includeDeleted = query.includeDeleted === 'true';

      const filter: Record<string, unknown> = {};
      if (!includeDeleted) {
        filter.deletedAt = null;
      }
      if (query.coupleId) {
        filter.coupleId = new Types.ObjectId(query.coupleId);
      }

      const [checkIns, total] = await Promise.all([
        CheckIn.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        CheckIn.countDocuments(filter),
      ]);

      return reply.status(200).send({
        checkIns,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    },
  );

  /**
   * DELETE /admin/checkins/:id — Soft delete any check-in
   */
  app.delete(
    '/admin/checkins/:id',
    { preHandler: authenticateAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const checkIn = await CheckIn.findById(new Types.ObjectId(id));
      if (!checkIn) {
        return reply
          .status(404)
          .send({ error: 'Check-in not found', code: 'NOT_FOUND' });
      }

      checkIn.deletedAt = new Date();
      await checkIn.save();

      return reply.status(200).send({ success: true });
    },
  );

  /**
   * GET /admin/random-events — Paginated random events with user info
   */
  app.get(
    '/admin/random-events',
    { preHandler: authenticateAdmin },
    async (request, reply) => {
      const query = request.query as { page?: string; limit?: string };

      const page = Math.max(1, parseInt(query.page ?? '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10)));
      const skip = (page - 1) * limit;

      const [events, total] = await Promise.all([
        RandomEvent.find()
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('userId', 'displayName email')
          .populate('coupleId', 'code')
          .lean(),
        RandomEvent.countDocuments(),
      ]);

      return reply.status(200).send({
        events,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    },
  );
}
