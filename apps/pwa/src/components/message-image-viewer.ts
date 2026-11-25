import { iconMarkup } from '../ui/icons/icons';
import { triggerHaptic } from '../ui/haptics';

let activeClose: (() => void) | null = null;

function openNativePhotoViewer(imageUrl: string, alt: string): boolean {
  const bridge = window.LoveCheckAndroid;
  if (!bridge?.openPhotoViewer) return false;

  let absoluteUrl: URL;
  try {
    absoluteUrl = new URL(imageUrl, window.location.href);
  } catch {
    return false;
  }

  if (absoluteUrl.protocol !== 'https:' && absoluteUrl.protocol !== 'http:') return false;

  try {
    bridge.openPhotoViewer(
      absoluteUrl.href,
      alt,
      '',
      '',
      'check-in-love-message.jpg',
    );
    return true;
  } catch {
    return false;
  }
}

export interface ImageViewerOptions {
  gallery?: string[];
  initialIndex?: number;
}

/**
 * Lightweight, gesture-rich image viewer with pinch-to-zoom, double-tap zoom,
 * swipe-down-to-dismiss, and optional horizontal gallery swipe.
 */
export function openMessageImageViewer(
  imageUrl: string,
  alt = 'Ảnh tin nhắn',
  options: ImageViewerOptions = {},
): { close: () => void } {
  activeClose?.();

  if (openNativePhotoViewer(imageUrl, alt)) {
    return { close: () => {} };
  }

  const gallery = options.gallery && options.gallery.length > 0 ? options.gallery : [imageUrl];
  let currentIndex = Math.max(0, Math.min(gallery.length - 1, options.initialIndex ?? gallery.indexOf(imageUrl)));
  if (currentIndex < 0) currentIndex = 0;

  const backdrop = document.createElement('div');
  backdrop.className = 'message-image-viewer-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-label', 'Xem ảnh');

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'message-image-viewer-close';
  closeButton.setAttribute('aria-label', 'Đóng ảnh');
  closeButton.innerHTML = iconMarkup('close', { size: 20 });

  const imageWrap = document.createElement('div');
  imageWrap.className = 'message-image-viewer-wrap';

  const image = document.createElement('img');
  image.className = 'message-image-viewer-image';
  image.src = gallery[currentIndex] ?? imageUrl;
  image.alt = alt;
  image.decoding = 'async';

  imageWrap.appendChild(image);
  backdrop.append(closeButton, imageWrap);

  const previousOverflow = document.body.style.overflow;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeyDown);
    document.body.style.overflow = previousOverflow;
    backdrop.remove();
    if (activeClose === close) activeClose = null;
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') close();
    else if (event.key === 'ArrowRight' && gallery.length > 1) stepGallery(1);
    else if (event.key === 'ArrowLeft' && gallery.length > 1) stepGallery(-1);
  };

  let scale = 1;
  let translateX = 0;
  let translateY = 0;

  let touchStartX = 0;
  let touchStartY = 0;
  let lastTouchX = 0;
  let lastTouchY = 0;
  let initialPinchDistance = 0;
  let initialScale = 1;
  let isSwipingDown = false;
  let isSwipingHorizontal = false;
  let isPanning = false;
  let lastTapTime = 0;

  const updateTransform = (smooth = false) => {
    image.style.transition = smooth ? 'transform 0.28s cubic-bezier(0.2, 0.9, 0.3, 1)' : 'none';
    image.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`;
  };

  const resetZoom = (smooth = true) => {
    scale = 1;
    translateX = 0;
    translateY = 0;
    updateTransform(smooth);
  };

  const stepGallery = (delta: number) => {
    const nextIdx = currentIndex + delta;
    if (nextIdx < 0 || nextIdx >= gallery.length) return;
    currentIndex = nextIdx;
    triggerHaptic('select');
    resetZoom(false);
    image.src = gallery[currentIndex];
  };

  closeButton.addEventListener('click', close);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop || event.target === imageWrap) close();
  });

  image.addEventListener('click', (event) => {
    event.stopPropagation();
    const now = Date.now();
    if (now - lastTapTime < 300) {
      lastTapTime = 0;
      triggerHaptic('tap');
      if (scale > 1.2) {
        resetZoom(true);
      } else {
        scale = 2.5;
        const rect = image.getBoundingClientRect();
        const offsetX = (event.clientX - (rect.left + rect.width / 2)) * 1.2;
        const offsetY = (event.clientY - (rect.top + rect.height / 2)) * 1.2;
        translateX = -offsetX;
        translateY = -offsetY;
        updateTransform(true);
      }
    } else {
      lastTapTime = now;
    }
  });

  image.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.002;
      const newScale = Math.min(Math.max(1, scale + delta), 4);
      if (newScale === 1) resetZoom(true);
      else {
        scale = newScale;
        updateTransform(false);
      }
    },
    { passive: false },
  );

  image.addEventListener(
    'touchstart',
    (e: TouchEvent) => {
      if (e.touches.length === 2) {
        isSwipingDown = false;
        isSwipingHorizontal = false;
        isPanning = false;
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        initialPinchDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        initialScale = scale;
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        touchStartX = t.clientX;
        touchStartY = t.clientY;
        lastTouchX = t.clientX;
        lastTouchY = t.clientY;
        isSwipingDown = false;
        isSwipingHorizontal = false;
        isPanning = scale > 1;
      }
    },
    { passive: true },
  );

  image.addEventListener(
    'touchmove',
    (e: TouchEvent) => {
      if (e.touches.length === 2 && initialPinchDistance > 0) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currentDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        scale = Math.min(Math.max(1, initialScale * (currentDistance / initialPinchDistance)), 4.5);
        updateTransform(false);
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        const deltaX = t.clientX - touchStartX;
        const deltaY = t.clientY - touchStartY;

        if (scale === 1) {
          if (!isSwipingHorizontal && deltaY > 8 && deltaY > Math.abs(deltaX) * 1.2) {
            isSwipingDown = true;
            e.preventDefault();
            translateY = deltaY;
            translateX = deltaX * 0.2;
            const pullRatio = Math.min(deltaY / 400, 1);
            const currentScale = Math.max(0.72, 1 - pullRatio * 0.25);
            image.style.transition = 'none';
            image.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${currentScale})`;
            backdrop.style.background = `rgba(12, 8, 11, ${Math.max(0.15, 0.94 * (1 - pullRatio))})`;
          } else if (!isSwipingDown && gallery.length > 1 && Math.abs(deltaX) > 16 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
            isSwipingHorizontal = true;
            e.preventDefault();
            translateX = deltaX * 0.55;
            updateTransform(false);
          }
        } else if (isPanning) {
          e.preventDefault();
          translateX += t.clientX - lastTouchX;
          translateY += t.clientY - lastTouchY;
          lastTouchX = t.clientX;
          lastTouchY = t.clientY;
          updateTransform(false);
        }
      }
    },
    { passive: false },
  );

  image.addEventListener('touchend', (e: TouchEvent) => {
    if (e.touches.length < 2) initialPinchDistance = 0;

    if (isSwipingDown) {
      if (translateY > 95) {
        triggerHaptic('tap');
        image.style.transition = 'transform 0.22s cubic-bezier(0.4, 0, 1, 1), opacity 0.2s ease-out';
        image.style.transform = `translate3d(${translateX}px, ${window.innerHeight}px, 0) scale(0.65)`;
        backdrop.style.transition = 'background 0.22s ease-out';
        backdrop.style.background = 'rgba(0, 0, 0, 0)';
        window.setTimeout(close, 200);
      } else {
        backdrop.style.transition = 'background 0.26s ease-out';
        backdrop.style.background = 'rgba(12, 8, 11, .94)';
        resetZoom(true);
      }
      isSwipingDown = false;
    } else if (isSwipingHorizontal) {
      if (translateX < -55) stepGallery(1);
      else if (translateX > 55) stepGallery(-1);
      else resetZoom(true);
      isSwipingHorizontal = false;
    } else if (scale < 1.05) {
      resetZoom(true);
    }
  });

  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', onKeyDown);
  activeClose = close;
  window.setTimeout(() => closeButton.focus(), 0);
  return { close };
}
