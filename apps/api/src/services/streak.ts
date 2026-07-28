import { Types } from 'mongoose';
import { CheckIn } from '../db/models/CheckIn';
import { Couple } from '../db/models/Couple';

const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7

interface DailyCheckin {
  _id: string;
  latestAt: Date;
}

export interface StreakSnapshot {
  streak: number;
  lastCheckinDate?: Date;
}

function getVNDayKey(date: Date): string {
  const vnTime = new Date(date.getTime() + VN_OFFSET_MS);
  const year = vnTime.getUTCFullYear();
  const month = String(vnTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(vnTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftDayKey(dayKey: string, offsetDays: number): string {
  const [year, month, day] = dayKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + offsetDays));
  return shifted.toISOString().slice(0, 10);
}

/**
 * Calculates the active daily streak in Vietnam time from distinct YYYY-MM-DD keys.
 * A streak remains active during the day after the latest check-in, then expires.
 */
export function calculateCurrentStreak(
  dayKeys: Iterable<string>,
  now: Date = new Date(),
): number {
  const activeDays = new Set(dayKeys);
  const today = getVNDayKey(now);
  const yesterday = shiftDayKey(today, -1);

  let cursor: string | null = activeDays.has(today)
    ? today
    : activeDays.has(yesterday)
      ? yesterday
      : null;

  let streak = 0;
  while (cursor && activeDays.has(cursor)) {
    streak += 1;
    cursor = shiftDayKey(cursor, -1);
  }

  return streak;
}

/**
 * Recalculates the streak from the actual non-deleted check-in history.
 * This self-heals stale counters and has no artificial maximum.
 */
export async function recalculateStreak(coupleId: string): Promise<StreakSnapshot> {
  const couple = await Couple.findById(coupleId);
  if (!couple) {
    throw new Error(`Couple not found: ${coupleId}`);
  }

  const dailyCheckins = await CheckIn.aggregate<DailyCheckin>([
    {
      $match: {
        coupleId: new Types.ObjectId(coupleId),
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            date: '$createdAt',
            format: '%Y-%m-%d',
            timezone: '+07:00',
          },
        },
        latestAt: { $max: '$createdAt' },
      },
    },
    { $sort: { _id: -1 } },
  ]);

  const snapshot: StreakSnapshot = {
    streak: calculateCurrentStreak(dailyCheckins.map((item) => item._id)),
    lastCheckinDate: dailyCheckins[0]?.latestAt,
  };

  couple.streak = snapshot.streak;
  couple.lastCheckinDate = snapshot.lastCheckinDate;
  await couple.save();

  return snapshot;
}

/**
 * Recalculates and persists the streak after a check-in.
 * Returns the updated streak value for existing callers.
 */
export async function updateStreak(coupleId: string): Promise<number> {
  return (await recalculateStreak(coupleId)).streak;
}
