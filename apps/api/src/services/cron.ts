import cron from 'node-cron';
import { PushSubscription } from '../db/models/PushSubscription';
import { sendPushToUser } from './push';

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
      sendPushToUser(userId as string, {
        title: 'Check IN Love 💕',
        body: message,
      }),
    );
    await Promise.allSettled(tasks);
    console.log(`[cron] Broadcasted push to ${subs.length} users: ${message}`);
  } catch (err) {
    console.error('[cron] Error broadcasting push:', err);
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

  console.log('[cron] Scheduled push notification jobs initialized.');
}
