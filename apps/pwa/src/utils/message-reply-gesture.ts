const MESSAGE_BUBBLE_SELECTOR = '.chat-text-bubble, .chat-bubble';
const REPLY_PREVIEW_SELECTOR = '.messages-reply-preview';
const LEFT_SWIPE_INTENT_DISTANCE = 10;
const LEFT_SWIPE_REPLY_THRESHOLD = 52;
const LEFT_SWIPE_MAX_TRANSLATE = 72;

interface ActiveLeftSwipe {
  pointerId: number;
  startX: number;
  startY: number;
  bubble: HTMLElement;
  horizontalIntent: boolean;
  activated: boolean;
}

let initialized = false;
let dispatchingSyntheticReply = false;
let activeSwipe: ActiveLeftSwipe | null = null;

function clampSwipe(distance: number): number {
  if (distance <= LEFT_SWIPE_MAX_TRANSLATE) return distance;
  return LEFT_SWIPE_MAX_TRANSLATE + (distance - LEFT_SWIPE_MAX_TRANSLATE) * 0.18;
}

function createPointerEvent(
  type: string,
  pointerId: number,
  clientX: number,
  clientY: number,
): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    buttons: type === 'pointerup' ? 0 : 1,
    clientX,
    clientY,
  });
}

/**
 * messages.ts already owns the reply state and submit behavior. Reuse its tested
 * right-swipe handler for a completed left swipe instead of duplicating that state.
 */
function invokeExistingReplyHandler(bubble: HTMLElement): void {
  if (dispatchingSyntheticReply || typeof PointerEvent !== 'function') return;

  dispatchingSyntheticReply = true;
  const pointerId = 2_147_000_001;
  const ownSetCapture = Object.getOwnPropertyDescriptor(bubble, 'setPointerCapture');
  const ownReleaseCapture = Object.getOwnPropertyDescriptor(bubble, 'releasePointerCapture');

  try {
    // Synthetic pointer IDs cannot be captured by the browser. The existing handler
    // only needs capture for a physical gesture, so make it a no-op for this bridge.
    Object.defineProperty(bubble, 'setPointerCapture', {
      configurable: true,
      value: () => undefined,
    });
    Object.defineProperty(bubble, 'releasePointerCapture', {
      configurable: true,
      value: () => undefined,
    });

    bubble.dispatchEvent(createPointerEvent('pointerdown', pointerId, 100, 100));
    bubble.dispatchEvent(createPointerEvent('pointermove', pointerId, 170, 100));
    bubble.dispatchEvent(createPointerEvent('pointerup', pointerId, 170, 100));
  } finally {
    if (ownSetCapture) Object.defineProperty(bubble, 'setPointerCapture', ownSetCapture);
    else Reflect.deleteProperty(bubble, 'setPointerCapture');

    if (ownReleaseCapture) Object.defineProperty(bubble, 'releasePointerCapture', ownReleaseCapture);
    else Reflect.deleteProperty(bubble, 'releasePointerCapture');

    dispatchingSyntheticReply = false;
  }
}

function clearSwipeVisuals(): void {
  if (!activeSwipe) return;
  const { bubble, pointerId } = activeSwipe;
  bubble.classList.remove('is-swiping', 'is-swiping-left', 'is-swipe-ready');
  bubble.style.transform = '';
  try {
    if (bubble.hasPointerCapture?.(pointerId)) bubble.releasePointerCapture(pointerId);
  } catch {
    // The pointer may already have ended in Android WebView.
  }
  activeSwipe = null;
}

function getBubble(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  if (target.closest('.message-quote, .message-referenced-checkin, button, a, input, textarea')) {
    return null;
  }
  const bubble = target.closest<HTMLElement>(MESSAGE_BUBBLE_SELECTOR);
  if (!bubble?.closest('.messages-thread')) return null;
  return bubble;
}

function onPointerDown(event: PointerEvent): void {
  if (dispatchingSyntheticReply || event.button !== 0 || !event.isPrimary) return;
  const bubble = getBubble(event.target);
  if (!bubble) return;

  activeSwipe = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    bubble,
    horizontalIntent: false,
    activated: false,
  };
}

function onPointerMove(event: PointerEvent): void {
  const swipe = activeSwipe;
  if (dispatchingSyntheticReply || !swipe || event.pointerId !== swipe.pointerId) return;

  const deltaX = event.clientX - swipe.startX;
  const deltaY = event.clientY - swipe.startY;
  const absoluteX = Math.abs(deltaX);
  const absoluteY = Math.abs(deltaY);

  if (!swipe.horizontalIntent && Math.max(absoluteX, absoluteY) >= LEFT_SWIPE_INTENT_DISTANCE) {
    // Right swipe is handled natively by messages.ts. This bridge only adds the
    // missing left direction, which is natural for the user's own right-aligned bubble.
    if (deltaX >= 0 || absoluteX <= absoluteY * 1.2) {
      activeSwipe = null;
      return;
    }

    swipe.horizontalIntent = true;
    try {
      swipe.bubble.setPointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture is an enhancement, not a requirement.
    }
  }

  if (!swipe.horizontalIntent) return;
  event.preventDefault();

  const translate = clampSwipe(Math.max(0, -deltaX));
  swipe.activated = translate >= LEFT_SWIPE_REPLY_THRESHOLD;
  swipe.bubble.classList.add('is-swiping', 'is-swiping-left');
  swipe.bubble.classList.toggle('is-swipe-ready', swipe.activated);
  swipe.bubble.style.transform = `translateX(${-translate}px)`;
}

function finishSwipe(event: PointerEvent, cancelled: boolean): void {
  const swipe = activeSwipe;
  if (!swipe || event.pointerId !== swipe.pointerId) return;

  const shouldReply = swipe.horizontalIntent && swipe.activated && !cancelled;
  const bubble = swipe.bubble;
  clearSwipeVisuals();

  if (shouldReply) {
    event.preventDefault();
    invokeExistingReplyHandler(bubble);
  }
}

function syncComposerReplyState(form: HTMLFormElement): void {
  const preview = form.querySelector<HTMLElement>(REPLY_PREVIEW_SELECTOR);
  if (!preview) return;

  const hasReply = !preview.hidden;
  form.classList.toggle('has-reply', hasReply);
  form.closest<HTMLElement>('.messages-page')?.classList.toggle('has-message-reply', hasReply);
}

function enhanceMessagesPage(root: ParentNode = document): void {
  root.querySelectorAll<HTMLFormElement>('.messages-composer').forEach((form) => {
    if (form.dataset.replyLayoutEnhanced === 'true') return;
    form.dataset.replyLayoutEnhanced = 'true';

    const preview = form.querySelector<HTMLElement>(REPLY_PREVIEW_SELECTOR);
    if (preview) {
      const observer = new MutationObserver(() => syncComposerReplyState(form));
      observer.observe(preview, {
        attributes: true,
        attributeFilter: ['hidden'],
        childList: true,
        subtree: true,
      });
    }
    syncComposerReplyState(form);
  });

  root.querySelectorAll<HTMLImageElement>('.chat-bubble.has-photo > img').forEach((image) => {
    image.draggable = false;
  });
}

export function initMessageReplyGesture(): void {
  if (initialized) return;
  initialized = true;

  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('pointermove', onPointerMove, { capture: true, passive: false });
  document.addEventListener('pointerup', (event) => finishSwipe(event, false), true);
  document.addEventListener('pointercancel', (event) => finishSwipe(event, true), true);

  const observer = new MutationObserver((records) => {
    records.forEach((record) => {
      record.addedNodes.forEach((node) => {
        if (node instanceof Element) enhanceMessagesPage(node);
      });
    });
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  enhanceMessagesPage();
}
