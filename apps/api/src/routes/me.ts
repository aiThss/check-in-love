import { Hono, type Context } from 'hono';
import { z } from 'zod';
import {
  execute,
  findCoupleById,
  findCoupleMembers,
  findPartnerUser,
  findUserById,
} from '../db/d1';
import { toCoupleDto, toUserDto } from '../db/types';
import { authenticate } from '../middleware/auth';
import { emitRealtimeEvent } from '../services/realtime';
import { deleteStoredFile, isUploadedFile, saveUploadedImage } from '../services/storage';
import { recalculateCoupleStreak } from '../services/streak';
import type { HonoAppEnv } from '../types/hono';
import { AppError } from '../utils/errors';

export const meRoutes = new Hono<HonoAppEnv>();

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  partnerName: z.string().trim().min(1).max(60).optional(),
  loveStartDate: z.string().trim().max(40).nullable().optional(),
  birthday: z.string().trim().max(40).nullable().optional(),
  partnerBirthday: z.string().trim().max(40).nullable().optional(),
});

const reminderSchema = z.object({
  enabled: z.boolean(),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Giờ nhắc phải có dạng HH:MM').optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
});

meRoutes.get('/me', authenticate, async (c) => {
  const auth = c.get('user')!;
  const user = (await findUserById(c.env.DB, auth.id))!;
  let couple = user.couple_id ? await findCoupleById(c.env.DB, user.couple_id) : null;
  if (couple) {
    const streakSnapshot = await recalculateCoupleStreak(c.env.DB, couple.id);
    couple = {
      ...couple,
      streak: streakSnapshot.streak,
      last_checkin_date: streakSnapshot.lastCheckinDate,
    };
  }
  const members = couple ? await findCoupleMembers(c.env.DB, couple.id) : [];
  const partner = members.find((m) => m.id !== user.id) ?? null;

  return c.json({
    user: toUserDto(user),
    couple: couple ? toCoupleDto(couple, members.map((m) => m.id)) : null,
    partnerUser: partner ? toUserDto(partner) : undefined,
  });
});

meRoutes.patch('/me', authenticate, async (c) => {
  const auth = c.get('user')!;
  const body = await c.req.json().catch(() => null);
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message || 'Dữ liệu hồ sơ không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const user = (await findUserById(c.env.DB, auth.id))!;
  const nowIso = new Date().toISOString();
  const data = parsed.data;

  const nextDisplayName = data.displayName ?? user.display_name;
  const nextPartnerName = data.partnerName ?? user.partner_name;
  const nextBirthday = data.birthday !== undefined ? data.birthday : user.birthday;
  const nextPartnerBirthday =
    data.partnerBirthday !== undefined ? data.partnerBirthday : user.partner_birthday;

  await execute(
    c.env.DB,
    `UPDATE users
     SET display_name = ?, partner_name = ?, birthday = ?, partner_birthday = ?, updated_at = ?
     WHERE id = ?`,
    [nextDisplayName, nextPartnerName, nextBirthday, nextPartnerBirthday, nowIso, user.id],
  );

  if (data.loveStartDate !== undefined && user.couple_id) {
    await execute(
      c.env.DB,
      'UPDATE couples SET love_start_date = ?, updated_at = ? WHERE id = ?',
      [data.loveStartDate, nowIso, user.couple_id],
    );
  }

  const partner = await findPartnerUser(c.env.DB, user.couple_id, user.id);
  if (partner) {
    await emitRealtimeEvent(c.env, partner.id, {
      type: 'partner.updated',
      senderId: user.id,
      senderName: nextDisplayName,
    });
  }

  const updated = (await findUserById(c.env.DB, user.id))!;
  return c.json({ user: toUserDto(updated) });
});

meRoutes.get('/me/reminder', authenticate, async (c) => {
  const auth = c.get('user')!;
  const user = (await findUserById(c.env.DB, auth.id))!;
  const reminder = {
    enabled: Boolean(user.reminder_enabled),
    time: user.reminder_time || '20:30',
    timezone: user.reminder_timezone || 'Asia/Ho_Chi_Minh',
  };
  return c.json({
    reminder,
    reminderEnabled: reminder.enabled,
    reminderTime: reminder.time,
    reminderTimezone: reminder.timezone,
  });
});

meRoutes.patch('/me/reminder', authenticate, async (c) => {
  const auth = c.get('user')!;
  const body = await c.req.json().catch(() => null);
  const parsed = reminderSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message || 'Cài đặt nhắc nhở không hợp lệ', 400, 'VALIDATION_ERROR');
  }

  const user = (await findUserById(c.env.DB, auth.id))!;
  const nowIso = new Date().toISOString();
  const nextTime = parsed.data.time ?? user.reminder_time ?? '20:30';
  const nextTz = parsed.data.timezone ?? user.reminder_timezone ?? 'Asia/Ho_Chi_Minh';

  await execute(
    c.env.DB,
    `UPDATE users
     SET reminder_enabled = ?,
         reminder_time = ?,
         reminder_timezone = ?,
         reminder_last_sent_date = NULL,
         reminder_lease_date = NULL,
         updated_at = ?
     WHERE id = ?`,
    [parsed.data.enabled ? 1 : 0, nextTime, nextTz, nowIso, user.id],
  );

  const updated = (await findUserById(c.env.DB, user.id))!;
  const reminder = {
    enabled: Boolean(updated.reminder_enabled),
    time: updated.reminder_time,
    timezone: updated.reminder_timezone,
  };
  return c.json({
    reminder,
    reminderEnabled: reminder.enabled,
    reminderTime: reminder.time,
    reminderTimezone: reminder.timezone,
    user: toUserDto(updated),
  });
});

async function handleAvatarUpload(c: Context<HonoAppEnv>, isPartnerAvatar: boolean) {
  const auth = c.get('user')!;
  const config = c.get('config');
  const formData = await c.req.formData().catch(() => null);
  const fileEntry = formData?.get('avatar') ?? formData?.get('file') ?? formData?.get('photo');
  if (!isUploadedFile(fileEntry)) {
    throw new AppError('Vui lòng chọn tệp ảnh đại diện', 400, 'MISSING_FILE');
  }

  const user = (await findUserById(c.env.DB, auth.id))!;
  const oldPath = isPartnerAvatar ? user.partner_avatar_url : user.avatar_url;
  const uploaded = await saveUploadedImage(c.env.STORAGE, config, fileEntry, 'avatars');
  const nowIso = new Date().toISOString();

  if (isPartnerAvatar) {
    await execute(
      c.env.DB,
      'UPDATE users SET partner_avatar_url = ?, updated_at = ? WHERE id = ?',
      [uploaded.url, nowIso, user.id],
    );
  } else {
    await execute(
      c.env.DB,
      'UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ?',
      [uploaded.url, nowIso, user.id],
    );

    const partner = await findPartnerUser(c.env.DB, user.couple_id, user.id);
    if (partner) {
      await execute(
        c.env.DB,
        'UPDATE users SET partner_avatar_url = ?, updated_at = ? WHERE id = ?',
        [uploaded.url, nowIso, partner.id],
      );
      await emitRealtimeEvent(c.env, partner.id, {
        type: 'partner.avatar.updated',
        partnerAvatarUrl: uploaded.url,
        senderId: user.id,
        senderName: user.display_name,
        senderAvatar: uploaded.url,
      });
    }
  }

  if (oldPath && oldPath.includes(uploaded.storagePath) === false) {
    await deleteStoredFile(c.env.STORAGE, oldPath, config.R2_PUBLIC_URL);
  }

  const updated = (await findUserById(c.env.DB, user.id))!;
  return c.json({
    avatarUrl: isPartnerAvatar ? updated.partner_avatar_url : updated.avatar_url,
    user: toUserDto(updated),
  });
}

meRoutes.post('/me/avatar', authenticate, (c) => handleAvatarUpload(c, false));
meRoutes.post('/me/partner-avatar', authenticate, (c) => handleAvatarUpload(c, true));
