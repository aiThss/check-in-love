import { Hono } from 'hono';
import {
  execute,
  findCoupleById,
  findPartnerUser,
  findUserById,
  queryAll,
  queryOne,
} from '../db/d1';
import {
  parseJsonSafe,
  toCheckinDto,
  toMessageDto,
  type ChatMessageRow,
  type CheckinReactionItem,
  type CheckinReplyItem,
  type CheckinRow,
  type MessageReplyReference,
} from '../db/types';
import { authenticate } from '../middleware/auth';
import { syncCheckinRepliesPage, syncCheckinReplyToMessage } from '../services/checkin-reply-message-sync';
import { sendPushToUser } from '../services/push';
import { emitRealtimeEvent } from '../services/realtime';
import { deleteStoredFile, isUploadedFile, saveUploadedImage } from '../services/storage';
import { recalculateCoupleStreak } from '../services/streak';
import type { HonoAppEnv } from '../types/hono';
import { AppError } from '../utils/errors';
import { generateId } from '../utils/id';

export const checkinRoutes = new Hono<HonoAppEnv>();

const CHECKIN_TYPES = new Set(['photo', 'text', 'mood']);

checkinRoutes.get('/checkins', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) {
    throw new AppError('Bạn chưa tham gia nhóm cặp đôi', 400, 'NO_COUPLE');
  }

  const page = Math.max(1, Number.parseInt(c.req.query('page') || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(c.req.query('limit') || '20', 10) || 20));
  const after = c.req.query('after')?.trim();
  const typeFilter = c.req.query('type')?.trim();

  const whereClauses = ['couple_id = ?', 'deleted_at IS NULL'];
  const params: unknown[] = [auth.coupleId];

  if (after) {
    const parsedAfter = new Date(after);
    if (!Number.isNaN(parsedAfter.getTime())) {
      whereClauses.push('created_at > ?');
      params.push(parsedAfter.toISOString());
    }
  }

  if (typeFilter && CHECKIN_TYPES.has(typeFilter)) {
    whereClauses.push('type = ?');
    params.push(typeFilter);
  }

  const whereSql = whereClauses.join(' AND ');
  const offset = (page - 1) * limit;

  const countRow = await queryOne<{ total: number }>(
    c.env.DB,
    `SELECT COUNT(*) AS total FROM checkins WHERE ${whereSql}`,
    params,
  );
  const total = Number(countRow?.total ?? 0);

  const rows = await queryAll<CheckinRow>(
    c.env.DB,
    `SELECT * FROM checkins WHERE ${whereSql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  await syncCheckinRepliesPage(c.env.DB, auth.coupleId, rows);

  return c.json({
    checkIns: rows.map(toCheckinDto),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

checkinRoutes.get('/checkins/latest', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) {
    throw new AppError('Bạn chưa tham gia nhóm cặp đôi', 400, 'NO_COUPLE');
  }

  const latest = await queryOne<CheckinRow>(
    c.env.DB,
    `SELECT * FROM checkins
     WHERE couple_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC, id DESC LIMIT 1`,
    [auth.coupleId],
  );

  return c.json({ checkIn: latest ? toCheckinDto(latest) : null });
});

checkinRoutes.get('/checkins/latest-partner', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) {
    throw new AppError('Bạn chưa tham gia nhóm cặp đôi', 400, 'NO_COUPLE');
  }

  const latest = await queryOne<CheckinRow>(
    c.env.DB,
    `SELECT * FROM checkins
     WHERE couple_id = ? AND owner_id != ? AND deleted_at IS NULL
     ORDER BY created_at DESC, id DESC LIMIT 1`,
    [auth.coupleId, auth.id],
  );

  return c.json({ checkIn: latest ? toCheckinDto(latest) : null });
});

checkinRoutes.post('/checkins', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) {
    throw new AppError('Bạn chưa tham gia nhóm cặp đôi', 400, 'NO_COUPLE');
  }

  const config = c.get('config');
  const contentType = c.req.header('content-type') || '';

  let type: string;
  let caption: string | undefined;
  let mood: string | undefined;
  let surpriseText: string | undefined;
  let quickMessage: string | undefined;
  let includeScratch = true;
  let clientMutationId: string | undefined;
  let replyToMessageId: string | undefined;
  let photoFile: File | null = null;

  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.formData().catch(() => null);
    if (!formData) {
      throw new AppError('Dữ liệu form không hợp lệ', 400, 'VALIDATION_ERROR');
    }
    const getField = (key: string): string | undefined => {
      const value = formData.get(key);
      return typeof value === 'string' && value.trim() ? value.trim() : undefined;
    };

    type = getField('type') || 'photo';
    caption = getField('caption') ?? getField('text');
    mood = getField('mood');
    surpriseText = getField('surpriseText');
    quickMessage = getField('quickMessage');
    clientMutationId = getField('clientMutationId');
    replyToMessageId = getField('replyToMessageId');
    const scratchVal = formData.get('includeScratch');
    if (typeof scratchVal === 'string') {
      includeScratch = scratchVal !== 'false' && scratchVal !== '0';
    }

    const fileEntry = formData.get('photo') ?? formData.get('image') ?? formData.get('file');
    if (isUploadedFile(fileEntry) && fileEntry.size > 0) {
      photoFile = fileEntry;
    }
  } else {
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      throw new AppError('Payload không hợp lệ', 400, 'VALIDATION_ERROR');
    }
    type = typeof body.type === 'string' && body.type.trim() ? body.type.trim() : 'text';
    caption = typeof body.caption === 'string'
      ? body.caption.trim()
      : typeof body.text === 'string'
        ? body.text.trim()
        : undefined;
    mood = typeof body.mood === 'string' ? body.mood.trim() : undefined;
    surpriseText = typeof body.surpriseText === 'string' ? body.surpriseText.trim() : undefined;
    quickMessage = typeof body.quickMessage === 'string' ? body.quickMessage.trim() : undefined;
    includeScratch = body.includeScratch !== false && body.includeScratch !== 'false';
    clientMutationId = typeof body.clientMutationId === 'string' && body.clientMutationId.trim()
      ? body.clientMutationId.trim()
      : undefined;
    replyToMessageId = typeof body.replyToMessageId === 'string' && body.replyToMessageId.trim()
      ? body.replyToMessageId.trim()
      : undefined;
  }

  if (!CHECKIN_TYPES.has(type)) {
    throw new AppError('Loại check-in không hợp lệ', 400, 'VALIDATION_ERROR');
  }
  if (type === 'photo' && !photoFile) {
    throw new AppError('Vui lòng chọn ảnh để gửi check-in', 400, 'MISSING_PHOTO');
  }
  if (type === 'text' && !caption) {
    throw new AppError('Vui lòng nhập nội dung ghi chú', 400, 'MISSING_CAPTION');
  }
  if (type === 'mood' && !mood) {
    throw new AppError('Vui lòng chọn tâm trạng hiện tại', 400, 'MISSING_MOOD');
  }

  if (clientMutationId) {
    const existing = await queryOne<CheckinRow>(
      c.env.DB,
      'SELECT * FROM checkins WHERE couple_id = ? AND client_mutation_id = ? LIMIT 1',
      [auth.coupleId, clientMutationId],
    );
    if (existing) {
      const couple = await findCoupleById(c.env.DB, auth.coupleId);
      return c.json({ checkIn: toCheckinDto(existing), streak: couple?.streak ?? 0 }, 200);
    }
  }

  const user = (await findUserById(c.env.DB, auth.id))!;
  let replyTo: MessageReplyReference | undefined;
  if (replyToMessageId) {
    const refMsg = await queryOne<ChatMessageRow>(
      c.env.DB,
      'SELECT * FROM chat_messages WHERE id = ? AND couple_id = ? AND deleted_at IS NULL LIMIT 1',
      [replyToMessageId, auth.coupleId],
    );
    if (refMsg) {
      replyTo = {
        messageId: refMsg.id,
        senderId: refMsg.sender_id,
        senderName: refMsg.sender_name,
        type: refMsg.type,
        textSnippet: refMsg.text?.slice(0, 120) || undefined,
        mediaUrl: refMsg.image_url ?? undefined,
      };
    }
  }

  let imageUrl: string | null = null;
  let storagePath: string | null = null;
  if (photoFile) {
    const saved = await saveUploadedImage(c.env.STORAGE, config, photoFile, 'checkins');
    imageUrl = saved.url;
    storagePath = saved.storagePath;
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const checkinId = generateId();

  await execute(
    c.env.DB,
    `INSERT INTO checkins (
      id, couple_id, owner_id, owner_name, type, image_url, storage_path,
      caption, include_scratch, surprise_text, mood, quick_message,
      client_mutation_id, reply_to_message_id, reply_to_json,
      reactions_json, replies_json, deleted_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', '[]', NULL, ?, ?)`,
    [
      checkinId,
      auth.coupleId,
      user.id,
      user.display_name,
      type,
      imageUrl,
      storagePath,
      caption || null,
      includeScratch ? 1 : 0,
      surpriseText || null,
      mood || null,
      quickMessage || null,
      clientMutationId || null,
      replyTo?.messageId ?? null,
      replyTo ? JSON.stringify(replyTo) : null,
      nowIso,
      nowIso,
    ],
  );

  const createdRow = (await queryOne<CheckinRow>(
    c.env.DB,
    'SELECT * FROM checkins WHERE id = ? LIMIT 1',
    [checkinId],
  ))!;

  const { streak } = await recalculateCoupleStreak(c.env.DB, auth.coupleId, now);

  let createdChatMessage: ReturnType<typeof toMessageDto> | undefined;
  if (quickMessage) {
    const msgId = generateId();
    const snapshot = {
      checkinId: createdRow.id,
      ownerId: createdRow.owner_id,
      ownerName: createdRow.owner_name,
      type: createdRow.type,
      caption: createdRow.caption ?? undefined,
      mood: createdRow.mood ?? undefined,
      imageUrl: createdRow.image_url ?? undefined,
      createdAt: createdRow.created_at,
    };
    await execute(
      c.env.DB,
      `INSERT INTO chat_messages (
        id, couple_id, sender_id, sender_name, type, text,
        referenced_checkin_id, referenced_checkin_json, read_by_json,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'checkin_reply', ?, ?, ?, ?, ?, ?)`,
      [
        msgId,
        auth.coupleId,
        user.id,
        user.display_name,
        quickMessage,
        createdRow.id,
        JSON.stringify(snapshot),
        JSON.stringify([user.id]),
        nowIso,
        nowIso,
      ],
    );
    const msgRow = await queryOne<ChatMessageRow>(
      c.env.DB,
      'SELECT * FROM chat_messages WHERE id = ? LIMIT 1',
      [msgId],
    );
    if (msgRow) createdChatMessage = toMessageDto(msgRow);
  }

  const partner = await findPartnerUser(c.env.DB, auth.coupleId, user.id);
  if (partner) {
    const notifBody =
      type === 'photo'
        ? caption || 'Vừa gửi cho bạn một khoảnh khắc ảnh mới 📸'
        : type === 'mood'
          ? `Đang cảm thấy ${mood}${caption ? `: ${caption}` : ''}`
          : caption || 'Vừa gửi một ghi chú tình cảm mới 💌';

    const pushTitle = `${user.display_name} vừa Check IN! 💕`;

    await Promise.allSettled([
      sendPushToUser(c.env, config, partner.id, {
        title: pushTitle,
        body: notifBody,
        url: '/app/home',
        tag: `checkin-${checkinId}`,
        type: 'checkin',
        checkinId,
        senderName: user.display_name,
        senderAvatar: user.avatar_url ?? undefined,
        photoUrl: imageUrl ?? undefined,
      }),
      emitRealtimeEvent(c.env, partner.id, {
        type: 'checkin.created',
        checkinId,
        senderId: user.id,
        senderName: user.display_name,
        senderAvatar: user.avatar_url ?? undefined,
        title: pushTitle,
        body: notifBody,
        photoUrl: imageUrl ?? undefined,
        url: '/app/home',
        createdAt: nowIso,
      }),
    ]);
  }

  return c.json(
    {
      checkIn: toCheckinDto(createdRow),
      streak,
      ...(createdChatMessage ? { chatMessage: createdChatMessage } : {}),
    },
    201,
  );
});

checkinRoutes.post('/checkins/:id/reactions', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) {
    throw new AppError('Bạn chưa tham gia nhóm cặp đôi', 400, 'NO_COUPLE');
  }

  const checkinId = c.req.param('id');
  const body = (await c.req.json().catch(() => null)) as { type?: string } | null;
  const reactionType = body?.type?.trim();
  if (!reactionType || reactionType.length > 32) {
    throw new AppError('Loại cảm xúc không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const row = await queryOne<CheckinRow>(
    c.env.DB,
    'SELECT * FROM checkins WHERE id = ? AND couple_id = ? AND deleted_at IS NULL LIMIT 1',
    [checkinId, auth.coupleId],
  );
  if (!row) {
    throw new AppError('Không tìm thấy check-in', 404, 'CHECKIN_NOT_FOUND');
  }

  const existing = parseJsonSafe<CheckinReactionItem[]>(row.reactions_json, []);
  const sameIdx = existing.findIndex((r) => r.userId === auth.id && r.type === reactionType);
  let nextReactions: CheckinReactionItem[];
  let added = false;

  if (sameIdx >= 0) {
    nextReactions = existing.filter((_, idx) => idx !== sameIdx);
  } else {
    nextReactions = [
      ...existing.filter((r) => r.userId !== auth.id),
      { userId: auth.id, type: reactionType, createdAt: new Date().toISOString() },
    ];
    added = true;
  }

  const nowIso = new Date().toISOString();
  await execute(
    c.env.DB,
    'UPDATE checkins SET reactions_json = ?, updated_at = ? WHERE id = ?',
    [JSON.stringify(nextReactions), nowIso, row.id],
  );

  const user = (await findUserById(c.env.DB, auth.id))!;
  const partner = await findPartnerUser(c.env.DB, auth.coupleId, auth.id);
  if (partner && added) {
    const title = `${user.display_name} đã thả ${reactionType}`;
    const msgBody = 'Xem cảm xúc mới trên kỷ niệm của hai bạn!';
    await Promise.allSettled([
      sendPushToUser(c.env, c.get('config'), partner.id, {
        title,
        body: msgBody,
        url: '/app/home',
        tag: `reaction-${row.id}`,
        type: 'reaction',
        checkinId: row.id,
        senderName: user.display_name,
        senderAvatar: user.avatar_url ?? undefined,
      }),
      emitRealtimeEvent(c.env, partner.id, {
        type: 'checkin.reaction',
        checkinId: row.id,
        senderId: user.id,
        senderName: user.display_name,
        senderAvatar: user.avatar_url ?? undefined,
        title,
        body: msgBody,
        url: '/app/home',
      }),
    ]);
  } else if (partner) {
    await emitRealtimeEvent(c.env, partner.id, {
      type: 'checkin.reaction',
      checkinId: row.id,
      senderId: user.id,
      title: '',
      body: '',
    });
  }

  return c.json({ reactions: nextReactions });
});

checkinRoutes.post('/checkins/:id/replies', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) {
    throw new AppError('Bạn chưa tham gia nhóm cặp đôi', 400, 'NO_COUPLE');
  }

  const checkinId = c.req.param('id');
  const body = (await c.req.json().catch(() => null)) as { message?: string } | null;
  const message = body?.message?.trim();
  if (!message || message.length > 1000) {
    throw new AppError('Nội dung phản hồi phải từ 1 đến 1000 ký tự', 400, 'VALIDATION_ERROR');
  }

  const row = await queryOne<CheckinRow>(
    c.env.DB,
    'SELECT * FROM checkins WHERE id = ? AND couple_id = ? AND deleted_at IS NULL LIMIT 1',
    [checkinId, auth.coupleId],
  );
  if (!row) {
    throw new AppError('Không tìm thấy check-in', 404, 'CHECKIN_NOT_FOUND');
  }

  const user = (await findUserById(c.env.DB, auth.id))!;
  const nowIso = new Date().toISOString();
  const existingReplies = parseJsonSafe<CheckinReplyItem[]>(row.replies_json, []);
  const newReply: CheckinReplyItem = {
    userId: user.id,
    userName: user.display_name,
    message,
    createdAt: nowIso,
  };
  const nextReplies = [...existingReplies, newReply];

  await execute(
    c.env.DB,
    'UPDATE checkins SET replies_json = ?, updated_at = ? WHERE id = ?',
    [JSON.stringify(nextReplies), nowIso, row.id],
  );

  const syncedMsg = await syncCheckinReplyToMessage(c.env.DB, {
    coupleId: auth.coupleId,
    checkin: row,
    senderId: user.id,
    senderName: user.display_name,
    messageText: message,
    createdAt: nowIso,
    readBy: [user.id],
  });

  const partner = await findPartnerUser(c.env.DB, auth.coupleId, auth.id);
  if (partner) {
    const title = `${user.display_name} đã phản hồi kỷ niệm`;
    await Promise.allSettled([
      sendPushToUser(c.env, c.get('config'), partner.id, {
        title,
        body: message,
        url: '/app/messages',
        tag: `reply-${row.id}`,
        type: 'reply',
        checkinId: row.id,
        messageId: syncedMsg?.id,
        senderName: user.display_name,
        senderAvatar: user.avatar_url ?? undefined,
      }),
      emitRealtimeEvent(c.env, partner.id, {
        type: 'checkin.reply',
        checkinId: row.id,
        messageId: syncedMsg?.id,
        senderId: user.id,
        senderName: user.display_name,
        senderAvatar: user.avatar_url ?? undefined,
        title,
        body: message,
        url: '/app/messages',
      }),
    ]);
  }

  return c.json({ replies: nextReplies });
});

checkinRoutes.delete('/checkins/:id', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) {
    throw new AppError('Bạn chưa tham gia nhóm cặp đôi', 400, 'NO_COUPLE');
  }

  const checkinId = c.req.param('id');
  const row = await queryOne<CheckinRow>(
    c.env.DB,
    'SELECT * FROM checkins WHERE id = ? AND couple_id = ? AND deleted_at IS NULL LIMIT 1',
    [checkinId, auth.coupleId],
  );
  if (!row) {
    throw new AppError('Không tìm thấy check-in', 404, 'CHECKIN_NOT_FOUND');
  }
  if (row.owner_id !== auth.id) {
    throw new AppError('Bạn chỉ có thể xóa check-in của chính mình', 403, 'FORBIDDEN');
  }

  const nowIso = new Date().toISOString();
  await execute(
    c.env.DB,
    'UPDATE checkins SET deleted_at = ?, updated_at = ? WHERE id = ?',
    [nowIso, nowIso, row.id],
  );

  if (row.storage_path) {
    await deleteStoredFile(c.env.STORAGE, row.storage_path, c.get('config').R2_PUBLIC_URL);
  }

  await recalculateCoupleStreak(c.env.DB, auth.coupleId);

  const partner = await findPartnerUser(c.env.DB, auth.coupleId, auth.id);
  if (partner) {
    await emitRealtimeEvent(c.env, partner.id, {
      type: 'checkin.deleted',
      checkinId: row.id,
      senderId: auth.id,
      title: '',
      body: '',
    });
  }

  return c.json({ success: true });
});
