import { execute, queryAll, queryOne } from '../db/d1';

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function getVNDateKey(date: Date = new Date()): string {
  const vnDate = new Date(date.getTime() + VN_OFFSET_MS);
  const year = vnDate.getUTCFullYear();
  const month = String(vnDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(vnDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getPreviousVNDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day) - DAY_MS);
  return utcDate.toISOString().slice(0, 10);
}

export function getVNMinutesOfDay(date: Date = new Date()): number {
  const vnDate = new Date(date.getTime() + VN_OFFSET_MS);
  return vnDate.getUTCHours() * 60 + vnDate.getUTCMinutes();
}

export function calculateCurrentStreak(dateKeys: Iterable<string>, now: Date = new Date()): number {
  const uniqueDates = new Set(Array.from(dateKeys).filter(Boolean));
  if (uniqueDates.size === 0) return 0;

  const today = getVNDateKey(now);
  const yesterday = getPreviousVNDateKey(today);
  let cursor = uniqueDates.has(today) ? today : uniqueDates.has(yesterday) ? yesterday : null;
  if (!cursor) return 0;

  let streak = 0;
  while (cursor && uniqueDates.has(cursor)) {
    streak += 1;
    cursor = getPreviousVNDateKey(cursor);
  }
  return streak;
}

export async function recalculateCoupleStreak(
  db: D1Database,
  coupleId: string,
  now: Date = new Date(),
): Promise<{ streak: number; lastCheckinDate: string | null }> {
  const couple = await queryOne<{ id: string }>(
    db,
    'SELECT id FROM couples WHERE id = ? LIMIT 1',
    [coupleId],
  );
  if (!couple) return { streak: 0, lastCheckinDate: null };

  const rows = await queryAll<{ created_at: string }>(
    db,
    `SELECT created_at
     FROM checkins
     WHERE couple_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC
     LIMIT 3650`,
    [coupleId],
  );

  const dateKeys = rows.map((row) => getVNDateKey(new Date(row.created_at)));
  const streak = calculateCurrentStreak(dateKeys, now);
  const lastCheckinDate = dateKeys[0] ?? null;

  await execute(
    db,
    'UPDATE couples SET streak = ?, last_checkin_date = ?, updated_at = ? WHERE id = ?',
    [streak, lastCheckinDate, now.toISOString(), coupleId],
  );

  return { streak, lastCheckinDate };
}
