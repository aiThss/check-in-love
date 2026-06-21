import cron from 'node-cron';
import { PushSubscription } from '../db/models/PushSubscription';
import { CheckIn } from '../db/models/CheckIn';
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
