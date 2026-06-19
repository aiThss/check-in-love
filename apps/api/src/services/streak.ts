import { Types } from 'mongoose';
import { CheckIn } from '../db/models/CheckIn';
import { Couple } from '../db/models/Couple';

/**
 * Recalculates and persists the streak for a couple after a new check-in.
 * Returns the updated streak value.
 */
export async function updateStreak(coupleId: string): Promise<number> {
  const couple = await Couple.findById(coupleId);
  if (!couple) {
    throw new Error(`Couple not found: ${coupleId}`);
  }

  // Find most recent non-deleted check-in for this couple
  const latestCheckIn = await CheckIn.findOne({
    coupleId: new Types.ObjectId(coupleId),
    deletedAt: null,
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!latestCheckIn) {
    // No check-ins at all; reset streak
    couple.streak = 0;
    couple.lastCheckinDate = undefined;
    await couple.save();
    return 0;
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);

  const lastCheckinDate = couple.lastCheckinDate;

  let newStreak: number;

  if (!lastCheckinDate) {
    // First ever check-in
    newStreak = 1;
  } else {
    const lastDay = new Date(
      lastCheckinDate.getFullYear(),
      lastCheckinDate.getMonth(),
      lastCheckinDate.getDate(),
    );

    if (lastDay.getTime() === todayStart.getTime()) {
      // Already checked in today; maintain streak
      newStreak = couple.streak;
    } else if (lastDay.getTime() === yesterdayStart.getTime()) {
      // Checked in yesterday; increment streak
      newStreak = couple.streak + 1;
    } else {
      // Missed more than 1 day; reset to 1
      newStreak = 1;
    }
  }

  couple.streak = newStreak;
  couple.lastCheckinDate = now;
  await couple.save();

  return newStreak;
}
