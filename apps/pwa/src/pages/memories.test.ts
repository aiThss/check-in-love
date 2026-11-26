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

function makeCheckin(index: number, isOwn: boolean, withReactions = false): CheckIn {
  return {
    id: `m-${index}`,
    userId: isOwn ? 'me' : 'partner',
    coupleId: 'c1',
    type: 'photo',
    photoUrl: `https://example.test/${index}.jpg`,
    caption: `Khoảnh khắc ${index}`,
    reactions: withReactions ? [{ type: '❤️', count: 2, reactedByMe: true }] : [],
    replies: [],
    ownerName: isOwn ? 'Tôi' : 'Người ấy',
    isOwn,
    createdAt: new Date(Date.now() - index * 60_000).toISOString(),
    updatedAt: new Date(Date.now() - index * 60_000).toISOString(),
  };
}

describe('Memories 3-mode instant filter & hidden reaction tray', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
    mocks.getCheckins.mockReset();
    mocks.addReaction.mockReset();
  });

  it('caps DOM tiles across all 3 filter modes, reuses cached tile nodes, removes reply button, and hides reaction tray until reacted', async () => {
    const dataset: CheckIn[] = Array.from({ length: 120 }, (_, i) => makeCheckin(i, i % 2 === 0, i === 0));
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

    const { renderMemoriesPage } = await import('./memories');
    const page = renderMemoriesPage();
    document.body.appendChild(page);
    await new Promise((r) => setTimeout(r, 25));

    const grid = page.querySelector<HTMLElement>('.memory-grid')!;
    expect(grid.querySelectorAll('.memory-tile').length).toBe(20);
    expect(page.querySelector('.reply-button')).toBeNull();

    const firstTile = grid.querySelectorAll<HTMLElement>('.memory-tile')[0]!;
    const secondTile = grid.querySelectorAll<HTMLElement>('.memory-tile')[1]!;
    expect(firstTile.querySelector<HTMLElement>('.c-reaction-tray')?.hidden).toBe(false);
    expect(firstTile.querySelector<HTMLElement>('.c-reaction-tray')?.textContent).toContain('❤️');
    expect(secondTile.querySelector<HTMLElement>('.c-reaction-tray')?.hidden).toBe(true);

    const filterButtons = page.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    expect(filterButtons.length).toBe(3);

    // Rapid consecutive switches: Tất cả -> Người ấy -> Của mình -> Tất cả
    filterButtons[1]?.click();
    expect(grid.querySelectorAll('.memory-tile').length).toBe(20);
    filterButtons[2]?.click();
    expect(grid.querySelectorAll('.memory-tile').length).toBe(20);
    filterButtons[0]?.click();
    expect(grid.querySelectorAll('.memory-tile').length).toBe(20);

    // Cached DOM reuse: first tile node identity is preserved across filter round-trips
    expect(grid.querySelectorAll<HTMLElement>('.memory-tile')[0]).toBe(firstTile);
  });
});
