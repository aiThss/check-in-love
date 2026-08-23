// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

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
