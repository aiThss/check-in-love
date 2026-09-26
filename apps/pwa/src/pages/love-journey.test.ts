// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  renderLoveJourneyPage,
  PLACES_STORAGE_KEY,
  BUCKET_STORAGE_KEY,
  MIGRATION_SEED_CLEANUP_KEY,
} from './love-journey';

vi.mock('../router', () => ({
  navigate: vi.fn(),
}));

vi.mock('../components/toast', () => ({
  showToast: vi.fn(),
}));

describe('Love Journey and Bucket List Page', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('renders complete empty state for a new user with no seed data', () => {
    const page = renderLoveJourneyPage();
    document.body.appendChild(page);

    // Title and copy check (no "100 Điều ước")
    expect(page.querySelector('.journey-title')?.textContent).toContain('Bản đồ hẹn hò & Điều ước');
    expect(page.textContent).not.toContain('100 Điều ước');

    // Stats are strictly 0 / 0
    const visitedStat = page.querySelector('#stat-visited-places')?.textContent?.replace(/\s+/g, ' ').trim();
    expect(visitedStat).toBe('0 / 0');

    const bucketStat = page.querySelector('#stat-completed-bucket')?.textContent?.replace(/\s+/g, ' ').trim();
    expect(bucketStat).toBe('0 / 0');

    const progressStat = page.querySelector('#stat-progress-percent')?.textContent?.trim();
    expect(progressStat).toBe('0%');

    // No pins on map
    const pins = page.querySelectorAll('.journey-map-pin');
    expect(pins.length).toBe(0);

    // No bucket cards
    const bucketCards = page.querySelectorAll('.journey-bucket-card');
    expect(bucketCards.length).toBe(0);

    // Empty state messages and CTA buttons are rendered
    expect(page.textContent).toContain('Chưa có điểm đến nào');
    expect(page.textContent).toContain('Thêm nơi hai bạn đã đi hoặc đang muốn cùng nhau khám phá.');
    expect(page.querySelector('#btn-empty-add-place')).not.toBeNull();

    expect(page.textContent).toContain('Chưa có điều ước nào');
    expect(page.textContent).toContain('Tạo điều đầu tiên hai bạn muốn cùng nhau thực hiện.');
    expect(page.querySelector('#btn-empty-add-bucket')).not.toBeNull();

    // Absolutely no fake demo text
    expect(page.textContent).not.toContain('Hà Nội');
    expect(page.textContent).not.toContain('Sa Pa');
    expect(page.textContent).not.toContain('Đà Nẵng');
    expect(page.textContent).not.toContain('2024-');
    expect(page.textContent).not.toContain('2025-');
  });

  it('migrates and safely cleans up exact unmodified legacy seed data', () => {
    // Simulate legacy storage containing exact unmodified seed places and bucket
    const legacySeedPlaces = [
      { id: 'sapa', name: 'Sa Pa', region: 'north', x: 34, y: 12, status: 'wishlist', note: 'Săn mây Fansipan và nắm tay nhau giữa sương mù' },
      { id: 'hanoi', name: 'Hà Nội', region: 'north', x: 48, y: 18, status: 'visited', visitedDate: '2024-10-10', note: 'Dạo quanh Hồ Gươm mùa hoa sữa và thưởng thức cà phê trứng' },
    ];
    const legacySeedBucket = [
      { id: 'b1', title: 'Ăn tối lãng mạn dưới ánh nến tại nhà', category: 'dating', completed: true, completedDate: '2024-11-15', note: 'Tự tay nấu mì ý và cắm hoa xinh' },
    ];

    localStorage.setItem(PLACES_STORAGE_KEY, JSON.stringify(legacySeedPlaces));
    localStorage.setItem(BUCKET_STORAGE_KEY, JSON.stringify(legacySeedBucket));

    const page = renderLoveJourneyPage();
    document.body.appendChild(page);

    // Cleaned up to empty array
    expect(localStorage.getItem(PLACES_STORAGE_KEY)).toBe('[]');
    expect(localStorage.getItem(BUCKET_STORAGE_KEY)).toBe('[]');
    expect(localStorage.getItem(MIGRATION_SEED_CLEANUP_KEY)).toBe('true');

    // UI shows empty state
    expect(page.querySelectorAll('.journey-map-pin').length).toBe(0);
    expect(page.querySelectorAll('.journey-bucket-card').length).toBe(0);
    expect(page.textContent).toContain('Chưa có điểm đến nào');
    expect(page.textContent).toContain('Chưa có điều ước nào');
  });

  it('preserves real user data during migration without deleting anything', () => {
    // Real user customized data
    const userPlaces = [
      {
        id: 'user-place-1',
        name: 'Quán Cà Phê Mưa',
        region: 'south',
        x: 50,
        y: 80,
        status: 'visited',
        visitedDate: '2026-05-20',
        note: 'Lần đầu gặp nhau ở đây',
      },
    ];
    const userBucket = [
      {
        id: 'user-bucket-1',
        title: 'Cùng đi ngắm tuyết ở Hokkaido',
        category: 'travel',
        completed: false,
        note: 'Dự định mùa đông tới',
      },
    ];

    localStorage.setItem(PLACES_STORAGE_KEY, JSON.stringify(userPlaces));
    localStorage.setItem(BUCKET_STORAGE_KEY, JSON.stringify(userBucket));

    const page = renderLoveJourneyPage();
    document.body.appendChild(page);

    // Storage and migration key
    expect(localStorage.getItem(MIGRATION_SEED_CLEANUP_KEY)).toBe('true');
    const storedPlaces = JSON.parse(localStorage.getItem(PLACES_STORAGE_KEY) || '[]');
    expect(storedPlaces.length).toBe(1);
    expect(storedPlaces[0].name).toBe('Quán Cà Phê Mưa');

    const storedBucket = JSON.parse(localStorage.getItem(BUCKET_STORAGE_KEY) || '[]');
    expect(storedBucket.length).toBe(1);
    expect(storedBucket[0].title).toBe('Cùng đi ngắm tuyết ở Hokkaido');

    // Rendered on UI
    expect(page.querySelectorAll('.journey-map-pin').length).toBe(1);
    expect(page.textContent).toContain('Quán Cà Phê Mưa');
    expect(page.querySelectorAll('.journey-bucket-card').length).toBe(1);
    expect(page.textContent).toContain('Cùng đi ngắm tuyết ở Hokkaido');
  });

  it('adds a new place through modal and renders it on the map', () => {
    const page = renderLoveJourneyPage();
    document.body.appendChild(page);

    // Click add place button
    page.querySelector<HTMLButtonElement>('#btn-add-place')?.click();

    const modal = document.querySelector<HTMLElement>('.journey-modal-backdrop');
    expect(modal).not.toBeNull();

    const nameInput = modal?.querySelector<HTMLInputElement>('#add-place-name');
    if (nameInput) nameInput.value = 'Hồ Tây Chiều Thu';

    const noteInput = modal?.querySelector<HTMLTextAreaElement>('#add-place-note');
    if (noteInput) noteInput.value = 'Ngắm hoàng hôn và ăn kem';

    const form = modal?.querySelector<HTMLFormElement>('#add-place-form');
    form?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

    // Pin is rendered
    expect(page.querySelectorAll('.journey-map-pin').length).toBe(1);
    expect(page.textContent).toContain('Hồ Tây Chiều Thu');

    // Stats updated
    const visitedStat = page.querySelector('#stat-visited-places')?.textContent?.replace(/\s+/g, ' ').trim();
    expect(visitedStat).toBe('0 / 1');
  });

  it('adds a new bucket item, toggles completed, and updates stats', () => {
    const page = renderLoveJourneyPage();
    document.body.appendChild(page);

    // Click add bucket button
    page.querySelector<HTMLButtonElement>('#btn-add-bucket')?.click();

    const modal = document.querySelector<HTMLElement>('.journey-modal-backdrop');
    expect(modal).not.toBeNull();

    const titleInput = modal?.querySelector<HTMLInputElement>('#add-bucket-title');
    if (titleInput) titleInput.value = 'Làm bánh pizza tại nhà';

    const form = modal?.querySelector<HTMLFormElement>('#add-bucket-form');
    form?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

    // Card rendered
    const card = page.querySelector<HTMLElement>('.journey-bucket-card');
    expect(card).not.toBeNull();
    expect(card?.textContent).toContain('Làm bánh pizza tại nhà');

    // Stat is 0 / 1 (0%)
    let bucketStat = page.querySelector('#stat-completed-bucket')?.textContent?.replace(/\s+/g, ' ').trim();
    expect(bucketStat).toBe('0 / 1');
    expect(page.querySelector('#stat-progress-percent')?.textContent?.trim()).toBe('0%');

    // Toggle complete
    const checkBtn = card?.querySelector<HTMLButtonElement>('.journey-checkbox-btn');
    checkBtn?.click();

    // Now 1 / 1 (100%)
    bucketStat = page.querySelector('#stat-completed-bucket')?.textContent?.replace(/\s+/g, ' ').trim();
    expect(bucketStat).toBe('1 / 1');
    expect(page.querySelector('#stat-progress-percent')?.textContent?.trim()).toBe('100%');

    // Toggle back to incomplete
    const reloadedCard = page.querySelector<HTMLElement>('.journey-bucket-card');
    reloadedCard?.querySelector<HTMLButtonElement>('.journey-checkbox-btn')?.click();

    bucketStat = page.querySelector('#stat-completed-bucket')?.textContent?.replace(/\s+/g, ' ').trim();
    expect(bucketStat).toBe('0 / 1');
    expect(page.querySelector('#stat-progress-percent')?.textContent?.trim()).toBe('0%');
  });

  it('filters bucket items by category pill', () => {
    localStorage.setItem(
      BUCKET_STORAGE_KEY,
      JSON.stringify([
        { id: '1', title: 'Hẹn hò xem kịch', category: 'dating', completed: false },
        { id: '2', title: 'Đi leo núi Fansipan', category: 'travel', completed: false },
      ]),
    );
    localStorage.setItem(MIGRATION_SEED_CLEANUP_KEY, 'true');

    const page = renderLoveJourneyPage();
    document.body.appendChild(page);

    expect(page.querySelectorAll('.journey-bucket-card').length).toBe(2);

    const travelPill = Array.from(page.querySelectorAll<HTMLButtonElement>('.journey-filter-pill'))
      .find((btn) => btn.textContent?.includes('Du lịch'));
    travelPill?.click();

    const filteredCards = page.querySelectorAll('.journey-bucket-card');
    expect(filteredCards.length).toBe(1);
    expect(filteredCards[0].textContent).toContain('Đi leo núi Fansipan');
  });

  it('safely handles corrupted or invalid data without crashing', () => {
    localStorage.setItem(PLACES_STORAGE_KEY, '{invalid json');
    localStorage.setItem(BUCKET_STORAGE_KEY, '[null, 123, {"invalid":"shape"}]');
    localStorage.setItem(MIGRATION_SEED_CLEANUP_KEY, 'true');

    expect(() => {
      const page = renderLoveJourneyPage();
      document.body.appendChild(page);
    }).not.toThrow();

    const page = document.querySelector<HTMLElement>('.journey-page');
    expect(page).not.toBeNull();
    expect(page?.querySelectorAll('.journey-map-pin').length).toBe(0);
    expect(page?.querySelectorAll('.journey-bucket-card').length).toBe(0);
  });

  it('switches between map and bucket tabs on mobile', () => {
    const page = renderLoveJourneyPage();
    document.body.appendChild(page);

    const tabBtns = page.querySelectorAll<HTMLButtonElement>('.journey-tab-btn');
    expect(tabBtns.length).toBe(2);

    const bucketTab = tabBtns[1];
    bucketTab.click();

    expect(bucketTab.classList.contains('active')).toBe(true);
    expect(tabBtns[0].classList.contains('active')).toBe(false);
  });
});
