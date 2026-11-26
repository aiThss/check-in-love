// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CheckIn } from '../api/types';

const mocks = vi.hoisted(() => ({
  getCheckins: vi.fn(),
  addReaction: vi.fn(),
}));

vi.mock('../router', () => ({ navigate: vi.fn() }));
vi.mock('../store/index', () => ({
  store: {
    get: () => ({
      user: { id: 'me', displayName: 'Tôi', partnerName: 'Người ấy' },
      couple: { streak: 10 },
    }),
  },
}));
vi.mock('../api/checkins', () => ({
  getCheckins: mocks.getCheckins,
  addReaction: mocks.addReaction,
}));
vi.mock('../api/messages', () => ({
  createMessage: vi.fn(),
}));
vi.mock('../components/toast', () => ({ showToast: vi.fn() }));
vi.mock('../components/modal', () => ({ showModal: vi.fn(), closeModal: vi.fn() }));

function makeCheckin(index: number, isOwn: boolean, withReactions = false, caption = ''): CheckIn {
  return {
    id: `m-${index}`,
    userId: isOwn ? 'me' : 'partner',
    coupleId: 'c1',
    type: 'photo',
    photoUrl: `https://example.test/${index}.jpg`,
    caption,
    reactions: withReactions ? [{ type: '❤️', count: 2, reactedByMe: true }] : [],
    replies: [],
    ownerName: isOwn ? 'Tôi' : 'Người ấy',
    isOwn,
    createdAt: '2026-11-17T09:08:00.000Z',
    updatedAt: '2026-11-17T09:08:00.000Z',
  };
}

describe('Memories 3-mode instant filter, metadata format & hidden reaction tray', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
    mocks.getCheckins.mockReset();
    mocks.addReaction.mockReset();
  });

  it('formats metadata as username + HH:mm dd/mm, omits Khoảnh khắc chung, caps DOM tiles, and hides reaction tray until reacted', async () => {
    const dataset: CheckIn[] = Array.from({ length: 120 }, (_, i) =>
      makeCheckin(i, i % 2 === 0, i === 0, i === 0 ? 'Đang nhớ người ấy ghê' : ''),
    );
    mocks.getCheckins.mockImplementation((page: number, limit: number) => {
      const start = (page - 1) * limit;
      return Promise.resolve({
        data: dataset.slice(start, start + limit),
        total: dataset.length,
        page,
        limit,
        hasMore: start + limit < dataset.length,
      });
    });

    const { renderMemoriesPage, MEMORIES_POLAROID_DEVELOP_MS, renderMemoriesPolaroidSkeleton } = await import('./memories');
    expect(MEMORIES_POLAROID_DEVELOP_MS).toBe(1500);
    const skel = renderMemoriesPolaroidSkeleton();
    expect(skel.querySelectorAll('.l-polaroid__photo--memories').length).toBe(8);

    const page = renderMemoriesPage();
    document.body.appendChild(page);
    await new Promise((r) => setTimeout(r, 25));

    const grid = page.querySelector<HTMLElement>('.memory-grid')!;
    expect(grid.querySelectorAll('.memory-tile').length).toBe(20);
    expect(page.querySelector('.reply-button')).toBeNull();
    expect(page.textContent).not.toContain('Khoảnh khắc chung');

    const firstTile = grid.querySelectorAll<HTMLElement>('.memory-tile')[0]!;
    const secondTile = grid.querySelectorAll<HTMLElement>('.memory-tile')[1]!;

    // First tile has custom caption + reaction
    expect(firstTile.querySelector('.p-memory-item__owner')?.textContent).toBe('Tôi');
    expect(firstTile.querySelector('.p-memory-item__time')?.textContent).toMatch(/^\d{2}:\d{2} \d{2}\/\d{2}$/);
    expect(firstTile.querySelector('.p-memory-item__caption')?.textContent).toBe('Đang nhớ người ấy ghê');
    expect(firstTile.querySelector<HTMLElement>('.c-reaction-tray')?.hidden).toBe(false);

    // Second tile has NO caption -> no caption element rendered & reaction tray hidden
    expect(secondTile.querySelector('.p-memory-item__owner')?.textContent).toBe('Người ấy');
    expect(secondTile.querySelector('.p-memory-item__time')?.textContent).toMatch(/^\d{2}:\d{2} \d{2}\/\d{2}$/);
    expect(secondTile.querySelector('.p-memory-item__caption')).toBeNull();
    expect(secondTile.querySelector<HTMLElement>('.c-reaction-tray')?.hidden).toBe(true);

    const filterButtons = page.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    filterButtons[1]?.click();
    expect(grid.querySelectorAll('.memory-tile').length).toBe(20);
    filterButtons[2]?.click();
    expect(grid.querySelectorAll('.memory-tile').length).toBe(20);
    filterButtons[0]?.click();
    expect(grid.querySelectorAll('.memory-tile').length).toBe(20);
    expect(grid.querySelectorAll<HTMLElement>('.memory-tile')[0]).toBe(firstTile);
  });
});
