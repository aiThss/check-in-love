import { getCheckins } from './api/checkins';
import type { CheckIn } from './api/types';
import { store } from './store/index';

const REVEAL_STORAGE_PREFIX = 'lovecheck:daily-surprise:love-foil:v1:';
const DAILY_FIRST_PHOTO_PREFIX = 'lovecheck:daily-surprise:first-partner-photo:v2:';
const MAX_TODAY_PAGES = 20;
const DAILY_RETRY_DELAY_MS = 60_000;
const SPECIAL_MODAL_CLOSED_EVENT = 'lovecheck:special-modal-closed';

let attemptInFlight: Promise<void> | null = null;
let attemptedUserDay = '';
let completedUserDay = '';
let retryTimer: number | null = null;

type DailyAttemptResult = 'completed' | 'retry';

function normalizeImageUrl(value: string): string {
  try {
    return new URL(value, window.location.href).href;
  } catch {
    return value;
  }
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function getLocalDayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLocalDayBounds(date = new Date()): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function isHomeEntry(): boolean {
  const path = window.location.pathname;
  return path === '/app/home' || (path === '/' && store.isAuthenticated());
}

function hasSpecialModal(): boolean {
  return Boolean(document.querySelector('.polaroid-modal-backdrop, .occasion-overlay, .occasion-picker-overlay'));
}

function getRevealStorageKey(imageUrl: string): string {
  return `${REVEAL_STORAGE_PREFIX}${hashString(normalizeImageUrl(imageUrl))}`;
}

function wasImageRevealed(imageUrl: string): boolean {
  try {
    return localStorage.getItem(getRevealStorageKey(imageUrl)) === 'opened';
  } catch {
    return false;
  }
}

function getDailyStorageKey(userId: string, dayKey: string): string {
  return `${DAILY_FIRST_PHOTO_PREFIX}${userId}:${dayKey}`;
}

function wasDailyScratchShown(userId: string, dayKey: string): boolean {
  try {
    return localStorage.getItem(getDailyStorageKey(userId, dayKey)) === 'shown';
  } catch {
    return false;
  }
}

function markDailyScratchShown(userId: string, dayKey: string): void {
  try {
    localStorage.setItem(getDailyStorageKey(userId, dayKey), 'shown');
  } catch {
    // The in-memory attempt guard still prevents duplicate opens in this view.
  }
}

async function loadTodayPartnerPhotos(start: Date, end: Date): Promise<CheckIn[]> {
  const after = new Date(start.getTime() - 1).toISOString();
  const photos: CheckIn[] = [];

  for (let page = 1; page <= MAX_TODAY_PAGES; page += 1) {
    const response = await getCheckins(page, 50, after, 'photo', {
      force: true,
      preserveSessionOnUnauthorized: true,
    });
    photos.push(...response.data);
    if (!response.hasMore) break;
  }

  return photos
    .filter((item) => {
      if (item.isOwn || item.type !== 'photo' || !item.photoUrl) return false;
      const createdAt = new Date(item.createdAt).getTime();
      return createdAt >= start.getTime() && createdAt < end.getTime();
    })
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
}

function formatScratchTime(createdAt: string): string {
  return new Date(createdAt).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function openFirstPartnerPhotoForToday(userId: string, dayKey: string): Promise<DailyAttemptResult> {
  try {
    const lookupDate = new Date();
    const { start, end } = getLocalDayBounds(lookupDate);
    const partnerPhotos = await loadTodayPartnerPhotos(start, end);

    if (!isHomeEntry() || getLocalDayKey() !== dayKey) return 'retry';

    const firstPhoto = partnerPhotos.reduce<CheckIn | null>((earliest, current) => {
      if (!earliest) return current;
      return new Date(current.createdAt).getTime() < new Date(earliest.createdAt).getTime()
        ? current
        : earliest;
    }, null);
    const imageUrl = firstPhoto?.photoUrl;
    if (!firstPhoto || !imageUrl) return 'retry';
    if (firstPhoto.includeScratch === false) return 'completed';
    if (wasDailyScratchShown(userId, dayKey) || wasImageRevealed(imageUrl)) return 'completed';
    if (hasSpecialModal()) return 'retry';

    const { openPolaroidCoverModal } = await import('./components/polaroid-cover');
    if (!isHomeEntry() || getLocalDayKey() !== dayKey || hasSpecialModal()) return 'retry';

    openPolaroidCoverModal({
      imageUrl,
      title: firstPhoto.caption || `Ảnh đầu tiên hôm nay của ${firstPhoto.ownerName} 💖`,
      dateText: `Ảnh đầu tiên hôm nay · ${formatScratchTime(firstPhoto.createdAt)}`,
      coverText: firstPhoto.surpriseText,
      forceScratch: true,
    });
    markDailyScratchShown(userId, dayKey);
    return 'completed';
  } catch {
    // A later retry can recover from a temporary API or module-loading failure.
    return 'retry';
  }
}

function scheduleDailyRetry(userDay: string): void {
  if (retryTimer !== null) return;
  retryTimer = window.setTimeout(() => {
    retryTimer = null;
    const currentUserId = store.get().user?.id;
    if (!currentUserId || `${currentUserId}:${getLocalDayKey()}` !== userDay) {
      maybeStartDailyScratch();
      return;
    }
    maybeStartDailyScratch();
  }, DAILY_RETRY_DELAY_MS);
}

function maybeStartDailyScratch(): void {
  if (!isHomeEntry()) return;

  const userId = store.get().user?.id;
  if (!userId) return;

  const dayKey = getLocalDayKey();
  const userDay = `${userId}:${dayKey}`;
  if (completedUserDay === userDay || attemptInFlight || (attemptedUserDay === userDay && retryTimer !== null)) return;

  attemptedUserDay = userDay;
  attemptInFlight = openFirstPartnerPhotoForToday(userId, dayKey)
    .then((result) => {
      if (result === 'completed') completedUserDay = userDay;
      else scheduleDailyRetry(userDay);
    })
    .finally(() => {
      attemptInFlight = null;
    });
}

function retryAfterSpecialModalClosed(): void {
  if (retryTimer !== null) {
    window.clearTimeout(retryTimer);
    retryTimer = null;
  }
  maybeStartDailyScratch();
}

const routeObserver = new MutationObserver(maybeStartDailyScratch);
routeObserver.observe(document.documentElement, { childList: true, subtree: true });

window.addEventListener('popstate', maybeStartDailyScratch);
window.addEventListener('pageshow', maybeStartDailyScratch);
window.addEventListener(SPECIAL_MODAL_CLOSED_EVENT, retryAfterSpecialModalClosed);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') maybeStartDailyScratch();
});

maybeStartDailyScratch();
