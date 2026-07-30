import { getCheckins, getLatestPartnerCheckin } from './api/checkins';
import type { CheckIn } from './api/types';
import { store } from './store/index';

const REVEAL_STORAGE_PREFIX = 'lovecheck:daily-surprise:love-foil:v1:';
const LEGACY_AUTO_OPEN_PREFIX = 'lovecheck:daily-surprise:auto-open:v1:';
const DAILY_FIRST_PHOTO_PREFIX = 'lovecheck:daily-surprise:first-partner-photo:v1:';
const PENDING_CLASS = 'daily-first-photo-scratch-pending';
const MAX_TODAY_PAGES = 20;

let attemptInFlight: Promise<void> | null = null;
let attemptedUserDay = '';

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

function getLocalDayBounds(): { start: Date; end: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function isHomeEntry(): boolean {
  const path = window.location.pathname;
  return path === '/app/home' || (path === '/' && store.isAuthenticated());
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

function suppressLegacyLatestAutoOpen(imageUrl: string): void {
  const key = `${LEGACY_AUTO_OPEN_PREFIX}${hashString(normalizeImageUrl(imageUrl))}`;
  try {
    sessionStorage.setItem(key, 'shown');
  } catch {
    // The legacy observer may still run when storage is unavailable.
  }
}

function suppressRenderedHomeImage(): void {
  const image = document.querySelector<HTMLImageElement>('.checkin-card .checkin-card-image');
  const imageUrl = image?.currentSrc || image?.src;
  if (imageUrl) suppressLegacyLatestAutoOpen(imageUrl);
}

async function suppressLatestPartnerCheckin(): Promise<void> {
  const latest = await getLatestPartnerCheckin({ force: true }).catch(() => null);
  if (latest?.photoUrl) suppressLegacyLatestAutoOpen(latest.photoUrl);
}

async function loadTodayPartnerPhotos(start: Date, end: Date): Promise<CheckIn[]> {
  const after = new Date(start.getTime() - 1).toISOString();
  const photos: CheckIn[] = [];

  for (let page = 1; page <= MAX_TODAY_PAGES; page += 1) {
    const response = await getCheckins(page, 50, after, 'photo', { force: true });
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

async function openFirstPartnerPhotoForToday(userId: string, dayKey: string): Promise<void> {
  document.documentElement.classList.add(PENDING_CLASS);

  try {
    const { start, end } = getLocalDayBounds();
    const [partnerPhotos] = await Promise.all([
      loadTodayPartnerPhotos(start, end),
      suppressLatestPartnerCheckin(),
    ]);

    if (!isHomeEntry()) return;

    const firstPhoto = partnerPhotos[0];
    const imageUrl = firstPhoto?.photoUrl;
    if (!firstPhoto || !imageUrl) return;
    if (wasDailyScratchShown(userId, dayKey) || wasImageRevealed(imageUrl)) return;
    if (document.querySelector('.polaroid-modal-backdrop')) return;

    const { openPolaroidCoverModal } = await import('./components/polaroid-cover');
    if (!isHomeEntry() || document.querySelector('.polaroid-modal-backdrop')) return;

    markDailyScratchShown(userId, dayKey);
    openPolaroidCoverModal({
      imageUrl,
      title: firstPhoto.caption || `Ảnh đầu tiên hôm nay của ${firstPhoto.ownerName} 💖`,
      dateText: `Ảnh đầu tiên hôm nay · ${formatScratchTime(firstPhoto.createdAt)}`,
      coverText: firstPhoto.surpriseText,
      forceScratch: true,
    });
  } catch {
    // Home continues normally when the daily surprise lookup fails.
  } finally {
    document.documentElement.classList.remove(PENDING_CLASS);
  }
}

function maybeStartDailyScratch(): void {
  if (!isHomeEntry()) return;

  const userId = store.get().user?.id;
  if (!userId) return;

  const dayKey = getLocalDayKey();
  const userDay = `${userId}:${dayKey}`;
  if (attemptedUserDay === userDay || attemptInFlight) return;

  attemptedUserDay = userDay;
  attemptInFlight = openFirstPartnerPhotoForToday(userId, dayKey).finally(() => {
    attemptInFlight = null;
  });
}

const concealStyle = document.createElement('style');
concealStyle.textContent = `html.${PENDING_CLASS} .checkin-card, html.${PENDING_CLASS} .recent-memories-list { visibility: hidden !important; }`;
document.head.appendChild(concealStyle);

const routeObserver = new MutationObserver(() => {
  suppressRenderedHomeImage();
  maybeStartDailyScratch();
});
routeObserver.observe(document.documentElement, { childList: true, subtree: true });

window.addEventListener('popstate', maybeStartDailyScratch);
window.addEventListener('pageshow', maybeStartDailyScratch);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') maybeStartDailyScratch();
});

suppressRenderedHomeImage();
maybeStartDailyScratch();
