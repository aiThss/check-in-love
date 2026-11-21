import type { WorkerEnv } from '../config/env';
import { resolveConfig } from '../config/env';
import { execute, findPartnerUser, queryAll, queryOne } from '../db/d1';
import { type CheckinRow, type UserRow } from '../db/types';
import { logger } from '../utils/logger';
import { sendPushToUser } from './push';
import { emitRealtimeEvent } from './realtime';
import { deleteStoredFile } from './storage';
import { getVNDateKey } from './streak';

const DAILY_SCHEDULES: Array<{
  hour: number;
  minute: number;
  tag: string;
  getMessage: (partnerName: string) => { title: string; body: string; url: string };
}> = [
  {
    hour: 7,
    minute: 0,
    tag: 'daily-checkin-07',
    getMessage: (partnerName) => ({
      title: 'Chào buổi sáng hai bạn! ☀️',
      body: `Gửi một check-in đầu ngày cho ${partnerName || 'người ấy'} nhé!`,
      url: '/app/checkin',
    }),
  },
  {
    hour: 12,
    minute: 0,
    tag: 'daily-checkin-12',
    getMessage: (partnerName) => ({
      title: 'Giờ nghỉ trưa tới rồi 🍜',
      body: `Hôm nay ăn gì nè? Chụp một bức ảnh khoe ${partnerName || 'người ấy'} đi!`,
      url: '/app/checkin',
    }),
  },
  {
    hour: 18,
    minute: 0,
    tag: 'daily-checkin-18',
    getMessage: (partnerName) => ({
      title: 'Chiều êm đềm 🌅',
      body: `Cuối ngày rồi, kể cho ${partnerName || 'người ấy'} nghe hôm nay của bạn thế nào?`,
      url: '/app/checkin',
    }),
  },
  {
    hour: 23,
    minute: 0,
    tag: 'daily-checkin-23',
    getMessage: (partnerName) => ({
      title: 'Chúc ngủ ngon 🌙',
      body: `Đừng quên giữ streak cùng ${partnerName || 'người ấy'} trước khi đi ngủ nhé 💕`,
      url: '/app/checkin',
    }),
  },
];

function getZoneClock(date: Date, timeZone: string): { dateKey: string; timeHHMM: string; hour: number; minute: number } {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const map = new Map(parts.map((p) => [p.type, p.value]));
    const year = map.get('year') ?? '1970';
    const month = map.get('month') ?? '01';
    const day = map.get('day') ?? '01';
    const hourStr = (map.get('hour') === '24' ? '00' : map.get('hour')) ?? '00';
    const minStr = map.get('minute') ?? '00';
    return {
      dateKey: `${year}-${month}-${day}`,
      timeHHMM: `${hourStr}:${minStr}`,
      hour: Number.parseInt(hourStr, 10),
      minute: Number.parseInt(minStr, 10),
    };
  } catch {
    return getZoneClock(date, 'Asia/Ho_Chi_Minh');
  }
}

async function claimDailyCronLock(db: D1Database, lockKey: string, dateKey: string): Promise<boolean> {
  const existing = await queryOne<{ value: string }>(
    db,
    'SELECT value FROM system_kv WHERE key = ? LIMIT 1',
    [lockKey],
  );
  if (existing?.value === dateKey) return false;

  const nowIso = new Date().toISOString();
  const res = await execute(
    db,
    `INSERT INTO system_kv (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
     WHERE system_kv.value != excluded.value`,
    [lockKey, dateKey, nowIso],
  );
  return (res.meta?.changes ?? 0) > 0;
}

export async function runScheduledTasks(env: WorkerEnv, now: Date = new Date()): Promise<void> {
  const config = resolveConfig(env);
  const vnClock = getZoneClock(now, 'Asia/Ho_Chi_Minh');

  // 1) Per-user custom reminder check
  const reminderCandidates = await queryAll<UserRow>(
    env.DB,
    `SELECT * FROM users
     WHERE reminder_enabled = 1
       AND status = 'active'
       AND couple_id IS NOT NULL`,
  );

  for (const user of reminderCandidates) {
    const tz = user.reminder_timezone || 'Asia/Ho_Chi_Minh';
    const localClock = getZoneClock(now, tz);
    if (user.reminder_time !== localClock.timeHHMM) continue;
    if (user.reminder_last_sent_date === localClock.dateKey) continue;

    // Atomic lease to avoid double delivery across retries
    const leaseRes = await execute(
      env.DB,
      `UPDATE users
       SET reminder_lease_date = ?, updated_at = ?
       WHERE id = ?
         AND (reminder_lease_date IS NULL OR reminder_lease_date != ?)
         AND (reminder_last_sent_date IS NULL OR reminder_last_sent_date != ?)`,
      [localClock.dateKey, now.toISOString(), user.id, localClock.dateKey, localClock.dateKey],
    );
    if ((leaseRes.meta?.changes ?? 0) === 0) continue;

    // Skip if user already checked in today (VN date / local recent 24h check)
    const todayCheckins = await queryAll<{ created_at: string }>(
      env.DB,
      `SELECT created_at FROM checkins
       WHERE owner_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC LIMIT 5`,
      [user.id],
    );
    const hasCheckedInToday = todayCheckins.some(
      (c) => getZoneClock(new Date(c.created_at), tz).dateKey === localClock.dateKey,
    );
    if (hasCheckedInToday) {
      await execute(
        env.DB,
        'UPDATE users SET reminder_last_sent_date = ?, reminder_lease_date = NULL, updated_at = ? WHERE id = ?',
        [localClock.dateKey, now.toISOString(), user.id],
      );
      continue;
    }

    const partner = await findPartnerUser(env.DB, user.couple_id, user.id);
    const partnerName = partner?.display_name || user.partner_name || 'người ấy';

    try {
      await sendPushToUser(env, config, user.id, {
        title: 'Đã đến giờ Check IN rồi 💕',
        body: `Gửi một khoảnh khắc nhỏ trong ngày cho ${partnerName} nhé!`,
        url: '/app/checkin',
        targetUrl: '/app/checkin',
        tag: `checkin-reminder-${localClock.dateKey}`,
        kind: 'reminder',
        actionType: 'reminder',
        type: 'reminder',
        senderName: 'Check IN Love',
      });

      await emitRealtimeEvent(env, user.id, {
        type: 'reminder',
        title: 'Đã đến giờ Check IN rồi 💕',
        body: `Gửi một khoảnh khắc nhỏ trong ngày cho ${partnerName} nhé!`,
        targetUrl: '/app/checkin',
        url: '/app/checkin',
      });

      await execute(
        env.DB,
        'UPDATE users SET reminder_last_sent_date = ?, reminder_lease_date = NULL, updated_at = ? WHERE id = ?',
        [localClock.dateKey, now.toISOString(), user.id],
      );
    } catch (err) {
      await execute(
        env.DB,
        'UPDATE users SET reminder_lease_date = NULL, updated_at = ? WHERE id = ? AND reminder_lease_date = ?',
        [now.toISOString(), user.id, localClock.dateKey],
      );
      logger.error('Failed scheduled check-in reminder', err, { userId: user.id });
    }
  }

  // 2) Fixed VN daily broadcasts (07:00, 12:00, 18:00, 23:00)
  for (const schedule of DAILY_SCHEDULES) {
    if (vnClock.hour !== schedule.hour || vnClock.minute !== schedule.minute) continue;
    const locked = await claimDailyCronLock(env.DB, `cron:${schedule.tag}`, vnClock.dateKey);
    if (!locked) continue;

    const users = await queryAll<UserRow>(
      env.DB,
      `SELECT * FROM users
       WHERE status = 'active'
         AND couple_id IS NOT NULL
         AND (
           fcm_tokens_json != '[]'
           OR EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = users.id)
         )`,
    );

    const vnToday = getVNDateKey(now);
    for (const user of users) {
      const latest = await queryOne<{ created_at: string }>(
        env.DB,
        'SELECT created_at FROM checkins WHERE owner_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1',
        [user.id],
      );
      if (latest && getVNDateKey(new Date(latest.created_at)) === vnToday) continue;

      const msg = schedule.getMessage(user.partner_name);
      await sendPushToUser(env, config, user.id, {
        title: msg.title,
        body: msg.body,
        url: msg.url,
        targetUrl: msg.url,
        tag: schedule.tag,
        kind: 'reminder',
        actionType: 'reminder',
        type: 'reminder',
        senderName: 'Check IN Love',
      });
    }
  }

  // 3) 03:00 VN: Purge expired OTPs & soft-deleted check-ins older than 30 days
  if (vnClock.hour === 3 && vnClock.minute === 0) {
    const locked = await claimDailyCronLock(env.DB, 'cron:cleanup-03', vnClock.dateKey);
    if (!locked) return;

    try {
      await execute(env.DB, 'DELETE FROM otp_codes WHERE expires_at < ?', [now.toISOString()]);

      const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const staleCheckins = await queryAll<CheckinRow>(
        env.DB,
        'SELECT * FROM checkins WHERE deleted_at IS NOT NULL AND deleted_at < ? LIMIT 200',
        [cutoff],
      );

      for (const item of staleCheckins) {
        if (item.storage_path) {
          await deleteStoredFile(env.STORAGE, item.storage_path, config.R2_PUBLIC_URL);
        }
        await execute(env.DB, 'DELETE FROM checkins WHERE id = ?', [item.id]);
      }
    } catch (err) {
      logger.error('Cron cleanup error', err);
    }
  }
}
