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
import {
  syncCheckinReplyToMessage,
  toReferencedCheckinSnapshot,
} from '../services/checkin-reply-message-sync';
import { sendPushToUser } from '../services/push';
import { emitRealtimeEvent } from '../services/realtime';
import { isUploadedFile, saveUploadedImage } from '../services/storage';
import { recalculateCoupleStreak } from '../services/streak';
import type { HonoAppEnv } from '../types/hono';
import { AppError } from '../utils/errors';
import { generateId } from '../utils/id';

export const checkinRoutes = new Hono<HonoAppEnv>();

const CHECKIN_TYPES = new Set(['photo', 'text', 'mood']);

const LEGACY_REACTION_MAP: Record<string, string> = {
  heart: '❤️',
  hug: '🤗',
  kiss: '😘',
  laugh: '😂',
  miss: '🥺',
  wow: '🥰',
  fire: '🔥',
  sad: '😭',
};

function normalizeReactionType(type: string): string {
  const trimmed = type.trim();
  return LEGACY_REACTION_MAP[trimmed] ?? trimmed;
}

function replySnippet(input: { caption?: string | null; quickMessage?: string | null; imageUrl?: string | null }): string {
  const value = (input.caption ?? input.quickMessage ?? (input.imageUrl ? 'Ảnh' : 'Tin nhắn'))
    .replace(/\s+/g, ' ')
    .trim();
  return value.slice(0, 160) || 'Tin nhắn';
}

async function createPairedPhotoChatMessage(
  db: D1Database,
  checkin: CheckinRow,
  chatReplyTo?: MessageReplyReference,
): Promise<ChatMessageRow | null> {
  if (checkin.type !== 'photo' || !checkin.image_url) return null;

  const clientMutationId = `checkin-photo:${checkin.id}`;
  const existing = await queryOne<ChatMessageRow>(
    db,
    `SELECT * FROM chat_messages
     WHERE couple_id = ? AND (client_mutation_id = ? OR (referenced_checkin_id = ? AND type = 'image'))
       AND deleted_at IS NULL
     LIMIT 1`,
    [checkin.couple_id, clientMutationId, checkin.id],
  );
  if (existing) return existing;

  const msgId = generateId();
  const snapshot = toReferencedCheckinSnapshot(checkin);
  const attachments = [{ url: checkin.image_url, storagePath: checkin.storage_path ?? undefined }];
  const nowIso = checkin.created_at || new Date().toISOString();

  await execute(
    db,
    `INSERT OR IGNORE INTO chat_messages (
      id, couple_id, sender_id, sender_name, type, text,
      image_url, storage_path, attachments_json,
      reply_to_message_id, reply_to_json,
      referenced_checkin_id, referenced_checkin_json,
      client_mutation_id, read_by_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'image', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      msgId,
      checkin.couple_id,
      checkin.owner_id,
      checkin.owner_name,
      checkin.caption ?? checkin.quick_message ?? null,
      checkin.image_url,
      checkin.storage_path,
      JSON.stringify(attachments),
      chatReplyTo?.messageId ?? null,
      chatReplyTo ? JSON.stringify(chatReplyTo) : null,
      checkin.id,
      JSON.stringify(snapshot),
      clientMutationId,
      JSON.stringify([checkin.owner_id]),
      nowIso,
      nowIso,
    ],
  );

  return queryOne<ChatMessageRow>(
    db,
    'SELECT * FROM chat_messages WHERE couple_id = ? AND client_mutation_id = ? LIMIT 1',
    [checkin.couple_id, clientMutationId],
  );
}

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
      const afterIso = parsedAfter.toISOString();
      whereClauses.push('(created_at > ? OR updated_at > ?)');
      params.push(afterIso, afterIso);
    }
  }

  if (typeFilter && CHECKIN_TYPES.has(typeFilter)) {
    whereClauses.push('type = ?');
    params.push(typeFilter);
  }

  const whereSql = whereClauses.join(' AND ');
  const offset = (page - 1) * limit;

  const [countRow, rows] = await Promise.all([
    queryOne<{ total: number }>(
      c.env.DB,
      `SELECT COUNT(*) AS total FROM checkins WHERE ${whereSql}`,
      params,
    ),
    queryAll<CheckinRow>(
      c.env.DB,
      `SELECT * FROM checkins WHERE ${whereSql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    ),
  ]);
  const total = Number(countRow?.total ?? 0);

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
     WHERE couple_id = ? AND owner_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC, id DESC LIMIT 1`,
    [auth.coupleId, auth.id],
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
  let chatReplyToMessageId: string | undefined;
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
    chatReplyToMessageId = getField('chatReplyToMessageId');
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
    chatReplyToMessageId = typeof body.chatReplyToMessageId === 'string' && body.chatReplyToMessageId.trim()
      ? body.chatReplyToMessageId.trim()
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
      const pairedMsg = existing.type === 'photo' && existing.image_url
        ? await createPairedPhotoChatMessage(c.env.DB, existing)
        : null;
      return c.json(
        {
          checkIn: toCheckinDto(existing),
          ...(pairedMsg ? { chatMessage: toMessageDto(pairedMsg) } : {}),
          streak: couple?.streak ?? 0,
          duplicate: true,
        },
        200,
      );
    }
  }

  const user = (await findUserById(c.env.DB, auth.id))!;

  let replyTo: MessageReplyReference | undefined;
  if (replyToMessageId) {
    const refCheckin = await queryOne<CheckinRow>(
      c.env.DB,
      'SELECT * FROM checkins WHERE id = ? AND couple_id = ? AND deleted_at IS NULL LIMIT 1',
      [replyToMessageId, auth.coupleId],
    );
    if (refCheckin) {
      replyTo = {
        messageId: refCheckin.id,
        senderId: refCheckin.owner_id,
        senderName: refCheckin.owner_name,
        type: refCheckin.type,
        textSnippet: replySnippet({
          caption: refCheckin.caption,
          quickMessage: refCheckin.quick_message,
          imageUrl: refCheckin.image_url,
        }),
        mediaUrl: refCheckin.image_url ?? undefined,
      };
    } else {
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
          textSnippet: (refMsg.text?.replace(/\s+/g, ' ').trim() || (refMsg.image_url ? 'Ảnh' : 'Tin nhắn')).slice(0, 160),
          mediaUrl: refMsg.image_url ?? undefined,
        };
      }
    }
  }

  let chatReplyTo: MessageReplyReference | undefined;
  if (chatReplyToMessageId) {
    const original = await queryOne<ChatMessageRow>(
      c.env.DB,
      'SELECT * FROM chat_messages WHERE id = ? AND couple_id = ? AND deleted_at IS NULL LIMIT 1',
      [chatReplyToMessageId, auth.coupleId],
    );
    if (!original) {
      throw new AppError('Không tìm thấy tin nhắn cần trả lời', 404, 'NOT_FOUND');
    }
    chatReplyTo = {
      messageId: original.id,
      senderId: original.sender_id,
      senderName: original.sender_name,
      type: original.type,
      textSnippet: (original.text?.replace(/\s+/g, ' ').trim() || (original.image_url ? 'Ảnh' : 'Tin nhắn')).slice(0, 160),
      mediaUrl: original.image_url ?? undefined,
    };
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

  // Every photo check-in is bridged into ChatMessage as a shared photo topic (matching NoSQL v1)
  let createdChatMessage: ReturnType<typeof toMessageDto> | undefined;
  if (createdRow.type === 'photo' && createdRow.image_url) {
    const photoMsg = await createPairedPhotoChatMessage(c.env.DB, createdRow, chatReplyTo);
    if (photoMsg) createdChatMessage = toMessageDto(photoMsg);
  } else if (quickMessage) {
    const msgId = generateId();
    const snapshot = toReferencedCheckinSnapshot(createdRow);
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
    const photoTopic = createdRow.type === 'photo';
    const notifBody =
      type === 'photo'
        ? caption || quickMessage || 'Xem ngay nào!'
        : type === 'mood'
          ? `Đang cảm thấy ${mood}${caption ? `: ${caption}` : ''}`
          : caption || quickMessage || 'Xem ngay nào!';

    const pushTitle = photoTopic
      ? `${user.display_name} đã gửi ảnh mới`
      : `${user.display_name} đã check-in! 💕`;
    const sseTitle = photoTopic
      ? `${user.display_name} đã gửi ảnh mới 📸`
      : `${user.display_name} đã check-in! 💕`;
    const targetUrl = photoTopic ? '/app/messages' : '/app/home';

    await Promise.allSettled([
      sendPushToUser(c.env, config, partner.id, {
        title: pushTitle,
        body: notifBody,
        icon: user.avatar_url ?? undefined,
        badge: '/icons/icon-192.png',
        url: targetUrl,
        targetUrl,
        tag: `checkin-${checkinId}`,
        kind: photoTopic ? 'message' : 'checkin',
        actionType: photoTopic ? 'message' : 'checkin',
        type: photoTopic ? 'message' : 'checkin',
        checkinId,
        messageId: createdChatMessage?.id,
        senderName: user.display_name,
        senderAvatar: user.avatar_url ?? undefined,
        photoUrl: imageUrl ?? undefined,
      }),
      emitRealtimeEvent(c.env, partner.id, {
        type: photoTopic ? 'message' : 'checkin',
        checkinId,
        messageId: createdChatMessage?.id,
        senderId: user.id,
        senderName: user.display_name,
        senderAvatar: user.avatar_url ?? undefined,
        title: sseTitle,
        body: notifBody,
        photoUrl: imageUrl ?? undefined,
        targetUrl,
        url: targetUrl,
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
  const rawType = body?.type?.trim();
  if (!rawType || rawType.length > 32) {
    throw new AppError('Loại cảm xúc không hợp lệ', 400, 'VALIDATION_ERROR');
  }
  const reactionType = normalizeReactionType(rawType);

  const row = await queryOne<CheckinRow>(
    c.env.DB,
    'SELECT * FROM checkins WHERE id = ? AND couple_id = ? AND deleted_at IS NULL LIMIT 1',
    [checkinId, auth.coupleId],
  );
  if (!row) {
    throw new AppError('Không tìm thấy check-in', 404, 'CHECKIN_NOT_FOUND');
  }

  const existing = parseJsonSafe<CheckinReactionItem[]>(row.reactions_json, []);
  const sameIdx = existing.findIndex(
    (r) => r.userId === auth.id && normalizeReactionType(r.type) === reactionType,
  );
  let nextReactions: CheckinReactionItem[];
  let added = false;

  if (sameIdx >= 0) {
    nextReactions = existing.filter((_, idx) => idx !== sameIdx);
  } else {
    nextReactions = [
      ...existing,
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

  if (added && row.owner_id !== auth.id) {
    const user = (await findUserById(c.env.DB, auth.id))!;
    const title = `${user.display_name} đã react check-in của bạn 💕`;
    const msgBody = 'Mở app để xem reaction mới';
    await Promise.allSettled([
      sendPushToUser(c.env, c.get('config'), row.owner_id, {
        title: `${user.display_name} đã react check-in của bạn`,
        body: msgBody,
        icon: user.avatar_url ?? undefined,
        badge: '/icons/icon-192.png',
        url: '/app/memories',
        targetUrl: '/app/memories',
        tag: `reaction-${row.id}`,
        kind: 'reaction',
        actionType: 'reaction',
        type: 'reaction',
        checkinId: row.id,
        senderName: user.display_name,
        senderAvatar: user.avatar_url ?? undefined,
      }),
      emitRealtimeEvent(c.env, row.owner_id, {
        type: 'reaction',
        checkinId: row.id,
        senderId: user.id,
        senderName: user.display_name,
        senderAvatar: user.avatar_url ?? undefined,
        title,
        body: msgBody,
        targetUrl: '/app/memories',
        url: '/app/memories',
      }),
    ]);
  } else {
    const partner = await findPartnerUser(c.env.DB, auth.coupleId, auth.id);
    if (partner) {
      await emitRealtimeEvent(c.env, partner.id, {
        type: 'reaction',
        checkinId: row.id,
        senderId: auth.id,
        title: '',
        body: '',
        targetUrl: '/app/memories',
      });
    }
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

  const recipientId = row.owner_id !== auth.id
    ? row.owner_id
    : (await findPartnerUser(c.env.DB, auth.coupleId, auth.id))?.id;

  if (recipientId) {
    const title = `${user.display_name} đã reply check-in của bạn`;
    await Promise.allSettled([
      sendPushToUser(c.env, c.get('config'), recipientId, {
        title,
        body: message,
        icon: user.avatar_url ?? undefined,
        badge: '/icons/icon-192.png',
        url: '/app/messages',
        targetUrl: '/app/messages',
        tag: `reply-${row.id}`,
        kind: 'reply',
        actionType: 'reply',
        type: 'reply',
        checkinId: row.id,
        messageId: syncedMsg?.id,
        senderName: user.display_name,
        senderAvatar: user.avatar_url ?? undefined,
      }),
      emitRealtimeEvent(c.env, recipientId, {
        type: 'reply',
        checkinId: row.id,
        messageId: syncedMsg?.id,
        senderId: user.id,
        senderName: user.display_name,
        senderAvatar: user.avatar_url ?? undefined,
        title,
        body: message,
        targetUrl: '/app/messages',
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
  if (row.owner_id !== auth.id && auth.role !== 'admin') {
    throw new AppError('Bạn chỉ có thể xóa check-in của chính mình', 403, 'FORBIDDEN');
  }

  const nowIso = new Date().toISOString();
  await execute(
    c.env.DB,
    'UPDATE checkins SET deleted_at = ?, updated_at = ? WHERE id = ?',
    [nowIso, nowIso, row.id],
  );

  await recalculateCoupleStreak(c.env.DB, auth.coupleId);

  const partner = await findPartnerUser(c.env.DB, auth.coupleId, auth.id);
  if (partner) {
    await emitRealtimeEvent(c.env, partner.id, {
      type: 'checkin.deleted',
      checkinId: row.id,
      senderId: auth.id,
      title: '',
      body: '',
      targetUrl: '/app/home',
    });
  }

  return c.json({ success: true });
});
