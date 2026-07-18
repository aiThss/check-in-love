import { invalidateQueries } from '../api/query-cache';
import { showToast } from '../components/toast';
import { invalidateRoutes } from '../route-invalidation';
import { navigate } from '../router';

const MESSAGE_GAP_MINUTES = 20;
const MINUTES_PER_DAY = 24 * 60;
const REFRESH_DRAFT_KEY = 'lovecheck_message_draft_after_manual_refresh';

let initialized = false;
let enhanceFrame: number | null = null;
let refreshInProgress = false;

function getActiveMessagesPage(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.route-page.is-active .messages-page')
    ?? document.querySelector<HTMLElement>('.messages-page');
}

function parseClockMinutes(message: HTMLElement): number | null {
  const label = message.querySelector<HTMLTimeElement>('time')?.textContent?.trim();
  const match = label?.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function createTimeSeparator(label: string): HTMLTimeElement {
  const separator = document.createElement('time');
  separator.className = 'messages-time-separator';
  separator.textContent = label;
  separator.setAttribute('aria-label', `Tin nhắn mới lúc ${label}`);
  return separator;
}

function decorateTimeSeparators(page: HTMLElement): void {
  const thread = page.querySelector<HTMLElement>('.messages-thread');
  if (!thread) return;

  thread.querySelectorAll('.messages-time-separator').forEach((separator) => separator.remove());

  const messageElements = Array.from(
    thread.querySelectorAll<HTMLElement>(':scope > [data-message-id]'),
  );
  let previousClockMinutes: number | null = null;
  let previousTimelineMinutes: number | null = null;
  let dayOffsetMinutes = 0;

  messageElements.forEach((message) => {
    const clockMinutes = parseClockMinutes(message);
    const label = message.querySelector<HTMLTimeElement>('time')?.textContent?.trim();
    if (clockMinutes === null || !label) return;

    if (previousClockMinutes !== null && clockMinutes < previousClockMinutes) {
      dayOffsetMinutes += MINUTES_PER_DAY;
    }

    const timelineMinutes = dayOffsetMinutes + clockMinutes;
    if (
      previousTimelineMinutes !== null
      && timelineMinutes - previousTimelineMinutes >= MESSAGE_GAP_MINUTES
    ) {
      message.before(createTimeSeparator(label));
    }

    previousClockMinutes = clockMinutes;
    previousTimelineMinutes = timelineMinutes;
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
  button.classList.add('is-refreshing');
  button.setAttribute('aria-label', 'Đang tải lại tin nhắn');

  invalidateQueries('messages:list:');
  invalidateRoutes('/app/messages');
  showToast('Đang tải lại tin nhắn...', 'info');
  navigate('/app/messages');

  window.setTimeout(() => {
    refreshInProgress = false;
    restoreDraft();
  }, 150);
}

function ensureRefreshButton(page: HTMLElement): void {
  const header = page.querySelector<HTMLElement>('.messages-header');
  if (!header || header.querySelector('.messages-refresh-button')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'messages-refresh-button';
  button.setAttribute('aria-label', 'Tải lại tin nhắn');
  button.title = 'Tải lại tin nhắn';
  button.innerHTML = '<span aria-hidden="true">↻</span>';
  button.addEventListener('click', () => refreshMessages(page, button));
  header.appendChild(button);
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
