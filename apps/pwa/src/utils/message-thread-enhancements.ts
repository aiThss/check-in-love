import { invalidateQueries } from '../api/query-cache';
import {
  REFRESH_ICON_ANIMATION_DURATION_MS,
  refreshIconMarkup,
  setRefreshButtonLoading,
} from '../components/refresh-icon';
import { showToast } from '../components/toast';
import { invalidateRoutes } from '../route-invalidation';
import { navigate } from '../router';

const MESSAGE_GAP_MS = 20 * 60 * 1000;
const REFRESH_DRAFT_KEY = 'lovecheck_message_draft_after_manual_refresh';

let initialized = false;
let enhanceFrame: number | null = null;
let refreshInProgress = false;
let messageRefreshAnimationEndsAt = 0;

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

function restoreDraft(attempt = 0): void {
  const draft = sessionStorage.getItem(REFRESH_DRAFT_KEY);
  if (draft === null) return;

  const input = getActiveMessagesPage()?.querySelector<HTMLInputElement>('#message-input');
  if (!input) {
    if (attempt < 10) window.setTimeout(() => restoreDraft(attempt + 1), 100);
    return;
  }

  input.value = draft;
  sessionStorage.removeItem(REFRESH_DRAFT_KEY);
}

function refreshMessages(page: HTMLElement, button: HTMLButtonElement): void {
  if (refreshInProgress) return;
  refreshInProgress = true;

  const draft = page.querySelector<HTMLInputElement>('#message-input')?.value ?? '';
  sessionStorage.setItem(REFRESH_DRAFT_KEY, draft);
  button.disabled = true;
  setRefreshButtonLoading(button, true);
  messageRefreshAnimationEndsAt = Date.now() + REFRESH_ICON_ANIMATION_DURATION_MS;
  button.setAttribute('aria-label', 'Đang tải lại tin nhắn');

  invalidateQueries('messages:list:');
  invalidateRoutes('/app/messages');
  showToast('Đang tải lại tin nhắn...', 'loading');
  navigate('/app/messages');

  window.setTimeout(() => {
    refreshInProgress = false;
    setRefreshButtonLoading(button, false);
    restoreDraft();
  }, 150);
}

function ensureRefreshButton(page: HTMLElement): void {
  const header = page.querySelector<HTMLElement>('.messages-header');
  if (!header || header.querySelector('.messages-refresh-button')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn-icon messages-refresh-button';
  button.setAttribute('aria-label', 'Tải lại tin nhắn');
  button.title = 'Tải lại tin nhắn';
  button.innerHTML = refreshIconMarkup;
  button.addEventListener('click', () => refreshMessages(page, button));
  header.appendChild(button);

  const remainingAnimationDuration = messageRefreshAnimationEndsAt - Date.now();
  if (remainingAnimationDuration > 0) {
    setRefreshButtonLoading(button, true);
    window.setTimeout(
      () => setRefreshButtonLoading(button, false, 0),
      remainingAnimationDuration,
    );
  }
}

function enhanceMessagesPage(): void {
  const page = getActiveMessagesPage();
  if (!page) return;

  ensureRefreshButton(page);
  decorateTimeSeparators(page);
  restoreDraft();
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
