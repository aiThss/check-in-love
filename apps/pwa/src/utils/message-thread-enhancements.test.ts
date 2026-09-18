// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { decorateTimeSeparators } from './message-thread-enhancements';

function createMessage(createdAt: string, label: string): HTMLElement {
  const element = document.createElement('article');
  element.dataset.messageId = createdAt;
  element.dataset.messageCreatedAt = createdAt;
  const time = document.createElement('time');
  time.textContent = label;
  element.appendChild(time);
  return element;
}

describe('message time separators', () => {
  it('keeps existing separators without DOM mutations on unchanged refreshes', () => {
    const page = document.createElement('section');
    page.innerHTML = '<main class="messages-thread"></main>';
    const thread = page.firstElementChild!;
    thread.append(createMessage('2026-08-08T07:00:00Z', '14:00'), createMessage('2026-08-08T08:00:00Z', '15:00'));
    decorateTimeSeparators(page);
    const separator = thread.querySelector('.messages-time-separator');
    const observer = new MutationObserver(() => {});
    observer.observe(thread, { childList: true, subtree: true });
    decorateTimeSeparators(page);
    expect(observer.takeRecords()).toHaveLength(0);
    expect(thread.querySelector('.messages-time-separator')).toBe(separator);
    observer.disconnect();
  });

  it('adds a separator after a gap of at least twenty minutes', () => {
    const page = document.createElement('section');
    const thread = document.createElement('main');
    thread.className = 'messages-thread';
    thread.append(
      createMessage('2026-08-08T07:00:00.000Z', '14:00'),
      createMessage('2026-08-08T07:19:00.000Z', '14:19'),
      createMessage('2026-08-08T07:39:00.000Z', '14:39'),
    );
    page.appendChild(thread);

    decorateTimeSeparators(page);

    expect(thread.querySelectorAll('.messages-time-separator')).toHaveLength(1);
    expect(thread.querySelector('.messages-time-separator')?.textContent).toBe('14:39');
  });

  it('uses the actual date when messages cross midnight', () => {
    const page = document.createElement('section');
    const thread = document.createElement('main');
    thread.className = 'messages-thread';
    thread.append(
      createMessage('2026-08-07T16:30:00.000Z', '23:30'),
      createMessage('2026-08-07T17:00:00.000Z', '08/08/2026 00:00'),
    );
    page.appendChild(thread);

    decorateTimeSeparators(page);

    expect(thread.querySelector('.messages-time-separator')?.textContent).toBe('08/08/2026 00:00');
  });
});
