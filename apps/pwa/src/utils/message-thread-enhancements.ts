const MESSAGE_GAP_MS = 20 * 60 * 1000;

let initialized = false;
let enhanceFrame: number | null = null;

function getActiveMessagesPage(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.route-page.is-active .messages-page')
    ?? document.querySelector<HTMLElement>('.messages-page');
}

function parseMessageTimestamp(message: HTMLElement): number | null {
  const value = message.dataset.messageCreatedAt;
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function createTimeSeparator(label: string): HTMLTimeElement {
  const separator = document.createElement('time');
  separator.className = 'messages-time-separator';
  separator.textContent = label;
  separator.setAttribute('aria-label', `Tin nhắn mới lúc ${label}`);
  return separator;
}

export function decorateTimeSeparators(page: HTMLElement): void {
  const thread = page.querySelector<HTMLElement>('.messages-thread');
  if (!thread) return;

  thread.querySelectorAll('.messages-time-separator').forEach((separator) => separator.remove());

  const messageElements = Array.from(
    thread.querySelectorAll<HTMLElement>(':scope > [data-message-id]'),
  );
  let previousTimestamp: number | null = null;

  messageElements.forEach((message) => {
    const timestamp = parseMessageTimestamp(message);
    const label = message.querySelector<HTMLTimeElement>('time')?.textContent?.trim();
    if (timestamp === null || !label) return;

    if (
      previousTimestamp !== null
      && timestamp - previousTimestamp >= MESSAGE_GAP_MS
    ) {
      message.before(createTimeSeparator(label));
    }

    previousTimestamp = timestamp;
  });
}

function enhanceMessagesPage(): void {
  const page = getActiveMessagesPage();
  if (!page) return;

  decorateTimeSeparators(page);
}

function scheduleEnhancement(): void {
  if (enhanceFrame !== null) return;
  enhanceFrame = window.requestAnimationFrame(() => {
    enhanceFrame = null;
    enhanceMessagesPage();
  });
}

function containsMessageNode(node: Node): boolean {
  if (!(node instanceof Element)) return false;
  return node.matches('.messages-page, [data-message-id]')
    || Boolean(node.querySelector('.messages-page, [data-message-id]'));
}

export function initMessageThreadEnhancements(): void {
  if (initialized) return;
  initialized = true;

  const observer = new MutationObserver((mutations) => {
    const shouldEnhance = mutations.some((mutation) => (
      [...mutation.addedNodes, ...mutation.removedNodes].some(containsMessageNode)
    ));
    if (shouldEnhance) scheduleEnhancement();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  scheduleEnhancement();
}
