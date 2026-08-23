// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../api/types';

const mocks = vi.hoisted(() => ({
  getMessages: vi.fn(),
  createMessage: vi.fn(),
  createCheckin: vi.fn(),
  getMessageContext: vi.fn(),
  showToast: vi.fn(),
  navigate: vi.fn(),
  processImage: vi.fn(),
  revokePreviewUrl: vi.fn(),
  openPolaroidCoverModal: vi.fn(),
  openMessageImageViewer: vi.fn(),
}));

vi.mock('../components/polaroid-cover', () => ({
  openPolaroidCoverModal: mocks.openPolaroidCoverModal,
}));
vi.mock('../components/message-image-viewer', () => ({
  openMessageImageViewer: mocks.openMessageImageViewer,
}));
vi.mock('../api/messages', () => ({
  getMessages: mocks.getMessages,
  createMessage: mocks.createMessage,
  getMessageContext: mocks.getMessageContext,
}));
vi.mock('../api/checkins', () => ({ createCheckin: mocks.createCheckin }));
vi.mock('../components/camera', () => ({
  openCamera: vi.fn(),
  processImage: mocks.processImage,
  revokePreviewUrl: mocks.revokePreviewUrl,
}));
vi.mock('../components/toast', () => ({ showToast: mocks.showToast }));
vi.mock('../router', () => ({
  navigate: mocks.navigate,
  openHistoryLayer: vi.fn().mockReturnValue('wallpaper-test-layer'),
  closeHistoryLayer: vi.fn(),
}));
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

function message(id: string, own = false, text = id): ChatMessage {
  return {
    id,
    senderId: own ? 'me' : 'partner',
    coupleId: 'couple',
    type: 'text',
    text,
    senderName: own ? 'Me' : 'Partner',
    isOwn: own,
    createdAt: `2026-07-17T10:0${id.length}:00.000Z`,
    updatedAt: `2026-07-17T10:0${id.length}:00.000Z`,
  };
}

function response(data: ChatMessage[], hasMore = false) {
  return { data, hasMore, beforeCursor: data[0]?.id ?? null, afterCursor: data.at(-1)?.id ?? null };
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
    mocks.getMessages.mockReset();
    mocks.createMessage.mockReset();
    mocks.createCheckin.mockReset();
    mocks.getMessageContext.mockReset();
    mocks.showToast.mockReset();
    mocks.navigate.mockReset();
    mocks.processImage.mockReset();
    mocks.revokePreviewUrl.mockReset();
    mocks.openMessageImageViewer.mockReset();
  });

  afterEach(() => vi.useRealTimers());

  it('shows the date and year for messages from another day', async () => {
    const { formatMessageTime } = await import('./messages');
    const now = new Date('2026-08-08T08:00:00.000Z');

    expect(formatMessageTime('2026-08-08T07:25:00.000Z', now)).toMatch(/14:25$/);
    expect(formatMessageTime('2026-08-07T07:25:00.000Z', now)).toMatch(/07\/08\/2026 14:25$/);
  });

  it('keeps a compact couple-only header and exposes the chat options menu', async () => {
    const routePage = await mount([]);

    expect(routePage.element.querySelector('.messages-eyebrow')?.textContent).toBe('Hai đứa mình');
    expect(routePage.element.querySelector('h1')).toBeNull();
    expect(routePage.element.querySelector('.messages-refresh-button')).toBeNull();

    const menu = routePage.element.querySelector<HTMLElement>('.messages-header-menu')!;
    const menuButton = routePage.element.querySelector<HTMLButtonElement>('.messages-menu-button')!;
    expect(menu.hidden).toBe(true);
    menuButton.click();
    expect(menu.hidden).toBe(false);
    expect(menu.textContent).toContain('Đổi nền chat');
  });

  it('renders a stable two-column wallpaper list with bundled photo previews', async () => {
    const routePage = await mount([]);
    routePage.element.querySelector<HTMLButtonElement>('.messages-menu-button')?.click();
    routePage.element.querySelector<HTMLButtonElement>('[data-messages-action="background"]')?.click();

    const options = document.querySelectorAll<HTMLButtonElement>('.messages-wallpaper-option');
    expect(options).toHaveLength(6);
    expect(options[0].style.backgroundImage).toContain('linear-gradient');
    expect(options[1].style.backgroundImage).toContain('rose-bloom.jpg');
    expect(options[2].style.backgroundImage).toContain('sunset-ocean.jpg');
    expect(options[0].style.getPropertyValue('--wallpaper-preview')).toBe('');
  });

  it('restores a selected wallpaper from local device storage', async () => {
    localStorage.setItem(
      'lovecheck_chat_background_v1',
      JSON.stringify({ kind: 'preset', id: 'sunset-horizon' }),
    );

    const routePage = await mount([]);
    expect(routePage.element.dataset.chatBackground).toBe('sunset-horizon');
    expect(routePage.element.classList.contains('has-chat-wallpaper')).toBe(true);
    expect(routePage.element.querySelector<HTMLElement>('.messages-wallpaper-layer')?.style.backgroundImage)
      .toContain('sunset-ocean.jpg');
  });

  it('refreshes immediately from realtime events and when Android resumes the WebView', async () => {
    const first = message('first');
    const incoming = message('incoming');
    const routePage = await mount([first]);

    mocks.getMessages.mockResolvedValue(response([first, incoming]));
    const callsBeforeRealtime = mocks.getMessages.mock.calls.length;
    window.dispatchEvent(new CustomEvent('lovecheck:realtime-event', {
      detail: { type: 'message', messageId: incoming.id },
    }));
    await flush();

    expect(routePage.element.querySelector('[data-message-id="incoming"]')).not.toBeNull();
    const callsAfterRealtime = mocks.getMessages.mock.calls.length;
    expect(callsAfterRealtime).toBeGreaterThan(callsBeforeRealtime);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    mocks.getMessages.mockResolvedValue(response([first, incoming, message('resumed')]));
    document.dispatchEvent(new Event('visibilitychange'));
    await flush();

    expect(routePage.element.querySelector('[data-message-id="resumed"]')).not.toBeNull();
    expect(mocks.getMessages.mock.calls.length).toBeGreaterThan(callsAfterRealtime);
  });

  async function mount(data: ChatMessage[], hasMore = false) {
    mocks.getMessages.mockResolvedValue(response(data, hasMore));
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
    const first = message('first');
    const routePage = await mount([first]);
    const thread = routePage.element.querySelector<HTMLElement>('.messages-thread')!;
    const original = thread.querySelector<HTMLElement>('[data-message-id="first"]')!;
    setScrollMetrics(thread, 0);
    thread.dispatchEvent(new Event('scroll'));

    const incoming = message('incoming');
    mocks.getMessages.mockResolvedValue(response([first, incoming]));
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
    const first = message('first');
    const routePage = await mount([first]);
    const thread = routePage.element.querySelector<HTMLElement>('.messages-thread')!;
    setScrollMetrics(thread, 760);
    thread.dispatchEvent(new Event('scroll'));
    mocks.getMessages.mockResolvedValue(response([first, message('incoming')]));

    await vi.advanceTimersByTimeAsync(10_000);
    expect(thread.scrollTop).toBe(1000);

    thread.scrollTop = 321;
    routePage.deactivate?.();
    routePage.activate?.();
    await flush();
    expect(thread.scrollTop).toBe(321);
  });

  it('shows the read receipt only on the latest own message read by the partner', async () => {
    const olderRead = message('older-read', true);
    olderRead.readBy = ['me', 'partner'];
    const newerUnread = message('newer-unread', true);
    newerUnread.readBy = ['me'];
    const routePage = await mount([olderRead, newerUnread]);

    expect(routePage.element.querySelector('[data-message-id="older-read"] .message-read-status')?.textContent)
      .toBe('Đã đọc');
    expect(routePage.element.querySelector('[data-message-id="newer-unread"] .message-read-status')?.textContent)
      .toBe('');
    expect(routePage.element.querySelector('[data-message-id="newer-unread"] .message-read-status')?.hasAttribute('hidden'))
      .toBe(true);
  });

  it('prepends older messages without moving the reader away from the visible anchor', async () => {
    const newest = message('newest');
    mocks.getMessages.mockResolvedValueOnce(response([newest], true))
      .mockResolvedValueOnce(response([message('older')], false));
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
    const routePage = await mount([message('first')]);
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
    const original = message('original');
    const routePage = await mount([original]);
    const bubble = routePage.element.querySelector<HTMLElement>('.chat-text-bubble')!;
    expect(routePage.element.querySelector('.message-reply-action')).toBeNull();
    bubble.dispatchEvent(pointer('pointerdown', 80, 100));
    bubble.dispatchEvent(pointer('pointermove', 145, 102));
    bubble.dispatchEvent(pointer('pointerup', 145, 102));
    expect(routePage.element.querySelector('.messages-reply-preview')?.textContent).toContain('Partner');

    const input = routePage.element.querySelector<HTMLInputElement>('#message-input')!;
    input.value = 'Đúng rồi';
    const sent = message('sent', true, 'Đúng rồi');
    sent.replyTo = {
      messageId: 'original', senderId: 'partner', senderName: 'Partner', type: 'text', textSnippet: 'original',
    };
    mocks.createMessage.mockResolvedValue(sent);
    routePage.element.querySelector<HTMLFormElement>('.messages-composer')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();

    expect(mocks.createMessage).toHaveBeenCalledWith(expect.objectContaining({ replyToMessageId: 'original' }));
    expect(routePage.element.querySelector('[data-message-id="sent"] .message-quote')).not.toBeNull();
    expect(routePage.element.querySelector('.messages-reply-preview')?.hasAttribute('hidden')).toBe(true);

    bubble.dispatchEvent(pointer('pointerdown', 80, 100));
    bubble.dispatchEvent(pointer('pointermove', 145, 102));
    bubble.dispatchEvent(pointer('pointerup', 145, 102));
    routePage.element.querySelector<HTMLButtonElement>('.messages-reply-cancel')?.click();
    expect(routePage.element.querySelector('.messages-reply-preview')?.hasAttribute('hidden')).toBe(true);
  });

  it('shows edit and recall actions separately from reactions on own messages', async () => {
    const routePage = await mount([message('own-message', true, 'Tin nhắn của mình')]);
    const bubble = routePage.element.querySelector<HTMLElement>('.chat-text-bubble')!;

    bubble.dispatchEvent(pointer('pointerdown', 80, 100));
    await vi.advanceTimersByTimeAsync(600);

    const picker = routePage.element.querySelector('.message-reaction-picker')!;
    expect(picker.querySelector('.message-reaction-options')).not.toBeNull();
    expect(picker.querySelector('.message-action-row')?.textContent).toContain('Sửa');
    expect(picker.querySelector('.message-action-row')?.textContent).toContain('Thu hồi');

    bubble.dispatchEvent(pointer('pointerup', 80, 100));
    bubble.click();
    expect(routePage.element.querySelector('.message-reaction-picker')).not.toBeNull();
  });

  it('shows an edited tag and reveals the previous text history on demand', async () => {
    const edited = message('edited', true, 'Phiên bản hiện tại');
    edited.editedAt = '2026-08-20T10:05:00.000Z';
    edited.editHistory = [{ text: 'Phiên bản trước', editedAt: '2026-08-20T10:00:00.000Z' }];
    const routePage = await mount([edited]);

    const tag = routePage.element.querySelector<HTMLButtonElement>('.message-edited-tag')!;
    const history = routePage.element.querySelector<HTMLElement>('.message-edit-history')!;
    expect(tag.hidden).toBe(false);
    expect(history.hidden).toBe(true);

    tag.click();
    expect(history.hidden).toBe(false);
    expect(history.textContent).toContain('Lịch sử chỉnh sửa');
    expect(history.textContent).toContain('Phiên bản trước');
    expect(history.textContent).toContain('Ẩn lịch sử chỉnh sửa');
  });

  it('renders a thumbnail when replying to an image message', async () => {
    const photo = message('photo', false);
    photo.type = 'image';
    photo.imageUrl = '/uploads/photo.jpg';
    const reply = message('reply', true, 'Xem này');
    reply.replyTo = {
      messageId: photo.id,
      senderId: photo.senderId,
      senderName: photo.senderName,
      type: 'image',
      mediaUrl: photo.imageUrl,
    };
    const routePage = await mount([photo, reply]);

    const thumbnail = routePage.element.querySelector<HTMLImageElement>('[data-message-id="reply"] .message-quote-thumb');
    expect(thumbnail?.getAttribute('src')).toBe('/uploads/photo.jpg');
    expect(thumbnail?.getAttribute('alt')).toBe('Ảnh được trả lời');
  });

  it('opens the full-size viewer when a message photo is clicked', async () => {
    const photo = message('photo', false);
    photo.type = 'image';
    photo.imageUrl = '/uploads/photo.jpg';
    const routePage = await mount([photo]);
    routePage.element.querySelector<HTMLImageElement>('[data-message-id="photo"] .chat-bubble.has-photo > img')?.click();

    expect(mocks.openMessageImageViewer).toHaveBeenCalledWith('/uploads/photo.jpg', 'photo');
  });

  it('scrolls to an already loaded quoted original and cleans polling on destroy', async () => {
    const original = message('original');
    const reply = message('reply', true, 'reply');
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
    expect(mocks.getMessages).toHaveBeenCalledTimes(1);
  });

  it('renders a referenced memory card and scrolls to chat photo when it is selected', async () => {
    const photoMsg = message('photo-msg');
    photoMsg.type = 'image';
    photoMsg.imageUrl = '/photo.jpg';

    const shared = message('shared');
    shared.referencedCheckin = {
      checkinId: 'memory-1', ownerId: 'partner', ownerName: 'Partner', type: 'photo', caption: 'Ngày đầu tiên', imageUrl: '/photo.jpg', createdAt: shared.createdAt,
    };
    const routePage = await mount([photoMsg, shared]);
    const photoElement = routePage.element.querySelector<HTMLElement>('[data-message-id="photo-msg"]')!;
    photoElement.scrollIntoView = vi.fn();

    const card = routePage.element.querySelector<HTMLButtonElement>('.message-referenced-checkin')!;
    expect(card.textContent).toContain('Kỷ niệm');
    expect(card.querySelector('img')?.getAttribute('src')).toBe('/photo.jpg');
    card.click();
    expect(photoElement.scrollIntoView).toHaveBeenCalledOnce();
  });

  it('sends a chat photo through CheckIn so the returned topic appears in both domains', async () => {
    const routePage = await mount([]);
    const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
    mocks.processImage.mockResolvedValue({ file, preview: 'blob:photo' });
    const photoInput = routePage.element.querySelector<HTMLInputElement>('#message-photo')!;
    Object.defineProperty(photoInput, 'files', { configurable: true, value: [file] });
    photoInput.dispatchEvent(new Event('change'));
    await flush();
    expect(mocks.processImage).toHaveBeenCalledWith(file, { maxSize: 1600, quality: 0.85 });

    const sent = {
      ...message('photo-topic', true, 'Đi chơi nhé'),
      type: 'image' as const,
      imageUrl: '/uploads/photo.jpg',
      referencedCheckin: {
        checkinId: 'checkin-photo', ownerId: 'me', ownerName: 'Me', type: 'photo' as const, imageUrl: '/uploads/photo.jpg', createdAt: '2026-07-17T10:00:00.000Z',
      },
    };
    mocks.createCheckin.mockResolvedValue({ checkIn: {}, chatMessage: sent });
    routePage.element.querySelector<HTMLInputElement>('#message-input')!.value = 'Đi chơi nhé';
    routePage.element.querySelector<HTMLFormElement>('.messages-composer')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flush();

    const payload = mocks.createCheckin.mock.calls[0][0] as FormData;
    expect(payload.get('type')).toBe('photo');
    expect(payload.get('caption')).toBe('Đi chơi nhé');
    expect(routePage.element.querySelector('[data-message-id="photo-topic"] img')?.getAttribute('src')).toBe('/uploads/photo.jpg');
  });
});
