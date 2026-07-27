import '../styles/polaroid-cover.css';

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
  /** Starts a fresh scratch session even if this image was opened before. */
  restartScratch?: boolean;
  onRevealed?: () => void;
}

const DEFAULT_REVEAL_THRESHOLD = 0.8;
const STAGE_CORNER_RADIUS = 28;
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
  });
}

let syncFrame: number | null = null;

function schedulePillSync(): void {
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

function drawLoveFoil(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
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
  ctx.font = "800 18px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText('LOVE NOTE', width / 2, height / 2 - 8);
  ctx.globalAlpha = 0.82;
  ctx.font = "700 11px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText('CÀO ĐỂ MỞ', width / 2, height / 2 + 20);
  ctx.restore();
  ctx.restore();
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
    restartScratch = false,
    onRevealed,
  } = options;

  const latestImage = isLatestSurpriseImage(imageUrl);
  const scratchEligible = forceScratch ?? latestImage;
  const alreadyOpened = readRevealState(imageUrl);
  let revealed = !scratchEligible || (alreadyOpened && !restartScratch);
  let scratching = false;
  let ratioFrame: number | null = null;
  let width = 0;
  let height = 0;

  const backdrop = document.createElement('div');
  backdrop.className = 'polaroid-modal-backdrop love-foil-modal';

  const modal = document.createElement('div');
  modal.className = 'polaroid-modal-container';

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'polaroid-modal-close';
  closeButton.setAttribute('aria-label', 'Đóng');
  closeButton.textContent = '✕';

  const stage = document.createElement('div');
  stage.className = 'polaroid-stage-view';
  stage.classList.toggle('is-revealed', revealed);

  const image = document.createElement('img');
  image.className = 'polaroid-stage-photo';
  image.src = imageUrl;
  image.alt = title;

  const canvas = document.createElement('canvas');
  canvas.className = 'polaroid-stage-canvas';
  canvas.setAttribute('aria-label', 'Cào lớp Love Foil để mở ảnh');

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
  stage.append(image, canvas, hud, success);
  modal.append(closeButton, stage, footer);
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

    if (!revealed) {
      ctx.save();
      clipToStage(ctx, width, height);
      drawLoveFoil(ctx, width, height);
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
    onRevealed?.();
  }

  function scheduleRatioCheck(): void {
    if (!ctx || revealed || ratioFrame !== null) return;
    ratioFrame = requestAnimationFrame(() => {
      ratioFrame = null;
      const ratio = getClearedRatio();
      updateProgress(ratio);
      if (ratio >= revealThreshold) reveal();
    });
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
    scheduleRatioCheck();
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
