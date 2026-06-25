import { MultipartFile } from '@fastify/multipart';
import sharp from 'sharp';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../config/env';
import { Couple } from '../db/models/Couple';
import { User } from '../db/models/User';
import { authenticate } from '../middleware/auth';
import { storageService } from '../services/storage';

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

const patchMeSchema = z.object({
  displayName: z.string().min(1).optional(),
  partnerName: z.string().min(1).optional(),
  loveStartDate: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid date' })
    .optional(),
});

async function readMultipartBuffer(
  part: MultipartFile,
  maxBytes: number,
): Promise<{ buffer: Buffer; mimetype: string; filename: string }> {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of part.file) {
    total += chunk.length;
    if (total > maxBytes) {
      throw Object.assign(new Error('File too large'), { code: 'FILE_TOO_LARGE' });
    }
    chunks.push(chunk);
  }

  return {
    buffer: Buffer.concat(chunks),
    mimetype: part.mimetype,
    filename: part.filename,
  };
}

export default async function meRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /me — Current user profile + couple + partner info
   */
  app.get('/me', { preHandler: authenticate }, async (request, reply) => {
    const user = await User.findById(request.user.id);
    if (!user) {
      return reply.status(404).send({ error: 'User not found', code: 'NOT_FOUND' });
    }

    const couple = await Couple.findById(user.coupleId);
    if (!couple) {
      return reply.status(404).send({ error: 'Couple not found', code: 'NOT_FOUND' });
    }

    // Find partner: the other member of couple
    const partnerMemberId = couple.memberIds.find(
      (id) => id.toString() !== user._id.toString(),
    );

    let partnerUser: ReturnType<typeof toSafeUser> | undefined;
    if (partnerMemberId) {
      const partner = await User.findById(partnerMemberId);
      if (partner) {
        partnerUser = toSafeUser(partner);
      }
    }

    return reply.status(200).send({
      user: toSafeUser(user),
      couple: {
        id: couple._id.toString(),
        code: couple.code,
        loveStartDate: couple.loveStartDate,
        memberIds: couple.memberIds.map((id) => id.toString()),
        streak: couple.streak,
        lastCheckinDate: couple.lastCheckinDate,
      },
      partnerUser,
    });
  });

  /**
   * PATCH /me — Update profile fields
   */
  app.patch('/me', { preHandler: authenticate }, async (request, reply) => {
    const parsed = patchMeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: parsed.error.errors[0].message, code: 'VALIDATION_ERROR' });
    }

    const { displayName, partnerName, loveStartDate } = parsed.data;

    const user = await User.findById(request.user.id);
    if (!user) {
      return reply.status(404).send({ error: 'User not found', code: 'NOT_FOUND' });
    }

    if (displayName !== undefined) user.displayName = displayName;
    if (partnerName !== undefined) user.partnerName = partnerName;
    await user.save();

    if (loveStartDate !== undefined) {
      await Couple.findByIdAndUpdate(user.coupleId, {
        loveStartDate: new Date(loveStartDate),
      });
    }

    return reply.status(200).send({ user: toSafeUser(user) });
  });

  /**
   * POST /me/avatar — Upload user's own avatar
   */
  app.post(
    '/me/avatar',
    { preHandler: authenticate },
    async (request, reply) => {
      const maxBytes = env.MAX_UPLOAD_MB * 1024 * 1024;

      const data = await request.file();
      if (!data) {
        return reply
          .status(400)
          .send({ error: 'No file uploaded', code: 'NO_FILE' });
      }

      if (!data.mimetype.startsWith('image/')) {
        return reply
          .status(400)
          .send({ error: 'Only image files are allowed', code: 'INVALID_MIME' });
      }

      let { buffer } = await readMultipartBuffer(data, maxBytes);

      // Resize to max 512x512 while preserving aspect ratio
      buffer = await sharp(buffer)
        .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
        .toBuffer();

      const { url, storagePath } = await storageService.saveFile(
        buffer,
        data.filename,
        data.mimetype,
      );

      const user = await User.findByIdAndUpdate(
        request.user.id,
        { avatarUrl: url },
        { new: true },
      );

      return reply.status(200).send({
        avatarUrl: url,
        storagePath,
        user: user ? toSafeUser(user) : null,
      });
    },
  );

  /**
   * POST /me/partner-avatar — Upload partner's avatar
   */
  app.post(
    '/me/partner-avatar',
    { preHandler: authenticate },
    async (request, reply) => {
      const maxBytes = env.MAX_UPLOAD_MB * 1024 * 1024;

      const data = await request.file();
      if (!data) {
        return reply
          .status(400)
          .send({ error: 'No file uploaded', code: 'NO_FILE' });
      }

      if (!data.mimetype.startsWith('image/')) {
        return reply
          .status(400)
          .send({ error: 'Only image files are allowed', code: 'INVALID_MIME' });
      }

      let { buffer } = await readMultipartBuffer(data, maxBytes);

      buffer = await sharp(buffer)
        .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
        .toBuffer();

      const { url, storagePath } = await storageService.saveFile(
        buffer,
        data.filename,
        data.mimetype,
      );

      const user = await User.findByIdAndUpdate(
        request.user.id,
        { partnerAvatarUrl: url },
        { new: true },
      );

      return reply.status(200).send({
        partnerAvatarUrl: url,
        storagePath,
        user: user ? toSafeUser(user) : null,
      });
    },
  );
}
