import '../styles/polaroid-cover.css';
import { showToast } from './toast';

export type ScratchTheme = 'love-foil' | 'birthday-foil';

export interface PolaroidCoverOptions {
  imageUrl: string;
  title?: string;
  dateText?: string;
  /** Kept for backward compatibility with the previous cover API. */
  timerSeconds?: number;
  revealThreshold?: number;
  brushRadius?: number;
  /** Kept for backward compatibility with the previous cover API. */
  textColumns?: string[];
  forceScratch?: boolean;
  coverText?: string;
  /** Starts a fresh scratch session even if this image was opened before. */
  restartScratch?: boolean;
  /** Theme: 'love-foil' (default) or 'birthday-foil' */
  theme?: ScratchTheme;
  onRevealed?: () => void;
}

const DEFAULT_REVEAL_THRESHOLD = 0.8;
const DEFAULT_COVER_TEXT = 'Unbox quà ngày mới nào';
const STAGE_CORNER_RADIUS = 28;

// Flower SVG taken from the occasion-cards system – used as the birthday foil art.
const BIRTHDAY_FLOWER_SVG = `<svg viewBox="0 0 130 155" width="130" height="155" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bfStemG" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#1b4332"/><stop offset="50%" stop-color="#40916c"/><stop offset="100%" stop-color="#1b4332"/></linearGradient>
    <linearGradient id="bfLeafL" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#95d5b2"/><stop offset="45%" stop-color="#40916c"/><stop offset="100%" stop-color="#1b4332"/></linearGradient>
    <linearGradient id="bfLeafR" x1="1" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#74c69d"/><stop offset="50%" stop-color="#2d6a4f"/><stop offset="100%" stop-color="#081c15"/></linearGradient>
    <radialGradient id="bfHp" cx="35%" cy="20%" r="70%"><stop offset="0%" stop-color="#ffd6e0" stop-opacity=".95"/><stop offset="40%" stop-color="#ff6b8a" stop-opacity=".85"/><stop offset="100%" stop-color="#a4133c" stop-opacity=".7"/></radialGradient>
    <radialGradient id="bfHp2" cx="35%" cy="20%" r="70%"><stop offset="0%" stop-color="#ffe5ec" stop-opacity=".9"/><stop offset="45%" stop-color="#ff85a1" stop-opacity=".8"/><stop offset="100%" stop-color="#c9184a" stop-opacity=".65"/></radialGradient>
    <radialGradient id="bfHi" cx="40%" cy="25%" r="65%"><stop offset="0%" stop-color="#fff0f5" stop-opacity=".9"/><stop offset="50%" stop-color="#ffb3c6" stop-opacity=".7"/><stop offset="100%" stop-color="#ff4d6d" stop-opacity=".45"/></radialGradient>
    <radialGradient id="bfCosmic" cx="40%" cy="35%" r="60%"><stop offset="0%" stop-color="#c77dff"/><stop offset="40%" stop-color="#7b2cbf"/><stop offset="100%" stop-color="#10002b"/></radialGradient>
    <filter id="bfDs"><feDropShadow dx="0" dy="2" stdDeviation="2.2" flood-color="#800f2f" flood-opacity=".3"/></filter>
    <filter id="bfGlow"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="bfLeafSh"><feDropShadow dx="0" dy="1.5" stdDeviation="1.2" flood-color="#081c15" flood-opacity=".35"/></filter>
  </defs>
  <path d="M65 140 Q62 105 65 68" stroke="url(#bfStemG)" stroke-width="4.5" fill="none" stroke-linecap="round"/>
  <g filter="url(#bfLeafSh)">
    <path d="M58 132 C48 128 36 122 32 116 C28 110 34 104 42 108 C50 112 56 122 58 132Z" fill="url(#bfLeafL)"/>
    <path d="M56 130 Q48 122 40 116" stroke="#1b4332" stroke-width="1.1" fill="none" opacity=".55" stroke-linecap="round"/>
  </g>
  <g filter="url(#bfLeafSh)">
    <path d="M72 134 C82 131 96 126 100 120 C104 114 98 108 90 112 C82 116 76 126 72 134Z" fill="url(#bfLeafR)"/>
    <path d="M74 132 Q82 125 92 118" stroke="#081c15" stroke-width="1.1" fill="none" opacity=".5" stroke-linecap="round"/>
  </g>
  <g filter="url(#bfDs)">
    <g transform="rotate(0 65 60)"><path d="M65 18C65 8 79 2 88 16C97 2 111 8 111 18C111 38 88 58 88 58C88 58 65 38 65 18Z" fill="url(#bfHp)" transform="translate(-23 10)" filter="url(#bfGlow)" opacity=".88"/></g>
    <g transform="rotate(60 65 60)"><path d="M65 18C65 8 79 2 88 16C97 2 111 8 111 18C111 38 88 58 88 58C88 58 65 38 65 18Z" fill="url(#bfHp2)" transform="translate(-23 10)" opacity=".85"/></g>
    <g transform="rotate(120 65 60)"><path d="M65 18C65 8 79 2 88 16C97 2 111 8 111 18C111 38 88 58 88 58C88 58 65 38 65 18Z" fill="url(#bfHp)" transform="translate(-23 10)" opacity=".88"/></g>
    <g transform="rotate(180 65 60)"><path d="M65 18C65 8 79 2 88 16C97 2 111 8 111 18C111 38 88 58 88 58C88 58 65 38 65 18Z" fill="url(#bfHp2)" transform="translate(-23 10)" opacity=".85"/></g>
    <g transform="rotate(240 65 60)"><path d="M65 18C65 8 79 2 88 16C97 2 111 8 111 18C111 38 88 58 88 58C88 58 65 38 65 18Z" fill="url(#bfHp)" transform="translate(-23 10)" opacity=".88"/></g>
    <g transform="rotate(300 65 60)"><path d="M65 18C65 8 79 2 88 16C97 2 111 8 111 18C111 38 88 58 88 58C88 58 65 38 65 18Z" fill="url(#bfHp2)" transform="translate(-23 10)" opacity=".85"/></g>
    <g transform="rotate(0 65 60)"><path d="M65 31C65 25 73 21 78 28C83 21 91 25 91 31C91 42 78 51 78 51C78 51 65 42 65 31Z" fill="url(#bfHi)" transform="translate(-13 7)" opacity=".7"/></g>
    <g transform="rotate(60 65 60)"><path d="M65 31C65 25 73 21 78 28C83 21 91 25 91 31C91 42 78 51 78 51C78 51 65 42 65 31Z" fill="url(#bfHi)" transform="translate(-13 7)" opacity=".65"/></g>
    <g transform="rotate(120 65 60)"><path d="M65 31C65 25 73 21 78 28C83 21 91 25 91 31C91 42 78 51 78 51C78 51 65 42 65 31Z" fill="url(#bfHi)" transform="translate(-13 7)" opacity=".7"/></g>
    <g transform="rotate(180 65 60)"><path d="M65 31C65 25 73 21 78 28C83 21 91 25 91 31C91 42 78 51 78 51C78 51 65 42 65 31Z" fill="url(#bfHi)" transform="translate(-13 7)" opacity=".65"/></g>
    <g transform="rotate(240 65 60)"><path d="M65 31C65 25 73 21 78 28C83 21 91 25 91 31C91 42 78 51 78 51C78 51 65 42 65 31Z" fill="url(#bfHi)" transform="translate(-13 7)" opacity=".7"/></g>
    <g transform="rotate(300 65 60)"><path d="M65 31C65 25 73 21 78 28C83 21 91 25 91 31C91 42 78 51 78 51C78 51 65 42 65 31Z" fill="url(#bfHi)" transform="translate(-13 7)" opacity=".65"/></g>
  </g>
  <circle cx="65" cy="60" r="14.5" fill="url(#bfCosmic)"/>
  <path d="M65 47 L68 56.5 L78 56.5 L70 62.5 L73 72 L65 66 L57 72 L60 62.5 L52 56.5 L62 56.5 Z" fill="#e0aaff"/>
  <circle cx="65" cy="60" r="3" fill="#f8f7ff"/>
</svg>`;

let birthdayFlowerImg: HTMLImageElement | null = null;
let birthdayFlowerLoading = false;
const birthdayFlowerCallbacks: Array<(img: HTMLImageElement) => void> = [];

function loadBirthdayFlower(callback: (img: HTMLImageElement) => void): void {
  if (birthdayFlowerImg) { callback(birthdayFlowerImg); return; }
  birthdayFlowerCallbacks.push(callback);
  if (birthdayFlowerLoading) return;
  birthdayFlowerLoading = true;
  const blob = new Blob([BIRTHDAY_FLOWER_SVG], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    birthdayFlowerImg = img;
    URL.revokeObjectURL(url);
    const cbs = birthdayFlowerCallbacks.splice(0);
    cbs.forEach((cb) => cb(img));
  };
  img.onerror = () => { URL.revokeObjectURL(url); birthdayFlowerCallbacks.splice(0); };
  img.src = url;
}
const STORAGE_PREFIX = 'lovecheck:daily-surprise:love-foil:v1:';
const HOME_AUTO_OPEN_PREFIX = 'lovecheck:daily-surprise:auto-open:v1:';
const GLOBAL_INSTALL_KEY = '__loveCheckLoveFoilInstalled';
const homeAutoOpenedImages = new Set<string>();

type LoveFoilWindow = Window & {
  [GLOBAL_INSTALL_KEY]?: boolean;
};

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

function getRevealStorageKey(imageUrl: string): string {
  return `${STORAGE_PREFIX}${hashString(normalizeImageUrl(imageUrl))}`;
}

function readRevealState(imageUrl: string): boolean {
  try {
    return localStorage.getItem(getRevealStorageKey(imageUrl)) === 'opened';
  } catch {
    return false;
  }
}

function saveRevealState(imageUrl: string): void {
  try {
    localStorage.setItem(getRevealStorageKey(imageUrl), 'opened');
  } catch {
    // Storage may be unavailable in private mode. The reveal still works in-memory.
  }
}

function isElementVisible(element: Element): boolean {
  return !element.closest('[hidden], [aria-hidden="true"], [inert]');
}

function isMemorySearchActive(): boolean {
  const input = document.querySelector<HTMLInputElement>('.memories-search-input');
  return Boolean(input?.value.trim());
}

function getLatestImageCandidates(): HTMLImageElement[] {
  const candidates: Array<HTMLImageElement | null> = [
    document.querySelector<HTMLImageElement>('.checkin-card .checkin-card-image'),
    document.querySelector<HTMLImageElement>(
      '.recent-memories-list .recent-memory-item:first-child .rm-photo-wrap img',
    ),
  ];

  if (!isMemorySearchActive()) {
    candidates.push(
      document.querySelector<HTMLImageElement>(
        '.memory-grid .memory-tile:first-child .memory-item img',
      ),
    );
  }

  return candidates.filter(
    (candidate): candidate is HTMLImageElement => Boolean(candidate && isElementVisible(candidate)),
  );
}

function isLatestSurpriseImage(imageUrl: string): boolean {
  const normalizedTarget = normalizeImageUrl(imageUrl);
  return getLatestImageCandidates().some((image) => {
    const source = image.currentSrc || image.src;
    return normalizeImageUrl(source) === normalizedTarget;
  });
}

function getPillImage(pill: Element): HTMLImageElement | null {
  const surface = pill.closest('.checkin-card, .rm-photo-wrap, .memory-item');
  return surface?.querySelector<HTMLImageElement>('img') ?? null;
}

function isLatestPill(pill: Element): boolean {
  if (pill.closest('.checkin-card')) return true;

  const recentItem = pill.closest('.recent-memory-item');
  if (recentItem) return recentItem.parentElement?.firstElementChild === recentItem;

  const memoryTile = pill.closest('.memory-tile');
  if (memoryTile) {
    return !isMemorySearchActive() && memoryTile.parentElement?.firstElementChild === memoryTile;
  }

  return false;
}

function getSurfaceCopy(pill: Element): { title: string; dateText: string } {
  const checkinCard = pill.closest('.checkin-card');
  if (checkinCard) {
    return {
      title:
        checkinCard.querySelector<HTMLElement>('.checkin-card-overlay-text')?.textContent?.trim() ||
        'Bất ngờ mới dành cho bạn 💖',
      dateText:
        checkinCard.querySelector<HTMLElement>('.checkin-card-overlay-meta')?.textContent?.trim() ||
        'Check-in mới nhất',
    };
  }

  const recentCard = pill.closest('.recent-memory-card');
  if (recentCard) {
    return {
      title:
        recentCard.querySelector<HTMLElement>('.rm-caption')?.textContent?.trim() ||
        'Bất ngờ mới dành cho bạn 💖',
      dateText:
        recentCard.querySelector<HTMLElement>('.rm-time')?.textContent?.trim() ||
        'Check-in mới nhất',
    };
  }

  const memoryItem = pill.closest('.memory-item');
  return {
    title:
      memoryItem?.querySelector<HTMLElement>('.memory-item-info-text')?.textContent?.trim() ||
      'Bất ngờ mới dành cho bạn 💖',
    dateText: 'Check-in mới nhất',
  };
}

function syncScratchPills(): void {
  const searchActive = isMemorySearchActive();
  document.documentElement.classList.toggle('love-foil-search-active', searchActive);

  document.querySelectorAll<HTMLElement>('.polaroid-scratch-pill').forEach((pill) => {
    const image = getPillImage(pill);
    const latest = Boolean(image && isLatestPill(pill));

    pill.hidden = !latest;
    pill.setAttribute('aria-hidden', latest ? 'false' : 'true');
    pill.classList.toggle('is-opened', Boolean(image && readRevealState(image.currentSrc || image.src)));

    if (latest) {
      pill.setAttribute('role', 'button');
      pill.setAttribute('aria-label', 'Mở bất ngờ Love Foil');
      pill.tabIndex = 0;
    } else {
      pill.removeAttribute('role');
      pill.tabIndex = -1;
    }
  });
}

function injectLatestCheckinPill(): void {
  document.querySelectorAll<HTMLElement>('.checkin-card').forEach((card) => {
    if (!card.querySelector('.checkin-card-image') || card.querySelector('.polaroid-scratch-pill')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'polaroid-scratch-pill polaroid-scratch-pill--latest';
    button.setAttribute('aria-label', 'Mở bất ngờ Love Foil');
    button.addEventListener('pointerdown', (event) => event.stopPropagation());
    card.appendChild(button);
  });
}

const pendingHomeImageLoads = new WeakSet<HTMLImageElement>();

function autoOpenLatestHomeSurprise(): void {
  if (window.location.pathname !== '/app/home') return;
  if (document.querySelector('.polaroid-modal-backdrop')) return;

  const card = document.querySelector<HTMLElement>('.checkin-card');
  const image = card?.querySelector<HTMLImageElement>('.checkin-card-image');
  if (!card || !image || !isElementVisible(image)) return;

  if (!image.complete || image.naturalWidth === 0) {
    if (!pendingHomeImageLoads.has(image)) {
      pendingHomeImageLoads.add(image);
      image.addEventListener('load', schedulePillSync, { once: true });
    }
    return;
  }

  const imageUrl = image.currentSrc || image.src;
  if (!imageUrl || readRevealState(imageUrl) || hasHomeAutoOpened(imageUrl)) return;

  const pill = card.querySelector('.polaroid-scratch-pill');
  const copy = pill
    ? getSurfaceCopy(pill)
    : { title: 'Bất ngờ mới dành cho bạn 💖', dateText: 'Check-in mới nhất' };

  saveHomeAutoOpened(imageUrl);
  openPolaroidCoverModal({
    imageUrl,
    title: copy.title,
    dateText: copy.dateText,
    forceScratch: true,
    coverText: image.dataset.surpriseText,
  });
}

let syncFrame: number | null = null;

function schedulePillSync(): void {
  if (typeof document === 'undefined') return;
  if (typeof requestAnimationFrame === 'undefined') {
    injectLatestCheckinPill();
    syncScratchPills();
    autoOpenLatestHomeSurprise();
    return;
  }
  if (syncFrame !== null) return;
  syncFrame = requestAnimationFrame(() => {
    syncFrame = null;
    injectLatestCheckinPill();
    syncScratchPills();
    autoOpenLatestHomeSurprise();
  });
}

function openPillSurprise(pill: Element): void {
  const image = getPillImage(pill);
  if (!image) return;

  const copy = getSurfaceCopy(pill);
  openPolaroidCoverModal({
    imageUrl: image.currentSrc || image.src,
    title: copy.title,
    dateText: copy.dateText,
    forceScratch: true,
    coverText: image.dataset.surpriseText,
    restartScratch: true,
  });
}

function installLatestCheckinLoveFoil(): void {
  const appWindow = window as LoveFoilWindow;
  if (appWindow[GLOBAL_INSTALL_KEY]) return;
  appWindow[GLOBAL_INSTALL_KEY] = true;

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const pill = target.closest('.polaroid-scratch-pill');
      if (!pill || (pill as HTMLElement).hidden) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      openPillSurprise(pill);
    },
    true,
  );

  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const pill = target.closest('.polaroid-scratch-pill');
      if (!pill || (pill as HTMLElement).hidden) return;

      event.preventDefault();
      openPillSurprise(pill);
    },
    true,
  );

  document.addEventListener('input', (event) => {
    if (event.target instanceof Element && event.target.matches('.memories-search-input')) {
      schedulePillSync();
    }
  });

  const observer = new MutationObserver(schedulePillSync);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  schedulePillSync();
}

// ============================================================
// 🎂 BIRTHDAY FOIL DRAWER
// ============================================================
function drawBirthdayFoil(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  coverText: string,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, width, height);

  // 1. Base gradient: warm gold → pink → coral → purple
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#FFD700');
  gradient.addColorStop(0.22, '#FF6B9D');
  gradient.addColorStop(0.48, '#FF8E53');
  gradient.addColorStop(0.72, '#C44569');
  gradient.addColorStop(1, '#8B5CF6');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // 2. Diagonal stripes (party vibe)
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  for (let x = -height; x < width + height; x += 26) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - height, height);
    ctx.stroke();
  }
  ctx.restore();

  // 3. Confetti rectangles
  const confetti: Array<readonly [number, number, number, string, number]> = [
    [0.10, 0.06, 16, '#FFD700', 40],
    [0.90, 0.10, 13, '#FF6B9D', -25],
    [0.78, 0.32, 18, '#00D9FF', 55],
    [0.18, 0.38, 11, '#FF8E53', -20],
    [0.95, 0.50, 20, '#FFD700', 15],
    [0.05, 0.58, 12, '#FF6B9D', -50],
    [0.70, 0.72, 16, '#00D9FF', 30],
    [0.30, 0.82, 14, '#FF8E53', -35],
    [0.55, 0.12, 10, '#ffffff', 5],
    [0.42, 0.65, 19, '#FFD700', 45],
    [0.12, 0.25, 13, '#FF8E53', -30],
    [0.88, 0.88, 15, '#FF6B9D', 35],
    [0.25, 0.55, 11, '#00D9FF', 60],
    [0.65, 0.18, 14, '#FF8E53', -15],
    [0.48, 0.45, 17, '#FFD700', 25],
  ];
  confetti.forEach(([nx, ny, size, color, rot]) => {
    ctx.save();
    ctx.translate(width * nx, height * ny);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-size / 2, -size / 3.5, size, size * 0.55, 2);
    ctx.fill();
    ctx.restore();
  });

  // 4. Floating balloons with shine + string
  const balloons: Array<readonly [number, number, number, string]> = [
    [0.15, 0.18, 30, '#FF6B9D'],
    [0.85, 0.15, 24, '#FFD700'],
    [0.75, 0.70, 34, '#00D9FF'],
    [0.20, 0.75, 22, '#FF8E53'],
    [0.50, 0.28, 18, '#C44569'],
    [0.35, 0.90, 26, '#8B5CF6'],
  ];
  balloons.forEach(([nx, ny, r, color]) => {
    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(width * nx, height * ny, r, r * 1.18, 0, 0, Math.PI * 2);
    ctx.fill();
    // Shine
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(
      width * nx - r * 0.25,
      height * ny - r * 0.3,
      r * 0.22,
      r * 0.32,
      -0.4,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    // String
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width * nx, height * ny + r * 1.15);
    ctx.quadraticCurveTo(
      width * nx + 8,
      height * ny + r * 1.15 + 20,
      width * nx,
      height * ny + r * 1.15 + 36,
    );
    ctx.stroke();
    ctx.restore();
  });

  // 5. Stars / sparkles
  const stars: Array<readonly [number, number, number]> = [
    [0.28, 0.12, 20],
    [0.62, 0.25, 15],
    [0.88, 0.45, 22],
    [0.10, 0.50, 12],
    [0.38, 0.55, 17],
    [0.78, 0.62, 11],
    [0.55, 0.80, 24],
    [0.15, 0.92, 14],
    [0.92, 0.92, 16],
    [0.50, 0.50, 28],
    [0.68, 0.42, 13],
    [0.22, 0.68, 18],
  ];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  stars.forEach(([nx, ny, size]) => {
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#ffffff';
    ctx.font = `${size}px serif`;
    ctx.fillText('★', width * nx, height * ny);
    ctx.restore();
  });

  // 6. Center instruction text
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;
  ctx.globalAlpha = 0.95;
  ctx.font = "800 16px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText('CÀO ĐỂ MỞ QUÀ 🎁', width / 2, height / 2);
  ctx.restore();

  ctx.restore();
}

// ============================================================
// 💕 ORIGINAL LOVE FOIL DRAWER (giữ nguyên để backward compat)
// ============================================================
function drawLoveFoil(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  coverText: string,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#ff2f7d');
  gradient.addColorStop(0.34, '#ff82af');
  gradient.addColorStop(0.66, '#b65cff');
  gradient.addColorStop(1, '#6f5cff');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  for (let x = -height; x < width + height; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - height, height);
    ctx.stroke();
  }
  ctx.restore();

  const hearts = [
    [0.16, 0.2, 22],
    [0.82, 0.18, 16],
    [0.73, 0.76, 24],
    [0.2, 0.8, 14],
  ] as const;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  hearts.forEach(([x, y, size]) => {
    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = '#ffffff';
    ctx.font = `${size}px serif`;
    ctx.fillText('♥', width * x, height * y);
    ctx.restore();
  });

  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const loveMessage = coverText.trim() || DEFAULT_COVER_TEXT;
  const loveWords = loveMessage.split(/\s+/);
  const loveLines: string[] = [];
  let loveLine = '';
  const loveMaxWidth = width * 0.74;
  ctx.font = "800 18px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  loveWords.forEach((word) => {
    const candidate = loveLine ? `${loveLine} ${word}` : word;
    if (loveLine && ctx.measureText(candidate).width > loveMaxWidth && loveLines.length === 0) {
      loveLines.push(loveLine);
      loveLine = word;
    } else {
      loveLine = candidate;
    }
  });
  if (loveLine) loveLines.push(loveLine);
  const visibleLines = loveLines.slice(0, 2);
  const lineHeight = 24;
  const titleStart = height / 2 - 8 - ((visibleLines.length - 1) * lineHeight) / 2;
  visibleLines.forEach((text, index) => {
    ctx.fillText(text, width / 2, titleStart + index * lineHeight);
  });
  ctx.globalAlpha = 0.82;
  ctx.font = "700 11px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText('CÀO ĐỂ MỞ', width / 2, titleStart + visibleLines.length * lineHeight + 5);
  ctx.restore();
  ctx.restore();
}

// ============================================================
// 🎊 CONFETTI ANIMATION (chỉ chạy khi theme = birthday)
// ============================================================
interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
  size: number;
  color: string;
  alpha: number;
  shape: 'rect' | 'circle';
}

function startConfettiAnimation(
  cCtx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dpr: number,
  onDone: () => void,
): () => void {
  const colors = ['#FFD700', '#FF6B9D', '#FF8E53', '#00D9FF', '#C44569', '#8B5CF6', '#ffffff'];
  const particles: ConfettiParticle[] = [];
  for (let i = 0; i < 80; i++) {
    particles.push({
      x: (Math.random() * width * dpr),
      y: -20 - Math.random() * 60,
      vx: (Math.random() - 0.5) * 3,
      vy: 2 + Math.random() * 4,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.2,
      size: (6 + Math.random() * 10) * dpr,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 0.7 + Math.random() * 0.3,
      shape: Math.random() > 0.4 ? 'rect' : 'circle',
    });
  }

  let frame: number | null = null;
  let startTime: number | null = null;
  const duration = 2200;

  function tick(ts: number): void {
    if (startTime === null) startTime = ts;
    const elapsed = ts - startTime;
    const progress = Math.min(elapsed / duration, 1);

    cCtx.clearRect(0, 0, width * dpr, height * dpr);

    for (const p of particles) {
      p.x += p.vx * dpr;
      p.y += p.vy * dpr;
      p.rot += p.vRot;
      p.alpha = Math.max(0, p.alpha - 0.003);

      if (p.y > height * dpr + 20) {
        p.y = -20;
        p.x = Math.random() * width * dpr;
      }

      cCtx.save();
      cCtx.globalAlpha = p.alpha * (1 - Math.max(0, progress - 0.7) / 0.3);
      cCtx.fillStyle = p.color;
      cCtx.translate(p.x, p.y);
      cCtx.rotate(p.rot);

      if (p.shape === 'circle') {
        cCtx.beginPath();
        cCtx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        cCtx.fill();
      } else {
        cCtx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.5);
      }
      cCtx.restore();
    }

    if (progress < 1) {
      frame = requestAnimationFrame(tick);
    } else {
      cCtx.clearRect(0, 0, width * dpr, height * dpr);
      onDone();
    }
  }

  frame = requestAnimationFrame(tick);
  return () => {
    if (frame !== null) cancelAnimationFrame(frame);
    cCtx.clearRect(0, 0, width * dpr, height * dpr);
  };
}

function hasHomeAutoOpened(imageUrl: string): boolean {
  const key = `${HOME_AUTO_OPEN_PREFIX}${hashString(normalizeImageUrl(imageUrl))}`;
  if (homeAutoOpenedImages.has(key)) return true;

  try {
    return sessionStorage.getItem(key) === 'shown';
  } catch {
    return false;
  }
}

function saveHomeAutoOpened(imageUrl: string): void {
  const key = `${HOME_AUTO_OPEN_PREFIX}${hashString(normalizeImageUrl(imageUrl))}`;
  homeAutoOpenedImages.add(key);

  try {
    sessionStorage.setItem(key, 'shown');
  } catch {
    // The in-memory marker above still prevents repeat opens in this view.
  }
}

function getStageCornerRadius(width: number, height: number): number {
  return Math.min(STAGE_CORNER_RADIUS, width / 2, height / 2);
}

function clipToStage(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const radius = getStageCornerRadius(width, height);
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(width - radius, 0);
  ctx.quadraticCurveTo(width, 0, width, radius);
  ctx.lineTo(width, height - radius);
  ctx.quadraticCurveTo(width, height, width - radius, height);
  ctx.lineTo(radius, height);
  ctx.quadraticCurveTo(0, height, 0, height - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.clip();
}

function isInsideRoundedStage(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): boolean {
  if (x < 0 || y < 0 || x > width || y > height) return false;
  if (x >= radius && x <= width - radius) return true;
  if (y >= radius && y <= height - radius) return true;

  const cornerX = x < radius ? radius : width - radius;
  const cornerY = y < radius ? radius : height - radius;
  return (x - cornerX) ** 2 + (y - cornerY) ** 2 <= radius ** 2;
}

export function openPolaroidCoverModal(options: PolaroidCoverOptions): { close: () => void } {
  const {
    imageUrl,
    title = 'Bất ngờ mới dành cho bạn 💖',
    dateText = 'Check-in mới nhất',
    revealThreshold = DEFAULT_REVEAL_THRESHOLD,
    brushRadius,
    forceScratch,
    coverText = DEFAULT_COVER_TEXT,
    restartScratch = false,
    theme = 'love-foil',
    onRevealed,
  } = options;

  const isBirthday = theme === 'birthday-foil';

  const latestImage = isLatestSurpriseImage(imageUrl);
  const scratchEligible = forceScratch ?? latestImage;
  const alreadyOpened = readRevealState(imageUrl);
  let revealed = !scratchEligible || (alreadyOpened && !restartScratch);
  let scratching = false;
  let ratioFrame: number | null = null;
  let ratioTimer: number | null = null;
  let lastRatioCheckAt = 0;
  let width = 0;
  let height = 0;

  const backdrop = document.createElement('div');
  backdrop.className = `polaroid-modal-backdrop love-foil-modal${isBirthday ? ' birthday-foil-modal' : ''}`;

  const modal = document.createElement('div');
  modal.className = `polaroid-modal-container${isBirthday ? ' birthday-modal-container' : ''}`;

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'polaroid-modal-close';
  closeButton.setAttribute('aria-label', 'Đóng');
  closeButton.textContent = '✕';

  const downloadButton = document.createElement('button');
  downloadButton.type = 'button';
  downloadButton.className = 'polaroid-modal-download';
  downloadButton.setAttribute('aria-label', 'Tải ảnh xuống');
  downloadButton.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

  downloadButton.addEventListener('click', async (event) => {
    event.stopPropagation();
    if (!imageUrl) return;

    const originalContent = downloadButton.innerHTML;
    downloadButton.innerHTML = `<span class="spinner" style="width:14px;height:14px;border-width:2px;border-color:#fff transparent transparent transparent;display:inline-block;border-style:solid;border-radius:50%;animation:spin 0.8s linear infinite;"></span>`;
    (downloadButton as HTMLElement).style.pointerEvents = 'none';

    const ts = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const fileName = `checkin-love-${ts.getFullYear()}-${pad(ts.getMonth() + 1)}-${pad(ts.getDate())}-${pad(ts.getHours())}-${pad(ts.getMinutes())}.jpg`;

    // 1. Android Native App Wrapper
    const isAndroidWrapper = typeof navigator !== 'undefined' && navigator.userAgent.includes('LoveCheckAndroidWrapper');
    if (isAndroidWrapper && (window as any).LoveCheckAndroid && typeof (window as any).LoveCheckAndroid.downloadFile === 'function') {
      try {
        (window as any).LoveCheckAndroid.downloadFile(imageUrl, fileName);
        showToast('Đang tải ảnh xuống...', 'loading-spark');
      } catch (e) {
        window.open(imageUrl, '_blank', 'noopener,noreferrer');
      } finally {
        setTimeout(() => {
          downloadButton.innerHTML = originalContent;
          (downloadButton as HTMLElement).style.pointerEvents = '';
        }, 1000);
      }
      return;
    }

    // 2. Web / PWA (with iOS Web Share API fallback for files)
    try {
      const response = await fetch(imageUrl, { mode: 'cors' });
      const blob = await response.blob();

      const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS && navigator.canShare && navigator.share) {
        try {
          const file = new File([blob], fileName, { type: blob.type });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'Ảnh check-in',
            });
            showToast('Đã mở trình chia sẻ', 'success');
            return;
          }
        } catch (shareError) {
          console.log('Share failed, trying standard download:', shareError);
        }
      }

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = fileName;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      showToast('Đã tải ảnh xuống thành công', 'success');
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    } catch (err) {
      console.error('Download failed:', err);
      window.open(imageUrl, '_blank', 'noopener,noreferrer');
      showToast('Mở ảnh trong tab mới. Hãy nhấn giữ để lưu.', 'info');
    } finally {
      downloadButton.innerHTML = originalContent;
      (downloadButton as HTMLElement).style.pointerEvents = '';
    }
  });

  const stage = document.createElement('div');
  stage.className = `polaroid-stage-view${isBirthday ? ' birthday-stage-view' : ''}`;
  stage.classList.toggle('is-revealed', revealed);

  const image = document.createElement('img');
  image.className = 'polaroid-stage-photo';
  image.src = imageUrl;
  image.alt = title;

  const canvas = document.createElement('canvas');
  canvas.className = 'polaroid-stage-canvas';
  canvas.setAttribute('aria-label', isBirthday ? 'Cào lớp Birthday Foil để mở ảnh' : 'Cào lớp Love Foil để mở ảnh');

  // Confetti canvas (birthday only)
  const confettiCanvas = isBirthday ? document.createElement('canvas') : null;
  if (confettiCanvas) {
    confettiCanvas.className = 'polaroid-confetti-canvas';
    confettiCanvas.setAttribute('aria-hidden', 'true');
  }
  let stopConfetti: (() => void) | null = null;

  const hud = document.createElement('div');
  hud.className = `polaroid-hud${revealed ? ' hidden' : ''}`;
  hud.innerHTML = `
    <span class="polaroid-hud-text">Cào để mở</span>
    <div class="polaroid-hud-progress" role="progressbar" aria-label="Tiến độ cào ảnh" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="polaroid-hud-bar"></div></div>
  `;

  const success = document.createElement('div');
  success.className = 'polaroid-success hidden';
  success.innerHTML = '<span>♥</span><strong>Đã mở khóa!</strong>';

  const footer = document.createElement('div');
  footer.className = 'polaroid-love-foil-footer';

  const copy = document.createElement('div');
  const heading = document.createElement('strong');
  heading.textContent = title;
  const meta = document.createElement('span');
  meta.textContent = dateText;
  copy.append(heading, meta);

  const status = document.createElement('span');
  status.className = `polaroid-love-foil-status${alreadyOpened && !restartScratch ? ' is-opened' : ''}`;
  status.textContent = restartScratch ? 'Cào lại' : alreadyOpened ? 'Đã mở' : scratchEligible ? 'Bất ngờ mới' : 'Kỷ niệm';

  footer.append(copy, status);
  if (confettiCanvas) {
    stage.append(image, canvas, confettiCanvas, hud, success);
  } else {
    stage.append(image, canvas, hud, success);
  }
  modal.append(closeButton, downloadButton, stage, footer);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    canvas.remove();
    revealed = true;
    stage.classList.add('is-revealed');
  }

  const ctx = context;
  const progressBar = hud.querySelector<HTMLElement>('.polaroid-hud-bar');
  const progressTrack = hud.querySelector<HTMLElement>('.polaroid-hud-progress');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pointer = { lastX: 0, lastY: 0 };

  function updateProgress(ratio: number): void {
    const percentage = Math.min(100, Math.round(ratio * 100));
    if (progressBar) progressBar.style.width = `${percentage}%`;
    if (progressTrack) progressTrack.setAttribute('aria-valuenow', String(percentage));
  }

  function resize(): void {
    if (!ctx) return;
    // offset dimensions intentionally ignore the modal's entrance transform.
    // getBoundingClientRect() is smaller while the scale animation runs, which
    // previously left a visible strip of the photo along the canvas edge.
    const stageWidth = stage.offsetWidth;
    const stageHeight = stage.offsetHeight;
    if (stageWidth <= 0 || stageHeight <= 0) return;

    width = stageWidth;
    height = stageHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Resize confetti canvas to match stage
    if (confettiCanvas) {
      confettiCanvas.width = Math.round(width * dpr);
      confettiCanvas.height = Math.round(height * dpr);
    }

    if (!revealed) {
      ctx.save();
      clipToStage(ctx, width, height);
      if (isBirthday) {
        drawBirthdayFoil(ctx, width, height, coverText);
      } else {
        drawLoveFoil(ctx, width, height, coverText);
      }
      ctx.restore();
      updateProgress(0);
    }
  }

  function getClearedRatio(): number {
    if (!ctx || canvas.width === 0 || canvas.height === 0) return 0;
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const stride = 4 * 24;
    let cleared = 0;
    let sampled = 0;

    const radius = Math.min(STAGE_CORNER_RADIUS * dpr, canvas.width / 2, canvas.height / 2);
    for (let index = 3; index < pixels.length; index += stride) {
      const pixel = (index - 3) / 4;
      const x = pixel % canvas.width;
      const y = Math.floor(pixel / canvas.width);
      if (!isInsideRoundedStage(x, y, canvas.width, canvas.height, radius)) continue;
      sampled += 1;
      if (pixels[index] < 32) cleared += 1;
    }

    return sampled > 0 ? cleared / sampled : 0;
  }

  function reveal(): void {
    if (revealed) return;
    revealed = true;
    scratching = false;
    updateProgress(1);
    saveRevealState(imageUrl);
    stage.classList.add('is-revealed');
    hud.classList.add('hidden');
    success.classList.remove('hidden');
    status.classList.add('is-opened');
    status.textContent = 'Đã mở';
    syncScratchPills();

    // Birthday confetti burst on reveal
    if (isBirthday && confettiCanvas) {
      const cCtx = confettiCanvas.getContext('2d');
      if (cCtx) {
        confettiCanvas.classList.add('active');
        stopConfetti = startConfettiAnimation(
          cCtx,
          width,
          height,
          dpr,
          () => {
            confettiCanvas.classList.remove('active');
            stopConfetti = null;
          },
        );
      }
    }

    onRevealed?.();
  }

  function scheduleRatioCheck(immediate = false): void {
    if (!ctx || revealed || ratioFrame !== null) return;
    if (immediate && ratioTimer !== null) {
      clearTimeout(ratioTimer);
      ratioTimer = null;
    }
    if (ratioTimer !== null) return;
    const delay = immediate ? 0 : Math.max(0, 90 - (performance.now() - lastRatioCheckAt));
    ratioTimer = window.setTimeout(() => {
      ratioTimer = null;
      ratioFrame = requestAnimationFrame(() => {
        ratioFrame = null;
        lastRatioCheckAt = performance.now();
        const ratio = getClearedRatio();
        updateProgress(ratio);
        if (ratio >= revealThreshold) reveal();
      });
    }, delay);
  }

  function getPoint(event: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function scratchAt(x: number, y: number): void {
    if (!ctx || revealed || width <= 0 || height <= 0) return;

    const radius = brushRadius ?? Math.max(25, Math.min(width, height) * 0.09);
    ctx.save();
    clipToStage(ctx, width, height);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = radius * 1.8;
    ctx.beginPath();
    ctx.moveTo(pointer.lastX, pointer.lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    pointer.lastX = x;
    pointer.lastY = y;
    scheduleRatioCheck();
  }

  const onPointerDown = (event: PointerEvent): void => {
    if (revealed || !ctx) return;
    event.preventDefault();
    const point = getPoint(event);
    scratching = true;
    pointer.lastX = point.x;
    pointer.lastY = point.y;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is optional in older WebViews.
    }
    scratchAt(point.x, point.y);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!scratching || revealed) return;
    event.preventDefault();
    const point = getPoint(event);
    scratchAt(point.x, point.y);
  };

  const onPointerUp = (event: PointerEvent): void => {
    scratching = false;
    try {
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture is optional in older WebViews.
    }
    scheduleRatioCheck(true);
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerUp);

  const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(stage);
  window.addEventListener('resize', resize);

  const onEscape = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') destroy();
  };

  function destroy(): void {
    if (ratioFrame !== null) cancelAnimationFrame(ratioFrame);
    if (ratioTimer !== null) clearTimeout(ratioTimer);
    stopConfetti?.();
    resizeObserver?.disconnect();
    window.removeEventListener('resize', resize);
    window.removeEventListener('keydown', onEscape);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
    canvas.removeEventListener('pointerleave', onPointerUp);
    backdrop.remove();
  }

  closeButton.addEventListener('click', destroy);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) destroy();
  });
  window.addEventListener('keydown', onEscape);

  if (revealed) {
    canvas.classList.add('fading');
  } else {
    requestAnimationFrame(resize);
  }

  return { close: destroy };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  installLatestCheckinLoveFoil();
}
