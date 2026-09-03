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

  // Coil in the native activity can load remote URLs, but cannot resolve a
  // browser-relative path or a temporary browser blob URL by itself.
  if (absoluteUrl.protocol !== 'https:' && absoluteUrl.protocol !== 'http:') return false;

  try {
    // Keep the bridge as the receiver. Android's WebView only exposes this
    // Java method when invoked through its registered JS interface object.
    bridge.openPhotoViewer(
      absoluteUrl.href,
      alt,
      '',
      '',
      'check-in-love-message.jpg',
    );
    return true;
  } catch {
    // A partially-updated or older APK can lack a compatible bridge. The
    // regular DOM viewer below remains a working fallback in that case.
    return false;
  }
}

/** Opens a lightweight, chat-only image viewer with pinch-to-zoom, double-tap zoom, and swipe-down-to-dismiss. */
export function openMessageImageViewer(imageUrl: string, alt = 'Ảnh tin nhắn'): { close: () => void } {
  activeClose?.();

  // Android WebView has an intermittent GPU-compositing failure for this
  // fixed, full-screen <img>. Use the native viewer there; PWA/web retain the
  // lightweight DOM viewer below.
  if (openNativePhotoViewer(imageUrl, alt)) {
    return { close: () => {} };
  }

  const backdrop = document.createElement('div');
  backdrop.className = 'message-image-viewer-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-label', 'Xem ảnh');

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'message-image-viewer-close';
  closeButton.setAttribute('aria-label', 'Đóng ảnh');
  closeButton.textContent = '×';

  const imageWrap = document.createElement('div');
  imageWrap.className = 'message-image-viewer-wrap';

  const image = document.createElement('img');
  image.className = 'message-image-viewer-image';
  image.src = imageUrl;
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
  };

  closeButton.addEventListener('click', close);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop || event.target === imageWrap) close();
  });

  // ── Gesture State ──
  let scale = 1;
  let translateX = 0;
  let translateY = 0;

  // Touch tracking
  let touchStartX = 0;
  let touchStartY = 0;
  let lastTouchX = 0;
  let lastTouchY = 0;
  let initialPinchDistance = 0;
  let initialScale = 1;
  let isSwipingDown = false;
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

  // Double tap to zoom
  image.addEventListener('click', (event) => {
    event.stopPropagation();
    const now = Date.now();
    if (now - lastTapTime < 300) {
      lastTapTime = 0;
      try { navigator.vibrate?.(12); } catch {}
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

  // Wheel zoom on desktop
  image.addEventListener('wheel', (e: WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.002;
    const newScale = Math.min(Math.max(1, scale + delta), 4);
    if (newScale === 1) {
      resetZoom(true);
    } else {
      scale = newScale;
      updateTransform(false);
    }
  }, { passive: false });

  // Touch gesture handling
  image.addEventListener('touchstart', (e: TouchEvent) => {
    if (e.touches.length === 2) {
      isSwipingDown = false;
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
      isPanning = scale > 1;
    }
  }, { passive: true });

  image.addEventListener('touchmove', (e: TouchEvent) => {
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
        if (deltaY > 8 && deltaY > Math.abs(deltaX) * 1.2) {
          isSwipingDown = true;
          e.preventDefault();
          translateY = deltaY;
          translateX = deltaX * 0.2;
          const pullRatio = Math.min(deltaY / 400, 1);
          const currentScale = Math.max(0.72, 1 - pullRatio * 0.25);
          image.style.transition = 'none';
          image.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${currentScale})`;
          backdrop.style.background = `rgba(0, 0, 0, ${Math.max(0.15, 0.94 * (1 - pullRatio))})`;
        }
      } else if (isPanning) {
        e.preventDefault();
        const moveX = t.clientX - lastTouchX;
        const moveY = t.clientY - lastTouchY;
        lastTouchX = t.clientX;
        lastTouchY = t.clientY;
        translateX += moveX;
        translateY += moveY;
        updateTransform(false);
      }
    }
  }, { passive: false });

  image.addEventListener('touchend', (e: TouchEvent) => {
    if (e.touches.length < 2) {
      initialPinchDistance = 0;
    }

    if (isSwipingDown) {
      if (translateY > 95) {
        try { navigator.vibrate?.(10); } catch {}
        image.style.transition = 'transform 0.22s cubic-bezier(0.4, 0, 1, 1), opacity 0.2s ease-out';
        image.style.transform = `translate3d(${translateX}px, ${window.innerHeight}px, 0) scale(0.65)`;
        backdrop.style.transition = 'background 0.22s ease-out';
        backdrop.style.background = 'rgba(0, 0, 0, 0)';
        window.setTimeout(close, 200);
      } else {
        image.style.transition = 'transform 0.26s cubic-bezier(0.2, 0.9, 0.3, 1)';
        backdrop.style.transition = 'background 0.26s ease-out';
        backdrop.style.background = 'rgba(0, 0, 0, .94)';
        resetZoom(true);
      }
      isSwipingDown = false;
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
