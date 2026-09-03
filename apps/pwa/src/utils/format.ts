// ── Date / Time Format Utilities ──────────────────────────────────────────────

/**
 * Human-readable relative time for check-in cards and memory tiles.
 * Returns "Vừa xong", "N phút trước", "N giờ trước", or a full date string.
 */
export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);

  if (diffMin < 1) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffH < 24) return `${diffH} giờ trước`;

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  if (year === now.getFullYear()) {
    return `Lúc ${hours}:${minutes} ${day} tháng ${month}`;
  }
  return `Lúc ${hours}:${minutes} ${day} tháng ${month}, ${year}`;
}

/**
 * Count the number of days between a start date and today.
 */
export function calcDaysTogether(loveStartDate?: string | null): number {
  if (!loveStartDate) return 0;
  const start = new Date(loveStartDate);
  const diff = Date.now() - start.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}
