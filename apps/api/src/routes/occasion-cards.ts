import { Hono } from 'hono';
import { z } from 'zod';
import {
  execute,
  findCoupleById,
  findPartnerUser,
  findUserById,
  queryAll,
  queryOne,
} from '../db/d1';
import { parseJsonSafe } from '../db/types';
import { authenticate } from '../middleware/auth';
import {
  BUILTIN_OCCASIONS,
  computeUpcomingRecipientOccasion,
  getCalendarDate,
  resolveRecipientCardForDate,
  toDateKey,
  type OccasionCardRow,
  type OccasionDeliveryRow,
  type ResolvedOccasionCardDto,
} from '../services/occasion-schedule';
import { sendPushToUser } from '../services/push';
import { emitRealtimeEvent } from '../services/realtime';
import { deleteStoredFile, isUploadedFile, saveUploadedImage } from '../services/storage';
import type { HonoAppEnv } from '../types/hono';
import { AppError } from '../utils/errors';
import { generateId } from '../utils/id';

export const occasionCardRoutes = new Hono<HonoAppEnv>();

const bootstrappedDbs = new WeakSet<D1Database>();

export async function ensureOccasionCardsSchema(db: D1Database): Promise<void> {
  if (bootstrappedDbs.has(db)) return;
  await execute(
    db,
    `CREATE TABLE IF NOT EXISTS couple_occasion_cards (
      id TEXT PRIMARY KEY,
      couple_id TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      occasion_key TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'builtin' CHECK (kind IN ('builtin', 'custom')),
      enabled INTEGER NOT NULL DEFAULT 1,
      schedule_type TEXT NOT NULL DEFAULT 'builtin' CHECK (schedule_type IN ('builtin', 'once', 'annual')),
      custom_date TEXT,
      occasion_label TEXT,
      eyebrow TEXT,
      title TEXT,
      message TEXT,
      signature TEXT,
      cover_text TEXT,
      template_id TEXT,
      pattern TEXT,
      colors_json TEXT,
      scratch_cover_url TEXT,
      scratch_cover_storage_path TEXT,
      background_image_url TEXT,
      background_storage_path TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(couple_id, author_id, occasion_key)
    )`,
  );
  await execute(
    db,
    `CREATE INDEX IF NOT EXISTS idx_occasion_cards_couple_author
     ON couple_occasion_cards(couple_id, author_id)`,
  );
  await execute(
    db,
    `CREATE TABLE IF NOT EXISTS occasion_card_deliveries (
      id TEXT PRIMARY KEY,
      couple_id TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
      recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sender_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      occasion_key TEXT NOT NULL,
      date_key TEXT NOT NULL,
      card_snapshot_json TEXT NOT NULL,
      revealed_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(recipient_id, date_key, occasion_key)
    )`,
  );
  await execute(
    db,
    `CREATE INDEX IF NOT EXISTS idx_occasion_deliveries_recipient
     ON occasion_card_deliveries(recipient_id, revealed_at DESC)`,
  );
  bootstrappedDbs.add(db);
}

const upsertCardSchema = z.object({
  kind: z.enum(['builtin', 'custom']).optional(),
  enabled: z.boolean().optional(),
  scheduleType: z.enum(['builtin', 'once', 'annual']).optional(),
  customDate: z.string().trim().max(20).nullable().optional(),
  occasionLabel: z.string().trim().max(80).nullable().optional(),
  eyebrow: z.string().trim().max(90).nullable().optional(),
  title: z.string().trim().max(120).nullable().optional(),
  message: z.string().trim().max(1200).nullable().optional(),
  signature: z.string().trim().max(90).nullable().optional(),
  coverText: z.string().trim().max(120).nullable().optional(),
  templateId: z.string().trim().max(50).nullable().optional(),
  pattern: z
    .enum(['hearts', 'petals', 'confetti', 'stars', 'snow', 'ribbons', 'candy', 'lanterns'])
    .nullable()
    .optional(),
  colors: z.tuple([z.string().max(24), z.string().max(24), z.string().max(24)]).nullable().optional(),
  scratchCoverUrl: z.string().trim().max(500).nullable().optional(),
  scratchCoverStoragePath: z.string().trim().max(300).nullable().optional(),
  backgroundImageUrl: z.string().trim().max(500).nullable().optional(),
  backgroundStoragePath: z.string().trim().max(300).nullable().optional(),
});

const revealCardSchema = z.object({
  occasionKey: z.string().trim().min(1).max(80),
});

function toAuthoredCardDto(row: OccasionCardRow) {
  return {
    id: row.id,
    occasionKey: row.occasion_key,
    kind: row.kind,
    enabled: Boolean(row.enabled),
    scheduleType: row.schedule_type,
    customDate: row.custom_date ?? undefined,
    occasionLabel: row.occasion_label ?? undefined,
    eyebrow: row.eyebrow ?? undefined,
    title: row.title ?? undefined,
    message: row.message ?? undefined,
    signature: row.signature ?? undefined,
    coverText: row.cover_text ?? undefined,
    templateId: row.template_id ?? undefined,
    pattern: row.pattern ?? undefined,
    colors: parseJsonSafe<[string, string, string] | undefined>(row.colors_json, undefined),
    scratchCoverUrl: row.scratch_cover_url ?? undefined,
    scratchCoverStoragePath: row.scratch_cover_storage_path ?? undefined,
    backgroundImageUrl: row.background_image_url ?? undefined,
    backgroundStoragePath: row.background_storage_path ?? undefined,
    updatedAt: row.updated_at,
  };
}

function toDeliveryDto(row: OccasionDeliveryRow) {
  return {
    id: row.id,
    occasionKey: row.occasion_key,
    dateKey: row.date_key,
    revealedAt: row.revealed_at,
    card: parseJsonSafe<ResolvedOccasionCardDto | null>(row.card_snapshot_json, null),
  };
}

occasionCardRoutes.get('/occasion-cards', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) {
    throw new AppError('Bạn chưa tham gia nhóm cặp đôi', 400, 'NO_COUPLE');
  }
  await ensureOccasionCardsSchema(c.env.DB);

  const user = (await findUserById(c.env.DB, auth.id))!;
  const couple = await findCoupleById(c.env.DB, auth.coupleId);
  const partner = await findPartnerUser(c.env.DB, auth.coupleId, user.id);

  const [authoredRows, deliveryRows, partnerAuthoredRows] = await Promise.all([
    queryAll<OccasionCardRow>(
      c.env.DB,
      `SELECT * FROM couple_occasion_cards
       WHERE couple_id = ? AND author_id = ?
       ORDER BY updated_at DESC`,
      [auth.coupleId, user.id],
    ),
    queryAll<OccasionDeliveryRow>(
      c.env.DB,
      `SELECT * FROM occasion_card_deliveries
       WHERE recipient_id = ?
       ORDER BY revealed_at DESC
       LIMIT 120`,
      [user.id],
    ),
    partner
      ? queryAll<OccasionCardRow>(
          c.env.DB,
          `SELECT * FROM couple_occasion_cards WHERE couple_id = ? AND author_id = ?`,
          [auth.coupleId, partner.id],
        )
      : Promise.resolve([] as OccasionCardRow[]),
  ]);

  const upcomingOccasion = computeUpcomingRecipientOccasion({
    recipient: user,
    sender: partner,
    couple,
    senderCards: partnerAuthoredRows,
  });

  return c.json({
    authoredCards: authoredRows.map(toAuthoredCardDto),
    receivedAlbum: deliveryRows
      .map(toDeliveryDto)
      .filter((item) => item.card !== null),
    upcomingOccasion,
  });
});

occasionCardRoutes.get('/occasion-cards/today', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) {
    return c.json({ dateKey: toDateKey(getCalendarDate(new Date())), card: null, alreadyRevealed: false });
  }
  await ensureOccasionCardsSchema(c.env.DB);

  const user = (await findUserById(c.env.DB, auth.id))!;
  const couple = await findCoupleById(c.env.DB, auth.coupleId);
  const partner = await findPartnerUser(c.env.DB, auth.coupleId, user.id);
  const partnerAuthoredRows = partner
    ? await queryAll<OccasionCardRow>(
        c.env.DB,
        `SELECT * FROM couple_occasion_cards WHERE couple_id = ? AND author_id = ?`,
        [auth.coupleId, partner.id],
      )
    : [];

  const now = new Date();
  const dateKey = toDateKey(getCalendarDate(now));
  const card = resolveRecipientCardForDate({
    recipient: user,
    sender: partner,
    couple,
    senderCards: partnerAuthoredRows,
    now,
  });

  if (!card) {
    return c.json({ dateKey, card: null, alreadyRevealed: false });
  }

  const delivery = await queryOne<OccasionDeliveryRow>(
    c.env.DB,
    `SELECT * FROM occasion_card_deliveries
     WHERE recipient_id = ? AND date_key = ? AND occasion_key = ?
     LIMIT 1`,
    [user.id, dateKey, card.occasionKey],
  );

  return c.json({
    dateKey,
    card,
    alreadyRevealed: Boolean(delivery),
  });
});

occasionCardRoutes.post('/occasion-cards/upload', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) {
    throw new AppError('Bạn chưa tham gia nhóm cặp đôi', 400, 'NO_COUPLE');
  }
  const config = c.get('config');
  const formData = await c.req.formData().catch(() => null);
  const fileEntry = formData?.get('file') ?? formData?.get('image');
  if (!isUploadedFile(fileEntry) || fileEntry.size <= 0) {
    throw new AppError('Vui lòng chọn tệp ảnh hợp lệ', 400, 'MISSING_FILE');
  }

  const uploaded = await saveUploadedImage(c.env.STORAGE, config, fileEntry, 'occasion-cards');
  return c.json({
    url: uploaded.url,
    storagePath: uploaded.storagePath,
  });
});

occasionCardRoutes.put('/occasion-cards/:occasionKey', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) {
    throw new AppError('Bạn chưa tham gia nhóm cặp đôi', 400, 'NO_COUPLE');
  }
  await ensureOccasionCardsSchema(c.env.DB);

  const rawKey = c.req.param('occasionKey')?.trim() || '';
  if (!rawKey || rawKey.length > 80 || !/^[a-z0-9_-]+$/i.test(rawKey)) {
    throw new AppError('Mã dịp thiệp không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const body = await c.req.json().catch(() => null);
  const parsed = upsertCardSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(
      parsed.error.issues[0]?.message || 'Nội dung thiệp không hợp lệ',
      400,
      'VALIDATION_ERROR',
    );
  }

  const isBuiltin = BUILTIN_OCCASIONS.some((item) => item.key === rawKey);
  const kind: 'builtin' | 'custom' = parsed.data.kind ?? (isBuiltin ? 'builtin' : 'custom');
  const scheduleType: 'builtin' | 'once' | 'annual' =
    kind === 'builtin' ? 'builtin' : (parsed.data.scheduleType === 'annual' ? 'annual' : 'once');

  if (kind === 'custom') {
    const customDate = parsed.data.customDate?.trim();
    if (!customDate || !/^(\d{4}-\d{2}-\d{2}|\d{2}-\d{2})$/.test(customDate)) {
      throw new AppError('Vui lòng chọn ngày mở thiệp hợp lệ (YYYY-MM-DD)', 400, 'VALIDATION_ERROR');
    }
  }

  const existing = await queryOne<OccasionCardRow>(
    c.env.DB,
    `SELECT * FROM couple_occasion_cards
     WHERE couple_id = ? AND author_id = ? AND occasion_key = ?
     LIMIT 1`,
    [auth.coupleId, auth.id, rawKey],
  );

  const config = c.get('config');
  const data = parsed.data;
  const nowIso = new Date().toISOString();

  const nextEnabled =
    data.enabled !== undefined ? (data.enabled ? 1 : 0) : (existing ? existing.enabled : 1);
  const nextCustomDate =
    data.customDate !== undefined ? data.customDate : (existing?.custom_date ?? null);
  const nextLabel =
    data.occasionLabel !== undefined ? data.occasionLabel : (existing?.occasion_label ?? null);
  const nextEyebrow = data.eyebrow !== undefined ? data.eyebrow : (existing?.eyebrow ?? null);
  const nextTitle = data.title !== undefined ? data.title : (existing?.title ?? null);
  const nextMessage = data.message !== undefined ? data.message : (existing?.message ?? null);
  const nextSignature = data.signature !== undefined ? data.signature : (existing?.signature ?? null);
  const nextCoverText = data.coverText !== undefined ? data.coverText : (existing?.cover_text ?? null);
  const nextTemplateId =
    data.templateId !== undefined ? data.templateId : (existing?.template_id ?? null);
  const nextPattern = data.pattern !== undefined ? data.pattern : (existing?.pattern ?? null);
  const nextColorsJson =
    data.colors !== undefined
      ? (data.colors ? JSON.stringify(data.colors) : null)
      : (existing?.colors_json ?? null);

  const nextScratchUrl =
    data.scratchCoverUrl !== undefined
      ? data.scratchCoverUrl
      : (existing?.scratch_cover_url ?? null);
  const nextScratchPath =
    data.scratchCoverStoragePath !== undefined
      ? data.scratchCoverStoragePath
      : (data.scratchCoverUrl === null ? null : (existing?.scratch_cover_storage_path ?? null));

  const nextBgUrl =
    data.backgroundImageUrl !== undefined
      ? data.backgroundImageUrl
      : (existing?.background_image_url ?? null);
  const nextBgPath =
    data.backgroundStoragePath !== undefined
      ? data.backgroundStoragePath
      : (data.backgroundImageUrl === null ? null : (existing?.background_storage_path ?? null));

  // Cleanup replaced R2 assets safely
  if (
    existing?.scratch_cover_storage_path
    && existing.scratch_cover_storage_path !== nextScratchPath
  ) {
    await deleteStoredFile(c.env.STORAGE, existing.scratch_cover_storage_path, config.R2_PUBLIC_URL);
  }
  if (existing?.background_storage_path && existing.background_storage_path !== nextBgPath) {
    await deleteStoredFile(c.env.STORAGE, existing.background_storage_path, config.R2_PUBLIC_URL);
  }

  const rowId = existing?.id ?? generateId();
  await execute(
    c.env.DB,
    `INSERT INTO couple_occasion_cards (
      id, couple_id, author_id, occasion_key, kind, enabled, schedule_type, custom_date,
      occasion_label, eyebrow, title, message, signature, cover_text, template_id, pattern,
      colors_json, scratch_cover_url, scratch_cover_storage_path,
      background_image_url, background_storage_path, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(couple_id, author_id, occasion_key) DO UPDATE SET
      kind = excluded.kind,
      enabled = excluded.enabled,
      schedule_type = excluded.schedule_type,
      custom_date = excluded.custom_date,
      occasion_label = excluded.occasion_label,
      eyebrow = excluded.eyebrow,
      title = excluded.title,
      message = excluded.message,
      signature = excluded.signature,
      cover_text = excluded.cover_text,
      template_id = excluded.template_id,
      pattern = excluded.pattern,
      colors_json = excluded.colors_json,
      scratch_cover_url = excluded.scratch_cover_url,
      scratch_cover_storage_path = excluded.scratch_cover_storage_path,
      background_image_url = excluded.background_image_url,
      background_storage_path = excluded.background_storage_path,
      updated_at = excluded.updated_at`,
    [
      rowId,
      auth.coupleId,
      auth.id,
      rawKey,
      kind,
      nextEnabled,
      scheduleType,
      nextCustomDate,
      nextLabel,
      nextEyebrow,
      nextTitle,
      nextMessage,
      nextSignature,
      nextCoverText,
      nextTemplateId,
      nextPattern,
      nextColorsJson,
      nextScratchUrl,
      nextScratchPath,
      nextBgUrl,
      nextBgPath,
      existing?.created_at ?? nowIso,
      nowIso,
    ],
  );

  const saved = (await queryOne<OccasionCardRow>(
    c.env.DB,
    `SELECT * FROM couple_occasion_cards WHERE id = ? LIMIT 1`,
    [rowId],
  ))!;

  return c.json({ card: toAuthoredCardDto(saved) });
});

occasionCardRoutes.delete('/occasion-cards/:occasionKey', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) {
    throw new AppError('Bạn chưa tham gia nhóm cặp đôi', 400, 'NO_COUPLE');
  }
  await ensureOccasionCardsSchema(c.env.DB);

  const rawKey = c.req.param('occasionKey')?.trim() || '';
  const existing = await queryOne<OccasionCardRow>(
    c.env.DB,
    `SELECT * FROM couple_occasion_cards
     WHERE couple_id = ? AND author_id = ? AND occasion_key = ?
     LIMIT 1`,
    [auth.coupleId, auth.id, rawKey],
  );

  if (existing) {
    const config = c.get('config');
    if (existing.scratch_cover_storage_path) {
      await deleteStoredFile(c.env.STORAGE, existing.scratch_cover_storage_path, config.R2_PUBLIC_URL);
    }
    if (existing.background_storage_path) {
      await deleteStoredFile(c.env.STORAGE, existing.background_storage_path, config.R2_PUBLIC_URL);
    }
    await execute(
      c.env.DB,
      `DELETE FROM couple_occasion_cards WHERE id = ?`,
      [existing.id],
    );
  }

  return c.json({ deleted: true });
});

occasionCardRoutes.post('/occasion-cards/reveal', authenticate, async (c) => {
  const auth = c.get('user')!;
  if (!auth.coupleId) {
    throw new AppError('Bạn chưa tham gia nhóm cặp đôi', 400, 'NO_COUPLE');
  }
  await ensureOccasionCardsSchema(c.env.DB);

  const body = await c.req.json().catch(() => null);
  const parsed = revealCardSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError('Yêu cầu mở thiệp không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const user = (await findUserById(c.env.DB, auth.id))!;
  const couple = await findCoupleById(c.env.DB, auth.coupleId);
  const partner = await findPartnerUser(c.env.DB, auth.coupleId, user.id);
  const partnerAuthoredRows = partner
    ? await queryAll<OccasionCardRow>(
        c.env.DB,
        `SELECT * FROM couple_occasion_cards WHERE couple_id = ? AND author_id = ?`,
        [auth.coupleId, partner.id],
      )
    : [];

  const now = new Date();
  const dateKey = toDateKey(getCalendarDate(now));
  const resolved = resolveRecipientCardForDate({
    recipient: user,
    sender: partner,
    couple,
    senderCards: partnerAuthoredRows,
    now,
  });

  if (!resolved || resolved.occasionKey !== parsed.data.occasionKey) {
    throw new AppError('Thiệp này chưa đến thời điểm mở khóa', 403, 'OCCASION_NOT_ACTIVE');
  }

  const existing = await queryOne<OccasionDeliveryRow>(
    c.env.DB,
    `SELECT * FROM occasion_card_deliveries
     WHERE recipient_id = ? AND date_key = ? AND occasion_key = ?
     LIMIT 1`,
    [user.id, dateKey, resolved.occasionKey],
  );
  if (existing) {
    return c.json({ delivery: toDeliveryDto(existing), duplicate: true });
  }

  const nowIso = now.toISOString();
  const deliveryId = generateId();
  await execute(
    c.env.DB,
    `INSERT INTO occasion_card_deliveries (
      id, couple_id, recipient_id, sender_id, occasion_key, date_key,
      card_snapshot_json, revealed_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      deliveryId,
      auth.coupleId,
      user.id,
      partner?.id ?? null,
      resolved.occasionKey,
      dateKey,
      JSON.stringify(resolved),
      nowIso,
      nowIso,
    ],
  );

  const created = (await queryOne<OccasionDeliveryRow>(
    c.env.DB,
    `SELECT * FROM occasion_card_deliveries WHERE id = ? LIMIT 1`,
    [deliveryId],
  ))!;

  // Notify partner in real-time that their secret card was just scratched open!
  if (partner) {
    const config = c.get('config');
    const title = `${user.display_name} vừa cào mở thiệp của bạn! 💌`;
    const notifyBody = `Tấm thiệp "${resolved.title}" đã được mở khóa rồi, vào trò chuyện cùng người ấy nhé!`;
    await Promise.allSettled([
      sendPushToUser(c.env, config, partner.id, {
        title,
        body: notifyBody,
        icon: user.avatar_url ?? undefined,
        badge: '/icons/icon-192.png',
        url: '/app/messages',
        targetUrl: '/app/messages',
        tag: `occasion-revealed-${deliveryId}`,
        kind: 'occasion_revealed',
        actionType: 'occasion_revealed',
        type: 'occasion_revealed',
        senderName: user.display_name,
        senderAvatar: user.avatar_url ?? undefined,
      }),
      emitRealtimeEvent(c.env, partner.id, {
        type: 'occasion.revealed',
        senderId: user.id,
        senderName: user.display_name,
        senderAvatar: user.avatar_url ?? undefined,
        title,
        body: notifyBody,
        targetUrl: '/app/messages',
        url: '/app/messages',
        createdAt: nowIso,
      }),
    ]);
  }

  return c.json({ delivery: toDeliveryDto(created) }, 201);
});
