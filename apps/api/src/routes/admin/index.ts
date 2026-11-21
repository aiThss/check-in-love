import { Hono } from 'hono';
import { z } from 'zod';
import { execute, queryAll, queryOne } from '../../db/d1';
import {
  parseJsonSafe,
  type ChatMessageRow,
  type CheckinReactionItem,
  type CheckinReplyItem,
  type CheckinRow,
  type CoupleRow,
  type RandomEventRow,
  type UserRow,
} from '../../db/types';
import { authenticateAdmin } from '../../middleware/auth';
import { deleteStoredFile } from '../../services/storage';
import type { HonoAppEnv } from '../../types/hono';
import { signJwt } from '../../utils/crypto';
import { AppError } from '../../utils/errors';

export const adminRoutes = new Hono<HonoAppEnv>();

const RESET_CONFIRMATION = 'RESET CHECK IN LOVE';

const adminLoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

function parsePageLimit(query: Record<string, string>) {
  const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit || '20', 10) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

adminRoutes.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError('Email hoặc mật khẩu quản trị không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const config = c.get('config');
  if (
    !config.ADMIN_EMAIL ||
    !config.ADMIN_PASSWORD ||
    parsed.data.email.toLowerCase() !== config.ADMIN_EMAIL.toLowerCase() ||
    parsed.data.password !== config.ADMIN_PASSWORD
  ) {
    throw new AppError('Thông tin đăng nhập quản trị không đúng', 401, 'INVALID_CREDENTIALS');
  }

  const token = await signJwt(
    { sub: 'admin', role: 'admin', email: config.ADMIN_EMAIL },
    config.JWT_SECRET,
    7 * 24 * 60 * 60,
  );

  return c.json({ token, admin: { email: config.ADMIN_EMAIL, role: 'admin' } });
});

adminRoutes.get('/summary', authenticateAdmin, async (c) => {
  const [usersRow, blockedRow, couplesRow, checkinsRow, randomRow] = await Promise.all([
    queryOne<{ cnt: number }>(c.env.DB, "SELECT COUNT(*) AS cnt FROM users WHERE role = 'user'"),
    queryOne<{ cnt: number }>(c.env.DB, "SELECT COUNT(*) AS cnt FROM users WHERE status = 'blocked'"),
    queryOne<{ cnt: number }>(c.env.DB, 'SELECT COUNT(*) AS cnt FROM couples'),
    queryOne<{ cnt: number }>(c.env.DB, 'SELECT COUNT(*) AS cnt FROM checkins WHERE deleted_at IS NULL'),
    queryOne<{ cnt: number }>(c.env.DB, 'SELECT COUNT(*) AS cnt FROM random_events'),
  ]);

  return c.json({
    totalUsers: Number(usersRow?.cnt ?? 0),
    blockedUsers: Number(blockedRow?.cnt ?? 0),
    totalCouples: Number(couplesRow?.cnt ?? 0),
    totalCheckIns: Number(checkinsRow?.cnt ?? 0),
    totalRandomEvents: Number(randomRow?.cnt ?? 0),
  });
});

adminRoutes.get('/maintenance/reset', authenticateAdmin, (c) => {
  const config = c.get('config');
  return c.json({
    enabled: config.ADMIN_ENABLE_TEST_RESET,
    confirmation: RESET_CONFIRMATION,
  });
});

adminRoutes.post('/maintenance/reset', authenticateAdmin, async (c) => {
  const config = c.get('config');
  if (!config.ADMIN_ENABLE_TEST_RESET) {
    throw new AppError('Chức năng reset đang bị tắt trên server', 403, 'RESET_DISABLED');
  }

  const body = (await c.req.json().catch(() => null)) as { confirmation?: string } | null;
  if (body?.confirmation !== RESET_CONFIRMATION) {
    throw new AppError(`Chuỗi xác nhận phải là "${RESET_CONFIRMATION}"`, 400, 'INVALID_CONFIRMATION');
  }

  const checkinsWithMedia = await queryAll<{ storage_path: string | null }>(
    c.env.DB,
    'SELECT storage_path FROM checkins WHERE storage_path IS NOT NULL',
  );
  const messagesWithMedia = await queryAll<{ storage_path: string | null }>(
    c.env.DB,
    'SELECT storage_path FROM chat_messages WHERE storage_path IS NOT NULL',
  );

  for (const row of [...checkinsWithMedia, ...messagesWithMedia]) {
    if (row.storage_path) {
      await deleteStoredFile(c.env.STORAGE, row.storage_path, config.R2_PUBLIC_URL);
    }
  }

  const [usersCnt, couplesCnt, checkinsCnt, randomCnt, pushCnt, otpCnt] = await Promise.all([
    queryOne<{ cnt: number }>(c.env.DB, 'SELECT COUNT(*) AS cnt FROM users'),
    queryOne<{ cnt: number }>(c.env.DB, 'SELECT COUNT(*) AS cnt FROM couples'),
    queryOne<{ cnt: number }>(c.env.DB, 'SELECT COUNT(*) AS cnt FROM checkins'),
    queryOne<{ cnt: number }>(c.env.DB, 'SELECT COUNT(*) AS cnt FROM random_events'),
    queryOne<{ cnt: number }>(c.env.DB, 'SELECT COUNT(*) AS cnt FROM push_subscriptions'),
    queryOne<{ cnt: number }>(c.env.DB, 'SELECT COUNT(*) AS cnt FROM otp_codes'),
  ]);

  await execute(c.env.DB, 'DELETE FROM chat_messages');
  await execute(c.env.DB, 'DELETE FROM checkins');
  await execute(c.env.DB, 'DELETE FROM couple_journeys');
  await execute(c.env.DB, 'DELETE FROM random_events');
  await execute(c.env.DB, 'DELETE FROM push_subscriptions');
  await execute(c.env.DB, 'DELETE FROM otp_codes');
  await execute(c.env.DB, 'DELETE FROM users');
  await execute(c.env.DB, 'DELETE FROM couples');
  await execute(c.env.DB, 'DELETE FROM system_kv');

  return c.json({
    success: true,
    deleted: {
      users: Number(usersCnt?.cnt ?? 0),
      couples: Number(couplesCnt?.cnt ?? 0),
      checkIns: Number(checkinsCnt?.cnt ?? 0),
      randomEvents: Number(randomCnt?.cnt ?? 0),
      pushSubscriptions: Number(pushCnt?.cnt ?? 0),
      otpCodes: Number(otpCnt?.cnt ?? 0),
    },
  });
});

adminRoutes.get('/users', authenticateAdmin, async (c) => {
  const { page, limit, offset } = parsePageLimit(c.req.query());
  const search = c.req.query('search')?.trim();

  let whereSql = "u.role = 'user'";
  const params: unknown[] = [];
  if (search) {
    whereSql += ' AND (u.display_name LIKE ? OR u.email LIKE ? OR u.email_aliases_json LIKE ? OR c.code LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }

  const countRow = await queryOne<{ cnt: number }>(
    c.env.DB,
    `SELECT COUNT(*) AS cnt
     FROM users u
     LEFT JOIN couples c ON u.couple_id = c.id
     WHERE ${whereSql}`,
    params,
  );
  const total = Number(countRow?.cnt ?? 0);

  const rows = await queryAll<UserRow & { couple_code: string | null }>(
    c.env.DB,
    `SELECT u.*, c.code AS couple_code
     FROM users u
     LEFT JOIN couples c ON u.couple_id = c.id
     WHERE ${whereSql}
     ORDER BY u.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const users = rows.map((row) => ({
    _id: row.id,
    id: row.id,
    displayName: row.display_name,
    partnerName: row.partner_name,
    email: row.email ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    status: row.status,
    role: row.role,
    coupleId: row.couple_id
      ? { _id: row.couple_id, id: row.couple_id, code: row.couple_code ?? undefined }
      : null,
    coupleCode: row.couple_code ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return c.json({
    users,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

adminRoutes.patch('/users/:id', authenticateAdmin, async (c) => {
  const userId = c.req.param('id');
  const body = (await c.req.json().catch(() => null)) as {
    status?: string;
    displayName?: string;
    partnerName?: string;
  } | null;

  const setClauses: string[] = [];
  const params: unknown[] = [];
  if (body?.status !== undefined) {
    if (body.status !== 'active' && body.status !== 'blocked') {
      throw new AppError('Trạng thái người dùng không hợp lệ', 400, 'VALIDATION_ERROR');
    }
    setClauses.push('status = ?');
    params.push(body.status);
  }
  if (body?.displayName !== undefined) {
    const trimmed = body.displayName.trim();
    if (!trimmed) throw new AppError('Tên hiển thị không hợp lệ', 400, 'VALIDATION_ERROR');
    setClauses.push('display_name = ?');
    params.push(trimmed);
  }
  if (body?.partnerName !== undefined) {
    const trimmed = body.partnerName.trim();
    if (!trimmed) throw new AppError('Tên người yêu không hợp lệ', 400, 'VALIDATION_ERROR');
    setClauses.push('partner_name = ?');
    params.push(trimmed);
  }
  if (setClauses.length === 0) {
    throw new AppError('Không có trường nào cần cập nhật', 400, 'VALIDATION_ERROR');
  }

  const nowIso = new Date().toISOString();
  setClauses.push('updated_at = ?');
  params.push(nowIso, userId);

  const res = await execute(
    c.env.DB,
    `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`,
    params,
  );
  if ((res.meta?.changes ?? 0) === 0) {
    throw new AppError('Không tìm thấy người dùng', 404, 'USER_NOT_FOUND');
  }

  const updated = await queryOne<UserRow & { couple_code: string | null }>(
    c.env.DB,
    `SELECT u.*, c.code AS couple_code
     FROM users u
     LEFT JOIN couples c ON u.couple_id = c.id
     WHERE u.id = ? LIMIT 1`,
    [userId],
  );

  return c.json({
    user: updated
      ? {
          _id: updated.id,
          id: updated.id,
          displayName: updated.display_name,
          partnerName: updated.partner_name,
          email: updated.email ?? undefined,
          avatarUrl: updated.avatar_url ?? undefined,
          status: updated.status,
          coupleId: updated.couple_id
            ? { _id: updated.couple_id, id: updated.couple_id, code: updated.couple_code ?? undefined }
            : null,
          createdAt: updated.created_at,
          updatedAt: updated.updated_at,
        }
      : null,
  });
});

adminRoutes.delete('/users/:id', authenticateAdmin, async (c) => {
  const userId = c.req.param('id');
  const existing = await queryOne<UserRow>(
    c.env.DB,
    'SELECT * FROM users WHERE id = ? LIMIT 1',
    [userId],
  );
  if (!existing || existing.role !== 'user') {
    throw new AppError('Không tìm thấy người dùng', 404, 'USER_NOT_FOUND');
  }

  const coupleId = existing.couple_id;
  const remainingMembers = coupleId
    ? await queryAll<{ id: string }>(
        c.env.DB,
        'SELECT id FROM users WHERE couple_id = ? AND id != ?',
        [coupleId, userId],
      )
    : [];
  const shouldDeleteCouple = Boolean(coupleId && remainingMembers.length === 0);

  const checkins = await queryAll<CheckinRow>(
    c.env.DB,
    shouldDeleteCouple
      ? 'SELECT storage_path FROM checkins WHERE couple_id = ? AND storage_path IS NOT NULL'
      : 'SELECT storage_path FROM checkins WHERE owner_id = ? AND storage_path IS NOT NULL',
    [shouldDeleteCouple ? coupleId : userId],
  );
  const messages = await queryAll<ChatMessageRow>(
    c.env.DB,
    shouldDeleteCouple
      ? 'SELECT storage_path FROM chat_messages WHERE couple_id = ? AND storage_path IS NOT NULL'
      : 'SELECT storage_path FROM chat_messages WHERE sender_id = ? AND storage_path IS NOT NULL',
    [shouldDeleteCouple ? coupleId : userId],
  );
  for (const row of [...checkins, ...messages]) {
    if (row.storage_path) {
      await deleteStoredFile(c.env.STORAGE, row.storage_path, c.get('config').R2_PUBLIC_URL);
    }
  }
  if (existing.avatar_url) {
    await deleteStoredFile(c.env.STORAGE, existing.avatar_url, c.get('config').R2_PUBLIC_URL);
  }
  if (existing.partner_avatar_url) {
    await deleteStoredFile(c.env.STORAGE, existing.partner_avatar_url, c.get('config').R2_PUBLIC_URL);
  }

  let otpDeleted = 0;
  if (existing.email) {
    const otpRes = await execute(c.env.DB, 'DELETE FROM otp_codes WHERE lower(email) = ?', [
      existing.email.toLowerCase(),
    ]);
    otpDeleted = Number(otpRes.meta?.changes ?? 0);
  }

  const pushRes = await execute(
    c.env.DB,
    shouldDeleteCouple
      ? 'DELETE FROM push_subscriptions WHERE couple_id = ?'
      : 'DELETE FROM push_subscriptions WHERE user_id = ?',
    [shouldDeleteCouple ? coupleId : userId],
  );
  const randomRes = await execute(
    c.env.DB,
    shouldDeleteCouple
      ? 'DELETE FROM random_events WHERE couple_id = ?'
      : 'DELETE FROM random_events WHERE user_id = ?',
    [shouldDeleteCouple ? coupleId : userId],
  );
  const checkinsRes = await execute(
    c.env.DB,
    shouldDeleteCouple
      ? 'DELETE FROM checkins WHERE couple_id = ?'
      : 'DELETE FROM checkins WHERE owner_id = ?',
    [shouldDeleteCouple ? coupleId : userId],
  );
  await execute(
    c.env.DB,
    shouldDeleteCouple
      ? 'DELETE FROM chat_messages WHERE couple_id = ?'
      : 'DELETE FROM chat_messages WHERE sender_id = ?',
    [shouldDeleteCouple ? coupleId : userId],
  );
  const userRes = await execute(c.env.DB, 'DELETE FROM users WHERE id = ?', [userId]);

  let couplesDeleted = 0;
  let reactionsRemoved = 0;
  if (shouldDeleteCouple && coupleId) {
    const coupleRes = await execute(c.env.DB, 'DELETE FROM couples WHERE id = ?', [coupleId]);
    couplesDeleted = Number(coupleRes.meta?.changes ?? 0);
  } else if (coupleId) {
    const partnerCheckins = await queryAll<CheckinRow>(
      c.env.DB,
      'SELECT id, reactions_json, replies_json FROM checkins WHERE couple_id = ?',
      [coupleId],
    );
    const nowIso = new Date().toISOString();
    for (const ci of partnerCheckins) {
      const reactions = parseJsonSafe<CheckinReactionItem[]>(ci.reactions_json, []);
      const replies = parseJsonSafe<CheckinReplyItem[]>(ci.replies_json, []);
      const nextReactions = reactions.filter((r) => r.userId !== userId);
      const nextReplies = replies.filter((r) => r.userId !== userId);
      if (nextReactions.length !== reactions.length || nextReplies.length !== replies.length) {
        await execute(
          c.env.DB,
          'UPDATE checkins SET reactions_json = ?, replies_json = ?, updated_at = ? WHERE id = ?',
          [JSON.stringify(nextReactions), JSON.stringify(nextReplies), nowIso, ci.id],
        );
        reactionsRemoved += 1;
      }
    }
  }

  return c.json({
    success: true,
    deleted: {
      users: Number(userRes.meta?.changes ?? 0),
      couples: couplesDeleted,
      checkIns: Number(checkinsRes.meta?.changes ?? 0),
      randomEvents: Number(randomRes.meta?.changes ?? 0),
      pushSubscriptions: Number(pushRes.meta?.changes ?? 0),
      otpCodes: otpDeleted,
    },
    updated: {
      reactions: reactionsRemoved,
    },
  });
});

adminRoutes.get('/couples', authenticateAdmin, async (c) => {
  const { page, limit, offset } = parsePageLimit(c.req.query());
  const countRow = await queryOne<{ cnt: number }>(c.env.DB, 'SELECT COUNT(*) AS cnt FROM couples');
  const total = Number(countRow?.cnt ?? 0);

  const coupleRows = await queryAll<CoupleRow>(
    c.env.DB,
    'SELECT * FROM couples ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [limit, offset],
  );

  const coupleIds = coupleRows.map((cRow) => cRow.id);
  const membersByCouple = new Map<string, UserRow[]>();
  if (coupleIds.length > 0) {
    const placeholders = coupleIds.map(() => '?').join(', ');
    const memberRows = await queryAll<UserRow>(
      c.env.DB,
      `SELECT * FROM users WHERE couple_id IN (${placeholders})`,
      coupleIds,
    );
    for (const member of memberRows) {
      if (!member.couple_id) continue;
      const arr = membersByCouple.get(member.couple_id) ?? [];
      arr.push(member);
      membersByCouple.set(member.couple_id, arr);
    }
  }

  const couples = coupleRows.map((row) => ({
    _id: row.id,
    id: row.id,
    code: row.code,
    loveStartDate: row.love_start_date ?? undefined,
    streak: row.streak,
    memberIds: (membersByCouple.get(row.id) ?? []).map((m) => ({
      _id: m.id,
      id: m.id,
      displayName: m.display_name,
      email: m.email ?? undefined,
      avatarUrl: m.avatar_url ?? undefined,
      status: m.status,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return c.json({
    couples,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

adminRoutes.patch('/couples/:id', authenticateAdmin, async (c) => {
  const coupleId = c.req.param('id');
  const body = (await c.req.json().catch(() => null)) as { loveStartDate?: string; code?: string } | null;
  const setClauses: string[] = [];
  const params: unknown[] = [];

  if (body?.loveStartDate !== undefined) {
    if (typeof body.loveStartDate !== 'string') {
      throw new AppError('Ngày bắt đầu yêu không hợp lệ', 400, 'VALIDATION_ERROR');
    }
    setClauses.push('love_start_date = ?');
    params.push(body.loveStartDate.trim() || null);
  }
  if (body?.code !== undefined) {
    const normalized = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    if (!normalized) {
      throw new AppError('Mã cặp đôi không hợp lệ', 400, 'VALIDATION_ERROR');
    }
    setClauses.push('code = ?');
    params.push(normalized);
  }
  if (setClauses.length === 0) {
    throw new AppError('Không có trường nào cần cập nhật', 400, 'VALIDATION_ERROR');
  }

  const nowIso = new Date().toISOString();
  setClauses.push('updated_at = ?');
  params.push(nowIso, coupleId);

  const res = await execute(
    c.env.DB,
    `UPDATE couples SET ${setClauses.join(', ')} WHERE id = ?`,
    params,
  );
  if ((res.meta?.changes ?? 0) === 0) {
    throw new AppError('Không tìm thấy couple', 404, 'COUPLE_NOT_FOUND');
  }

  const row = (await queryOne<CoupleRow>(c.env.DB, 'SELECT * FROM couples WHERE id = ? LIMIT 1', [coupleId]))!;
  const members = await queryAll<UserRow>(c.env.DB, 'SELECT * FROM users WHERE couple_id = ?', [coupleId]);

  return c.json({
    couple: {
      _id: row.id,
      id: row.id,
      code: row.code,
      loveStartDate: row.love_start_date ?? undefined,
      streak: row.streak,
      memberIds: members.map((m) => ({
        _id: m.id,
        id: m.id,
        displayName: m.display_name,
        email: m.email ?? undefined,
        avatarUrl: m.avatar_url ?? undefined,
        status: m.status,
      })),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  });
});

adminRoutes.get('/checkins', authenticateAdmin, async (c) => {
  const { page, limit, offset } = parsePageLimit(c.req.query());
  const includeDeleted = c.req.query('includeDeleted') === 'true';
  const coupleId = c.req.query('coupleId')?.trim();

  const whereClauses: string[] = [];
  const params: unknown[] = [];
  if (!includeDeleted) {
    whereClauses.push('ci.deleted_at IS NULL');
  }
  if (coupleId) {
    whereClauses.push('ci.couple_id = ?');
    params.push(coupleId);
  }
  const whereSql = whereClauses.length > 0 ? whereClauses.join(' AND ') : '1 = 1';
  const countRow = await queryOne<{ cnt: number }>(
    c.env.DB,
    `SELECT COUNT(*) AS cnt FROM checkins ci WHERE ${whereSql}`,
    params,
  );
  const total = Number(countRow?.cnt ?? 0);

  const rows = await queryAll<CheckinRow & { owner_avatar: string | null }>(
    c.env.DB,
    `SELECT ci.*, u.avatar_url AS owner_avatar
     FROM checkins ci
     LEFT JOIN users u ON ci.owner_id = u.id
     WHERE ${whereSql}
     ORDER BY ci.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const checkIns = rows.map((row) => ({
    _id: row.id,
    id: row.id,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    ownerAvatar: row.owner_avatar ?? undefined,
    type: row.type,
    caption: row.caption ?? undefined,
    mood: row.mood ?? undefined,
    imageUrl: row.image_url ?? undefined,
    deletedAt: row.deleted_at ?? undefined,
    coupleId: row.couple_id,
    createdAt: row.created_at,
  }));

  return c.json({
    checkIns,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

adminRoutes.delete('/checkins/:id', authenticateAdmin, async (c) => {
  const checkinId = c.req.param('id');
  const existing = await queryOne<CheckinRow>(
    c.env.DB,
    'SELECT * FROM checkins WHERE id = ? LIMIT 1',
    [checkinId],
  );
  if (!existing) {
    throw new AppError('Không tìm thấy check-in', 404, 'CHECKIN_NOT_FOUND');
  }

  const nowIso = new Date().toISOString();
  await execute(
    c.env.DB,
    'UPDATE checkins SET deleted_at = COALESCE(deleted_at, ?), updated_at = ? WHERE id = ?',
    [nowIso, nowIso, checkinId],
  );
  return c.json({ success: true });
});

adminRoutes.get('/random-events', authenticateAdmin, async (c) => {
  const { page, limit, offset } = parsePageLimit(c.req.query());
  const countRow = await queryOne<{ cnt: number }>(c.env.DB, 'SELECT COUNT(*) AS cnt FROM random_events');
  const total = Number(countRow?.cnt ?? 0);

  const rows = await queryAll<RandomEventRow & { user_name: string | null; couple_code: string | null }>(
    c.env.DB,
    `SELECT re.*, u.display_name AS user_name, co.code AS couple_code
     FROM random_events re
     LEFT JOIN users u ON re.user_id = u.id
     LEFT JOIN couples co ON re.couple_id = co.id
     ORDER BY re.created_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset],
  );

  const events = rows.map((row) => ({
    _id: row.id,
    id: row.id,
    category: row.category,
    prompt: row.prompt,
    detail: row.detail ?? undefined,
    userId: { _id: row.user_id, id: row.user_id, displayName: row.user_name ?? 'Ẩn danh' },
    coupleId: { _id: row.couple_id, id: row.couple_id, code: row.couple_code ?? undefined },
    createdAt: row.created_at,
  }));

  return c.json({
    events,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});
