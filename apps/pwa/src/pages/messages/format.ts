import type { ChatMessage } from '../../api/types';

const GROUP_WINDOW_MS = 5 * 60 * 1000;
const LONG_THREAD_THRESHOLD = 120;

const messageTimeFormatter = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' });
const messageDateFormatter = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function escapeHtml(value: string | undefined): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function formatMessageTime(value: string, now = new Date()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const time = messageTimeFormatter.format(date);
  if (localDayKey(date) === localDayKey(now)) return time;

  const day = messageDateFormatter.format(date);
  return `${day} ${time}`;
}

export function getLatestActivityTime(item: ChatMessage): number {
  return new Date(item.createdAt).getTime();
}

export function messageText(item: ChatMessage): string {
  if (item.text) return item.text;
  if (item.systemEvent?.kind === 'background_changed') {
    if (item.systemEvent.backgroundKind === 'preset' && item.systemEvent.backgroundId === 'default') {
      return `${item.senderName} đã khôi phục chủ đề mặc định`;
    }
    return `${item.senderName} đã đổi chủ đề thành ${item.systemEvent.backgroundLabel}`;
  }
  return '';
}

export function replySummary(item: ChatMessage): string {
  return messageText(item) || (item.imageUrl ? 'Ảnh' : 'Tin nhắn');
}

/**
 * Returns true if `text` consists purely of 1–3 standalone emoji grapheme sequences
 * (no letters, digits, or punctuation) so we render jumbo sticker-like glyphs.
 */
export function isEmojiOnlyText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 18) return false;
  if (/[\p{L}\p{N}.,!?;:'"()[\]{}<>/\\@#$%^&*_+=~`|-]/u.test(trimmed)) {
    return false;
  }
  const matches = trimmed.match(/\p{Extended_Pictographic}/gu);
  if (!matches || matches.length < 1 || matches.length > 3) return false;
  const stripped = trimmed.replace(/(?:\p{Extended_Pictographic}|[\uFE00-\uFE0F]|\u200D|[\u{1F3FB}-\u{1F3FF}]|\s)/gu, '');
  return stripped.length === 0;
}

/**
 * Updates consecutive sender grouping classes (`.is-group-single|first|middle|last`)
 * on outer message elements (never touching `.chat-text-bubble`) and toggles
 * `.is-long-thread` for `content-visibility: auto` virtualization on long histories.
 */
export function decorateThreadGrouping(thread: HTMLElement): void {
  const nodes = Array.from(thread.querySelectorAll<HTMLElement>(':scope > [data-message-id]'));
  thread.classList.toggle('is-long-thread', nodes.length >= LONG_THREAD_THRESHOLD);

  interface Entry {
    el: HTMLElement;
    own: boolean;
    ts: number;
    groupable: boolean;
    prevWasSeparator: boolean;
  }

  const entries: Entry[] = nodes.map((el) => {
    const rawTs = el.dataset.messageCreatedAt ? Date.parse(el.dataset.messageCreatedAt) : NaN;
    const isSystem = el.classList.contains('message-system-event');
    const isPhoto = el.classList.contains('chat-checkin-group');
    const isEmoji = el.classList.contains('is-emoji-only');
    return {
      el,
      own: el.classList.contains('own'),
      ts: Number.isNaN(rawTs) ? 0 : rawTs,
      groupable: !isSystem && !isPhoto && !isEmoji,
      prevWasSeparator: Boolean(el.previousElementSibling?.classList.contains('messages-time-separator')),
    };
  });

  const canChain = (a: Entry | undefined, b: Entry | undefined): boolean => {
    if (!a || !b || !a.groupable || !b.groupable) return false;
    if (b.prevWasSeparator) return false;
    if (a.own !== b.own) return false;
    return Math.abs(b.ts - a.ts) <= GROUP_WINDOW_MS;
  };

  for (let i = 0; i < entries.length; i += 1) {
    const cur = entries[i];
    if (!cur.groupable) continue;
    const prevSame = canChain(entries[i - 1], cur);
    const nextSame = canChain(cur, entries[i + 1]);
    const role = prevSame && nextSame
      ? 'is-group-middle'
      : !prevSame && nextSame
        ? 'is-group-first'
        : prevSame && !nextSame
          ? 'is-group-last'
          : 'is-group-single';

    for (const cls of ['is-group-single', 'is-group-first', 'is-group-middle', 'is-group-last']) {
      if (cls === role) {
        if (!cur.el.classList.contains(cls)) cur.el.classList.add(cls);
      } else if (cur.el.classList.contains(cls)) {
        cur.el.classList.remove(cls);
      }
    }
  }
}
