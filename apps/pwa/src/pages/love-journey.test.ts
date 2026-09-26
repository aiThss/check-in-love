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

  it('renders stored place content as text instead of markup', () => {
    localStorage.setItem(
      'lovecheck_journey_places',
      JSON.stringify([
        {
          id: 'unsafe-place',
          name: '<img src=x onerror=alert(1)>',
          region: 'north',
          x: 40,
          y: 20,
          status: 'wishlist',
          note: '<strong>private note</strong>',
        },
      ]),
    );

    const page = renderLoveJourneyPage();
    document.body.appendChild(page);

    expect(page.querySelector('.journey-place-detail-title')?.textContent).toContain(
      '<img src=x onerror=alert(1)>',
    );
    expect(page.querySelector('.journey-place-detail-note')?.textContent?.trim()).toBe(
      '<strong>private note</strong>',
    );
    expect(page.querySelector('.journey-place-detail-title img')).toBeNull();
    expect(page.querySelector('.journey-place-detail-note strong')).toBeNull();
  });

  it('clears the visited date when a place returns to the wishlist', () => {
    localStorage.setItem(
      'lovecheck_journey_places',
      JSON.stringify([
        {
          id: 'visited-place',
          name: 'Hà Nội',
          region: 'north',
          x: 40,
          y: 20,
          status: 'visited',
          visitedDate: '2025-01-01',
        },
      ]),
    );

    const page = renderLoveJourneyPage();
    document.body.appendChild(page);
    page.querySelector<HTMLButtonElement>('#btn-toggle-place-status')?.click();

    expect(page.textContent).not.toContain('Ngày ghé thăm:');
    const storedPlace = JSON.parse(
      localStorage.getItem('lovecheck_journey_places') || '[]',
    )[0];
    expect(storedPlace.status).toBe('wishlist');
    expect(storedPlace).not.toHaveProperty('visitedDate');
  });
});
