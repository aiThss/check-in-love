// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CheckIn } from '../api/types';

const mocks = vi.hoisted(() => ({
  getCheckins: vi.fn(),
  createCheckin: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('../api/checkins', () => ({
  getCheckins: mocks.getCheckins,
  createCheckin: mocks.createCheckin,
}));
vi.mock('../components/camera', () => ({
  openCamera: vi.fn(),
  processImage: vi.fn(),
  revokePreviewUrl: vi.fn(),
}));
vi.mock('../components/toast', () => ({ showToast: mocks.showToast }));
vi.mock('../store/index', () => ({
  store: {
    get: () => ({
      user: { id: 'me', displayName: 'Me' },
      couple: { id: 'couple' },
    }),
  },
}));

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

function checkin(id: string, own = false, caption = id): CheckIn {
  return {
    id,
    userId: own ? 'me' : 'partner',
    coupleId: 'couple',
    type: 'text',
    caption,
    reactions: [],
    replies: [],
    ownerName: own ? 'Me' : 'Partner',
    isOwn: own,
    createdAt: `2026-07-17T10:0${id.length}:00.000Z`,
    updatedAt: `2026-07-17T10:0${id.length}:00.000Z`,
  };
}

function response(data: CheckIn[], hasMore = false) {
  return { data, total: data.length, page: 1, limit: 50, hasMore };
}

function pointer(type: string, x: number, y: number, id = 1): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: id },
    clientX: { value: x },
    clientY: { value: y },
    button: { value: 0 },
  });
  return event;
}

describe('Messages scroll and reply behavior', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    document.body.replaceChildren();
    localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => { callback(0); return 1; },
    });
    Object.defineProperty(window, 'cancelAnimationFrame', { configurable: true, value: vi.fn() });
    mocks.getCheckins.mockReset();
    mocks.createCheckin.mockReset();
    mocks.showToast.mockReset();
  });

  afterEach(() => vi.useRealTimers());

  async function mount(data: CheckIn[], hasMore = false) {
    mocks.getCheckins.mockResolvedValue(response(data, hasMore));
    const { renderMessagesPage } = await import('./messages');
    const routePage = renderMessagesPage();
    document.body.appendChild(routePage.element);
    routePage.activate?.();
    await flush();
    return routePage;
  }

  function setScrollMetrics(thread: HTMLElement, scrollTop: number, scrollHeight = 1000, clientHeight = 200) {
    Object.defineProperties(thread, {
      scrollTop: { configurable: true, writable: true, value: scrollTop },
      scrollHeight: { configurable: true, value: scrollHeight },
      clientHeight: { configurable: true, value: clientHeight },
    });
  }

  it('opens at the bottom once, keeps existing bubble identity, and does not pull a reader down for incoming messages', async () => {
    const first = checkin('first');
    const routePage = await mount([first]);
    const thread = routePage.element.querySelector<HTMLElement>('.messages-thread')!;
    const original = thread.querySelector<HTMLElement>('[data-message-id="first"]')!;
    setScrollMetrics(thread, 0);
    thread.dispatchEvent(new Event('scroll'));

    const incoming = checkin('incoming');
    mocks.getCheckins.mockResolvedValue(response([first, incoming]));
    await vi.advanceTimersByTimeAsync(10_000);

    expect(thread.querySelector('[data-message-id="first"]')).toBe(original);
    expect(thread.scrollTop).toBe(0);
    const indicator = routePage.element.querySelector<HTMLButtonElement>('.messages-new-indicator')!;
    expect(indicator.hidden).toBe(false);
    expect(indicator.textContent).toContain('1');

    indicator.click();
    expect(indicator.hidden).toBe(true);
    expect(thread.scrollTop).toBe(1000);
  });

  it('follows incoming messages only while pinned near the bottom and retains inner scroll through route activation', async () => {
    const first = checkin('first');
    const routePage = await mount([first]);
    const thread = routePage.element.querySelector<HTMLElement>('.messages-thread')!;
    setScrollMetrics(thread, 760);
    thread.dispatchEvent(new Event('scroll'));
    mocks.getCheckins.mockResolvedValue(response([first, checkin('incoming')]));

    await vi.advanceTimersByTimeAsync(10_000);
    expect(thread.scrollTop).toBe(1000);

    thread.scrollTop = 321;
    routePage.deactivate?.();
    routePage.activate?.();
    await flush();
    expect(thread.scrollTop).toBe(321);
  });

  it('prepends older messages without moving the reader away from the visible anchor', async () => {
    const newest = checkin('newest');
    mocks.getCheckins.mockResolvedValueOnce(response([newest], true))
      .mockResolvedValueOnce(response([checkin('older')], false));
    const { renderMessagesPage } = await import('./messages');
    const routePage = renderMessagesPage();
    document.body.appendChild(routePage.element);
    routePage.activate?.();
    await flush();
    const thread = routePage.element.querySelector<HTMLElement>('.messages-thread')!;
    Object.defineProperties(thread, {
      scrollTop: { configurable: true, writable: true, value: 0 },
      scrollHeight: {
        configurable: true,
        get: () => 100 + (thread.querySelectorAll('[data-message-id]').length - 1) * 50,
      },
      clientHeight: { configurable: true, value: 80 },
    });

    thread.dispatchEvent(new Event('scroll'));
    await flush();

    expect(thread.querySelector('[data-message-id]')?.getAttribute('data-message-id')).toBe('older');
    expect(thread.scrollTop).toBe(50);
  });

  it('only activates reply on a horizontal swipe past the threshold and resets the bubble on cancel', async () => {
    const routePage = await mount([checkin('first')]);
    const bubble = routePage.element.querySelector<HTMLElement>('.chat-text-bubble')!;

    bubble.dispatchEvent(pointer('pointerdown', 80, 100));
    bubble.dispatchEvent(pointer('pointermove', 83, 170));
    bubble.dispatchEvent(pointer('pointerup', 83, 170));
    expect(routePage.element.querySelector('.messages-reply-preview')?.hasAttribute('hidden')).toBe(true);

    bubble.dispatchEvent(pointer('pointerdown', 80, 100));
    bubble.dispatchEvent(pointer('pointermove', 145, 102));
    bubble.dispatchEvent(pointer('pointercancel', 145, 102));
    expect(bubble.style.transform).toBe('');
    expect(routePage.element.querySelector('.messages-reply-preview')?.hasAttribute('hidden')).toBe(true);

    bubble.dispatchEvent(pointer('pointerdown', 80, 100));
    bubble.dispatchEvent(pointer('pointermove', 145, 102));
    bubble.dispatchEvent(pointer('pointerup', 145, 102));
    expect(routePage.element.querySelector('.messages-reply-preview')?.hasAttribute('hidden')).toBe(false);
    expect(bubble.style.transform).toBe('');
  });

  it('sends replyToMessageId, renders the quoted optimistic bubble, and lets the user cancel a reply', async () => {
    const original = checkin('original');
    const routePage = await mount([original]);
    const replyAction = routePage.element.querySelector<HTMLButtonElement>('.message-reply-action')!;
    replyAction.click();
    expect(routePage.element.querySelector('.messages-reply-preview')?.textContent).toContain('Partner');

    const input = routePage.element.querySelector<HTMLInputElement>('#message-input')!;
    input.value = 'Đúng rồi';
    const sent = checkin('sent', true, 'Đúng rồi');
    sent.replyTo = {
      messageId: 'original', senderId: 'partner', senderName: 'Partner', type: 'text', textSnippet: 'original',
    };
    mocks.createCheckin.mockResolvedValue({ checkIn: sent });
    routePage.element.querySelector<HTMLFormElement>('.messages-composer')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();

    expect(mocks.createCheckin).toHaveBeenCalledWith(expect.objectContaining({ replyToMessageId: 'original' }));
    expect(routePage.element.querySelector('[data-message-id="sent"] .message-quote')).not.toBeNull();
    expect(routePage.element.querySelector('.messages-reply-preview')?.hasAttribute('hidden')).toBe(true);

    replyAction.click();
    routePage.element.querySelector<HTMLButtonElement>('.messages-reply-cancel')?.click();
    expect(routePage.element.querySelector('.messages-reply-preview')?.hasAttribute('hidden')).toBe(true);
  });

  it('scrolls to an already loaded quoted original and cleans polling on destroy', async () => {
    const original = checkin('original');
    const reply = checkin('reply', true, 'reply');
    reply.replyTo = {
      messageId: 'original', senderId: 'partner', senderName: 'Partner', type: 'text', textSnippet: 'original',
    };
    const routePage = await mount([original, reply]);
    const originalElement = routePage.element.querySelector<HTMLElement>('[data-message-id="original"]')!;
    originalElement.scrollIntoView = vi.fn();
    routePage.element.querySelector<HTMLButtonElement>('[data-message-id="reply"] .message-quote')?.click();
    expect(originalElement.scrollIntoView).toHaveBeenCalledOnce();

    routePage.destroy?.();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(mocks.getCheckins).toHaveBeenCalledTimes(1);
  });
});
