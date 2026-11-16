import { Hono } from 'hono';
import {
  execute,
  findCoupleById,
  findPartnerUser,
  findUserById,
  queryOne,
} from '../db/d1';
import {
  parseJsonSafe,
  toMessageDto,
  type ChatBackgroundData,
  type ChatMessageRow,
  type ChatSystemEvent,
} from '../db/types';
import { authenticate } from '../middleware/auth';
import { emitRealtimeEvent } from '../services/realtime';
import { deleteStoredFile, isUploadedFile, saveUploadedImage } from '../services/storage';
import type { HonoAppEnv } from '../types/hono';
import { AppError } from '../utils/errors';
import { generateId } from '../utils/id';

export const chatBackgroundRoutes = new Hono<HonoAppEnv>();

const PRESET_LABELS: Record<string, string> = {
  default: 'Mặc định',
  'rose-garden': 'Hoa hồng',
  'sunset-horizon': 'Hoàng hôn biển',
  'lavender-stars': 'Đồi lavender',
  'mint-bloom': 'Lá nhiệt đới',
  'midnight-heart': 'Bãi biển hồng',
};

chatBackgroundRoutes.get('/chat-background', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) {
    throw new AppError('Bạn chưa tham gia nhóm cặp đôi', 400, 'NO_COUPLE');
  }

  const couple = await findCoupleById(c.env.DB, auth.coupleId);
  if (!couple) {
    throw new AppError('Không tìm thấy nhóm cặp đôi', 404, 'COUPLE_NOT_FOUND');
  }

  const rawBg = parseJsonSafe<ChatBackgroundData | null>(couple.chat_background_json, null);
  const background = rawBg
    ? {
        ...rawBg,
        imageUrl: rawBg.imageUrl ?? rawBg.url,
      }
    : null;
  return c.json({ background });
});

chatBackgroundRoutes.patch('/chat-background', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) {
    throw new AppError('Bạn chưa tham gia nhóm cặp đôi', 400, 'NO_COUPLE');
  }

  const couple = await findCoupleById(c.env.DB, auth.coupleId);
  if (!couple) {
    throw new AppError('Không tìm thấy nhóm cặp đôi', 404, 'COUPLE_NOT_FOUND');
  }

  const config = c.get('config');
  const user = (await findUserById(c.env.DB, auth.id))!;
  const previousBg = parseJsonSafe<ChatBackgroundData | null>(couple.chat_background_json, null);
  const nowIso = new Date().toISOString();
  const contentType = c.req.header('content-type') || '';

  let nextBg: ChatBackgroundData;
  let systemText: string;
  let systemEvent: ChatSystemEvent;

  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.formData().catch(() => null);
    const fileEntry = formData?.get('file') ?? formData?.get('image');
    if (!isUploadedFile(fileEntry) || fileEntry.size <= 0) {
      throw new AppError('Vui lòng chọn ảnh nền hợp lệ', 400, 'MISSING_FILE');
    }

    const uploaded = await saveUploadedImage(c.env.STORAGE, config, fileEntry, 'chat-backgrounds');
    nextBg = {
      kind: 'custom',
      label: 'Ảnh tùy chọn',
      imageUrl: uploaded.url,
      url: uploaded.url,
      storagePath: uploaded.storagePath,
      updatedById: user.id,
      updatedByName: user.display_name,
      updatedAt: nowIso,
    };
    systemText = `${user.display_name} đã đổi ảnh nền trò chuyện`;
    systemEvent = {
      kind: 'background_changed',
      backgroundKind: 'custom',
      backgroundLabel: 'Ảnh nền riêng',
    };
  } else {
    const body = (await c.req.json().catch(() => null)) as { kind?: string; id?: string } | null;
    const presetId = body?.id?.trim();
    if (body?.kind !== 'preset' || !presetId || !PRESET_LABELS[presetId]) {
      throw new AppError('Chủ đề hình nền không hợp lệ', 400, 'VALIDATION_ERROR');
    }

    const label = PRESET_LABELS[presetId];
    nextBg = {
      kind: 'preset',
      id: presetId,
      label,
      updatedById: user.id,
      updatedByName: user.display_name,
      updatedAt: nowIso,
    };
    systemText = `${user.display_name} đã đổi chủ đề thành ${label}`;
    systemEvent = {
      kind: 'background_changed',
      backgroundKind: 'preset',
      backgroundId: presetId,
      backgroundLabel: label,
    };
  }

  await execute(
    c.env.DB,
    'UPDATE couples SET chat_background_json = ?, updated_at = ? WHERE id = ?',
    [JSON.stringify(nextBg), nowIso, couple.id],
  );

  if (previousBg?.kind === 'custom' && previousBg.storagePath && previousBg.storagePath !== nextBg.storagePath) {
    await deleteStoredFile(c.env.STORAGE, previousBg.storagePath, config.R2_PUBLIC_URL);
  }

  const messageId = generateId();
  await execute(
    c.env.DB,
    `INSERT INTO chat_messages (
      id, couple_id, sender_id, sender_name, type, text,
      system_event_json, read_by_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'text', ?, ?, ?, ?, ?)`,
    [
      messageId,
      couple.id,
      user.id,
      user.display_name,
      systemText,
      JSON.stringify(systemEvent),
      JSON.stringify([user.id]),
      nowIso,
      nowIso,
    ],
  );

  const systemMessage = await queryOne<ChatMessageRow>(
    c.env.DB,
    'SELECT * FROM chat_messages WHERE id = ? LIMIT 1',
    [messageId],
  );

  const partner = await findPartnerUser(c.env.DB, couple.id, user.id);
  if (partner) {
    await emitRealtimeEvent(c.env, partner.id, {
      type: 'chat.background.updated',
      title: '',
      body: '',
      senderId: user.id,
      senderName: user.display_name,
      chatBackground: nextBg as unknown as Record<string, unknown>,
      messageId,
    });
  }

  return c.json({
    background: nextBg,
    message: systemMessage ? toMessageDto(systemMessage) : undefined,
  });
});
