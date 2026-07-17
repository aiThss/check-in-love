// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CheckIn, CheckInReply, Reaction } from '../api/types';

const mocks = vi.hoisted(() => ({
  getLatestPartnerCheckin: vi.fn(),
  getCachedLatestPartnerCheckin: vi.fn(),
  getCheckins: vi.fn(),
  addReaction: vi.fn(),
  addReply: vi.fn(),
  showModal: vi.fn(),
}));

vi.mock('../router', () => ({ navigate: vi.fn() }));
vi.mock('../store/index', () => ({
  store: {
    get: () => ({
      theme: 'light',
      user: { id: 'me', partnerName: 'Bạn ấy' },
      couple: { streak: 4, loveStartDate: '2024-01-01' },
    }),
    isAuthenticated: () => true,
    set: vi.fn(),
  },
  applyTheme: vi.fn(),
}));
vi.mock('../api/checkins', () => ({
  getLatestPartnerCheckin: mocks.getLatestPartnerCheckin,
  getCachedLatestPartnerCheckin: mocks.getCachedLatestPartnerCheckin,
  getCheckins: mocks.getCheckins,
  addReaction: mocks.addReaction,
  addReply: mocks.addReply,
}));
vi.mock('../api/push', () => ({
  ensurePushSubscription: vi.fn(),
  getPushSetupState: vi.fn().mockResolvedValue({ status: 'subscribed' }),
}));
vi.mock('../components/modal', () => ({ showModal: mocks.showModal }));
vi.mock('../components/toast', () => ({ showToast: vi.fn() }));
vi.mock('../components/reaction-picker', () => ({
  openReactionPicker: vi.fn(),
  reactionPillsHtml: () => '',
}));

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const cachedCheckin: CheckIn = {
  id: 'checkin-1',
  userId: 'partner',
  coupleId: 'couple',
  type: 'photo',
  photoUrl: 'https://example.test/photo.jpg',
  caption: 'hello',
  reactions: [],
  replies: [],
  ownerName: 'Bạn ấy',
  isOwn: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('Home interaction patches', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
    mocks.getCachedLatestPartnerCheckin.mockReturnValue({ ...cachedCheckin, reactions: [], replies: [] });
    mocks.getLatestPartnerCheckin.mockResolvedValue({ ...cachedCheckin, reactions: [], replies: [] });
    mocks.getCheckins.mockResolvedValue({ data: [], total: 0, page: 1, limit: 12, hasMore: false });
    mocks.addReaction.mockReset();
    mocks.addReply.mockReset();
    mocks.showModal.mockReset();
  });

  it('keeps cached content during revalidation and patches only reaction and reply slots', async () => {
    let resolveReaction: ((reactions: Reaction[]) => void) | undefined;
    mocks.addReaction.mockImplementation(() => new Promise<Reaction[]>((resolve) => { resolveReaction = resolve; }));
    const replies: CheckInReply[] = [{
      userId: 'me', userName: 'Me', message: 'Reply', isOwn: true, createdAt: new Date().toISOString(),
    }];
    mocks.addReply.mockResolvedValue(replies);

    const { renderHomePage } = await import('./home');
    const page = renderHomePage();
    document.body.appendChild(page);
    await flush();

    const card = page.querySelector<HTMLElement>('.checkin-card');
    const image = page.querySelector<HTMLImageElement>('.checkin-card-image');
    expect(card).not.toBeNull();
    expect(image).not.toBeNull();
    expect(page.querySelector('.skeleton')).toBeNull();

    const reactionButton = page.querySelector<HTMLButtonElement>('.reaction-option[data-type="❤️"]');
    reactionButton?.click();
    reactionButton?.click();
    expect(mocks.addReaction).toHaveBeenCalledTimes(1);
    expect(page.querySelector('.checkin-card-image')).toBe(image);

    resolveReaction?.([{ type: '❤️', count: 1, reactedByMe: true }]);
    await flush();
    expect(page.querySelector('.checkin-card')).toBe(card);
    expect(page.querySelector('.checkin-card-image')).toBe(image);

    page.querySelector<HTMLButtonElement>('.reply-button')?.click();
    const options = mocks.showModal.mock.calls[0]?.[0] as {
      content: HTMLElement;
      onConfirm: () => Promise<void>;
    };
    const textarea = options.content.querySelector<HTMLTextAreaElement>('textarea');
    if (textarea) textarea.value = 'Reply';
    await options.onConfirm();

    expect(mocks.addReply).toHaveBeenCalledTimes(1);
    expect(page.querySelector('.checkin-card')).toBe(card);
    expect(page.querySelector('.checkin-card-image')).toBe(image);
    expect(page.querySelector('.reply-preview-list')).not.toBeNull();

    page.querySelector<HTMLButtonElement>('[aria-label="Làm mới"]')?.click();
    await flush();
    expect(page.querySelector('.checkin-card')).toBe(card);
    expect(page.querySelector('.checkin-card-image')).toBe(image);
    expect(page.querySelector('.skeleton')).toBeNull();
  });
});
