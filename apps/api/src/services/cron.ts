import cron from 'node-cron';
import { PushSubscription } from '../db/models/PushSubscription';
import { CheckIn } from '../db/models/CheckIn';
import { User } from '../db/models/User';
import { sendPushToUser } from './push';
import { storageService } from './storage';
import { logger } from '../utils/logger';

const MESSAGES = {
  m7: [
    'Dậy chưa người đẹp ơi! ☀️',
    'Chào buổi sáng người yêu! 🥰',
    'Dậy thôi cô bé ơi, ngày mới tốt lành! 🌻',
  ],
  m12: [
    'Trưa rồi, nhớ ăn uống đầy đủ nha! 🍲',
    'Nghỉ tay đi ăn trưa thôi bé ơi! 🍱',
    'Đừng bỏ bữa trưa nhé người đẹp! 🥗',
  ],
  m18: [
    'Chiều rồi, làm về mệt không? Nhớ ăn tối nhé! 🍛',
    'Đến giờ nạp năng lượng buổi tối rồi! 🥘',
    'Ăn tối thật ngon miệng nha cô bé! 🍲',
  ],
  m23: [
    'Muộn rồi, đi ngủ thôi người đẹp! 😴',
    'Ngủ ngon nha cô bé, mơ đẹp nhé! 🌙',
    'Chúc người yêu ngủ thật ngon! ✨',
  ],
};

function getLocalReminderTime(timezone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    time: `${value('hour')}:${value('minute')}`,
  };
}

async function sendScheduledCheckinReminders(): Promise<void> {
  const users = await User.find({ 'checkinReminder.enabled': true }).lean();

  await Promise.allSettled(users.map(async (user) => {
    const reminder = user.checkinReminder;
    if (!reminder?.enabled) return;

    const { date, time } = getLocalReminderTime(reminder.timezone || 'Asia/Ho_Chi_Minh');
    if (time !== reminder.time || reminder.lastSentDate === date) return;

    // Claim this reminder atomically: multiple API instances cannot send it twice.
    const claimed = await User.findOneAndUpdate(
      {
        _id: user._id,
        'checkinReminder.enabled': true,
        'checkinReminder.time': reminder.time,
        'checkinReminder.lastSentDate': { $ne: date },
        'checkinReminder.leaseDate': { $ne: date },
      },
      { $set: { 'checkinReminder.leaseDate': date } },
      { new: true },
    ).lean();

    if (!claimed) return;

    try {
      await sendPushToUser(user._id.toString(), {
        title: 'Check-in Love 💕',
        body: 'Hôm nay, bạn muốn gửi một điều nhỏ cho người ấy không?',
        actionType: 'reminder',
        targetUrl: '/app/checkin',
        tag: `checkin-reminder-${date}`,
      });
      await User.updateOne(
        { _id: user._id, 'checkinReminder.leaseDate': date },
        { $set: { 'checkinReminder.lastSentDate': date }, $unset: { 'checkinReminder.leaseDate': '' } },
      );
    } catch (err) {
      await User.updateOne(
        { _id: user._id, 'checkinReminder.leaseDate': date },
        { $unset: { 'checkinReminder.leaseDate': '' } },
      );
      logger.error('[cron] Failed scheduled check-in reminder', err, { userId: user._id.toString() });
    }
  }));
}

function getRandomMessage(timeKey: keyof typeof MESSAGES): string {
  const list = MESSAGES[timeKey];
  return list[Math.floor(Math.random() * list.length)];
}

async function broadcastPush(message: string) {
  try {
    const subs = await PushSubscription.find().distinct('userId');
    const tasks = subs.map((userId) =>
      sendPushToUser(userId.toString(), {
        title: 'Check IN Love 💕',
        body: message,
        senderName: 'Check IN Love',
        actionType: 'reminder',
        targetUrl: '/app/home',
      }),
    );
    await Promise.allSettled(tasks);
    logger.info(`[cron] Broadcasted push to ${subs.length} users`, { message });
  } catch (err) {
    logger.error('[cron] Error broadcasting push', err);
  }
}

/**
 * Clean up files and records of check-ins that were soft-deleted more than 30 days ago.
 */
async function cleanupDeletedCheckins(): Promise<void> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Find check-ins soft-deleted more than 30 days ago
    const expiredCheckins = await CheckIn.find({
      deletedAt: { $lt: thirtyDaysAgo },
    });

    if (expiredCheckins.length === 0) {
      return;
    }

    logger.info(`[cron] Found ${expiredCheckins.length} expired check-ins to clean up`);

    for (const checkin of expiredCheckins) {
      if (checkin.storagePath) {
        try {
          await storageService.deleteFile(checkin.storagePath);
          logger.info(`[cron] Deleted physical file for check-in: ${checkin._id}`, { storagePath: checkin.storagePath });
        } catch (fileErr) {
          logger.error(`[cron] Failed to delete physical file for check-in ${checkin._id}`, fileErr);
        }
      }
      // Delete document from database
      await CheckIn.deleteOne({ _id: checkin._id });
    }

    logger.info(`[cron] Completed physical cleanup for ${expiredCheckins.length} check-ins`);
  } catch (err) {
    logger.error('[cron] Error during check-in cleanup', err);
  }
}

export function initCronJobs() {
  // Dynamic per-user reminder scheduler. The API container must stay running.
  cron.schedule('* * * * *', () => {
    sendScheduledCheckinReminders().catch((err) => {
      logger.error('[cron] Failed to process scheduled check-in reminders', err);
    });
  }, { timezone: 'UTC' });

  // 7:00 AM
  cron.schedule('0 7 * * *', () => {
    broadcastPush(getRandomMessage('m7'));
  }, { timezone: "Asia/Ho_Chi_Minh" });

  // 12:00 PM
  cron.schedule('0 12 * * *', () => {
    broadcastPush(getRandomMessage('m12'));
  }, { timezone: "Asia/Ho_Chi_Minh" });

  // 18:00 PM
  cron.schedule('0 18 * * *', () => {
    broadcastPush(getRandomMessage('m18'));
  }, { timezone: "Asia/Ho_Chi_Minh" });

  // 23:00 PM
  cron.schedule('0 23 * * *', () => {
    broadcastPush(getRandomMessage('m23'));
  }, { timezone: "Asia/Ho_Chi_Minh" });

  // 3:00 AM: Clean up soft-deleted checkins
  cron.schedule('0 3 * * *', () => {
    cleanupDeletedCheckins().catch((err) => {
      console.error('[cron] Failed to run cleanupDeletedCheckins job:', err);
    });
  }, { timezone: "Asia/Ho_Chi_Minh" });

  console.log('[cron] Scheduled push notification and cleanup jobs initialized.');
}
