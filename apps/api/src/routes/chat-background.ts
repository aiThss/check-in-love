import { randomUUID } from 'node:crypto';
import { MultipartFile } from '@fastify/multipart';
import { FastifyInstance } from 'fastify';
import { Types } from 'mongoose';
import sharp from 'sharp';
import { z } from 'zod';
import { env } from '../config/env';
import { ChatMessage } from '../db/models/ChatMessage';
import { ChatBackgroundSnapshot, Couple } from '../db/models/Couple';
import { User } from '../db/models/User';
import { authenticate } from '../middleware/auth';
import { storageService } from '../services/storage';
import { emitRealtimeEvent } from './events';

const CHAT_BACKGROUND_PRESETS = [
  { id: 'default', label: 'Mặc định' },
  { id: 'rose-garden', label: 'Hoa hồng' },
  { id: 'sunset-horizon', label: 'Hoàng hôn biển' },
  { id: 'lavender-stars', label: 'Đồi lavender' },
  { id: 'mint-bloom', label: 'Lá nhiệt đới' },
  { id: 'midnight-heart', label: 'Bãi biển hồng' },
] as const;

const presetSchema = z.object({
  kind: z.literal('preset'),
  id: z.string().trim().min(1).max(80),
});

type SerializedChatBackground = {
  kind: 'preset' | 'custom';
  id?: string;
  imageUrl?: string;
  label: string;
  updatedAt?: string;
};

function serializeBackground(background?: ChatBackgroundSnapshot | null): SerializedChatBackground | null {
  if (!background) return null;
  return {
    kind: background.kind,
    id: background.id,
    imageUrl: background.imageUrl,
    label: background.label,
    updatedAt: background.updatedAt?.toISOString?.() ?? String(background.updatedAt),
  };
}

async function readImage(part: MultipartFile): Promise<{ buffer: Buffer; filename: string }> {
  if (!part.mimetype.startsWith('image/')) {
    throw Object.assign(new Error('Only image files are allowed'), { statusCode: 400 });
  }

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of part.file) {
    total += chunk.length;
    if (total > env.MAX_UPLOAD_MB * 1024 * 1024) {
      throw Object.assign(new Error('File too large'), { statusCode: 400 });
    }
    chunks.push(chunk);
  }
  return { buffer: Buffer.concat(chunks), filename: part.filename };
}

function backgroundMessage(displayName: string, background: ChatBackgroundSnapshot): string {
  if (background.kind === 'preset' && background.id === 'default') {
    return `${displayName} đã khôi phục chủ đề mặc định`;
  }
  return `${displayName} đã đổi chủ đề thành ${background.label}`;
}

export default async function chatBackgroundRoutes(app: FastifyInstance): Promise<void> {
  app.get('/chat-background', { preHandler: authenticate }, async (request, reply) => {
    const couple = await Couple.findById(request.user.coupleId).lean();
    if (!couple) {
      return reply.status(404).send({ error: 'Couple not found', code: 'NOT_FOUND' });
    }
    return reply.send({ background: serializeBackground(couple.chatBackground) });
  });

  app.patch('/chat-background', { preHandler: authenticate }, async (request, reply) => {
    const user = await User.findById(request.user.id).lean();
    if (!user) return reply.status(404).send({ error: 'User not found', code: 'NOT_FOUND' });

    const coupleId = new Types.ObjectId(request.user.coupleId);
    const previousCouple = await Couple.findById(coupleId).lean();
    if (!previousCouple) {
      return reply.status(404).send({ error: 'Couple not found', code: 'NOT_FOUND' });
    }

    let nextBackground: Omit<ChatBackgroundSnapshot, 'updatedBy' | 'updatedByName' | 'updatedAt'>;
    const contentType = request.headers['content-type'] ?? '';
    if (contentType.includes('multipart/form-data')) {
      let image: { buffer: Buffer; filename: string } | undefined;
      for await (const part of request.parts()) {
        if (part.type === 'file') image = await readImage(part);
      }
      if (!image) {
        return reply.status(400).send({ error: 'Image file required', code: 'NO_FILE' });
      }

      const buffer = await sharp(image.buffer)
        .rotate()
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();
      const saved = await storageService.saveFile(buffer, image.filename, 'image/jpeg');
      nextBackground = {
        kind: 'custom',
        imageUrl: saved.url,
        storagePath: saved.storagePath,
        label: 'Ảnh tùy chọn',
      };
    } else {
      const parsed = presetSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.errors[0].message,
          code: 'VALIDATION_ERROR',
        });
      }
      const preset = CHAT_BACKGROUND_PRESETS.find((item) => item.id === parsed.data.id);
      if (!preset) {
        return reply.status(400).send({ error: 'Unknown chat background', code: 'VALIDATION_ERROR' });
      }
      nextBackground = { kind: 'preset', id: preset.id, label: preset.label };
    }

    const snapshot: ChatBackgroundSnapshot = {
      ...nextBackground,
      updatedBy: new Types.ObjectId(request.user.id),
      updatedByName: user.displayName,
      updatedAt: new Date(),
    };
    const updatedCouple = await Couple.findByIdAndUpdate(
      coupleId,
      { $set: { chatBackground: snapshot } },
      { new: true, runValidators: true },
    ).lean();
    if (!updatedCouple) {
      return reply.status(404).send({ error: 'Couple not found', code: 'NOT_FOUND' });
    }

    const text = backgroundMessage(user.displayName, snapshot);
    const message = await ChatMessage.create({
      coupleId,
      senderId: new Types.ObjectId(request.user.id),
      senderName: user.displayName,
      type: 'text',
      text,
      systemEvent: {
        kind: 'background_changed',
        backgroundKind: snapshot.kind,
        backgroundId: snapshot.id,
        backgroundLabel: snapshot.label,
        backgroundImageUrl: snapshot.imageUrl,
      },
      clientMutationId: `chat-background:${coupleId.toString()}:${randomUUID()}`,
    });

    const partnerId = updatedCouple.memberIds.find((id) => id.toString() !== request.user.id);
    const serialized = serializeBackground(snapshot)!;
    if (partnerId) {
      emitRealtimeEvent(partnerId.toString(), {
        type: 'chat.background.updated',
        title: '',
        body: '',
        targetUrl: '/app/messages',
        senderName: user.displayName,
        messageId: message._id.toString(),
        chatBackground: serialized,
      });
    }

    const previousStoragePath = previousCouple.chatBackground?.storagePath;
    if (previousStoragePath && previousStoragePath !== snapshot.storagePath) {
      void storageService.deleteFile(previousStoragePath).catch(() => {
        app.log.warn({ storagePath: previousStoragePath }, 'Failed to remove previous chat background');
      });
    }

    return reply.status(200).send({ background: serialized, message });
  });
}
