// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderLoveJourneyPage } from './love-journey';

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

  it('renders page header, stats strip, map section, and bucket list', () => {
    const page = renderLoveJourneyPage();
    document.body.appendChild(page);

    expect(page.querySelector('.journey-title')?.textContent).toContain('Bản đồ hẹn hò');
    expect(page.querySelector('#stat-visited-places')).not.toBeNull();
    expect(page.querySelector('#stat-completed-bucket')).not.toBeNull();
    expect(page.querySelector('#stat-progress-percent')).not.toBeNull();

    // Map panel exists with pins
    const pins = page.querySelectorAll('.journey-map-pin');
    expect(pins.length).toBeGreaterThan(5);

    // Bucket list exists with items
    const bucketCards = page.querySelectorAll('.journey-bucket-card');
    expect(bucketCards.length).toBeGreaterThan(5);
  });

  it('toggles a bucket item completion status and updates counter', () => {
    const page = renderLoveJourneyPage();
    document.body.appendChild(page);

    const firstCard = page.querySelector<HTMLElement>('.journey-bucket-card');
    expect(firstCard).not.toBeNull();
    const checkbox = firstCard?.querySelector<HTMLButtonElement>('.journey-checkbox-btn');
    expect(checkbox).not.toBeNull();

    const initialStat = page.querySelector('#stat-completed-bucket')?.textContent;

    // Click checkbox to toggle
    checkbox?.click();

    const afterStat = page.querySelector('#stat-completed-bucket')?.textContent;
    expect(afterStat).not.toEqual(initialStat);
  });

  it('filters bucket items by category pill', () => {
    const page = renderLoveJourneyPage();
    document.body.appendChild(page);

    const datingPill = Array.from(page.querySelectorAll<HTMLButtonElement>('.journey-filter-pill'))
      .find((btn) => btn.textContent?.includes('Hẹn hò'));
    expect(datingPill).toBeDefined();

    datingPill?.click();

    const cards = page.querySelectorAll('.journey-bucket-card');
    expect(cards.length).toBeGreaterThan(0);
    cards.forEach((card) => {
      expect(card.querySelector('.journey-bucket-category')?.textContent).toContain('Hẹn hò');
    });
  });

  it('switches between map and bucket list tabs on mobile', () => {
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
