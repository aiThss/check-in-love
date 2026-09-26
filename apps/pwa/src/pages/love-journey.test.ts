// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  renderLoveJourneyPage,
  PLACES_STORAGE_KEY,
  BUCKET_STORAGE_KEY,
  MIGRATION_SEED_CLEANUP_KEY,
  OPENFREEMAP_LIBERTY_STYLE,
  OPENFREEMAP_DARK_STYLE,
} from './love-journey';

vi.mock('../router', () => ({
  navigate: vi.fn(),
}));

vi.mock('../components/toast', () => ({
  showToast: vi.fn(),
}));

type MapEventHandler = (...args: any[]) => void;

vi.mock('maplibre-gl', () => {
  class MockMap {
    public _handlers: Record<string, MapEventHandler[]> = {};
    public _container: HTMLElement;
    public _sources: Record<string, any> = {};
    public _layers: Record<string, any> = {};

    constructor(options: any) {
      this._container = typeof options.container === 'string'
        ? (document.getElementById(options.container) || document.createElement('div'))
        : (options.container || document.createElement('div'));

      // Trigger load event immediately in next microtask
      queueMicrotask(() => {
        this._trigger('load');
      });
    }

    on(event: string, handler: MapEventHandler) {
      this._handlers[event] = this._handlers[event] || [];
      this._handlers[event].push(handler);
      return this;
    }

    once(event: string, handler: MapEventHandler) {
      const wrapped = (...args: any[]) => {
        this.off(event, wrapped);
        handler(...args);
      };
      return this.on(event, wrapped);
    }

    off(event: string, handler: MapEventHandler) {
      if (this._handlers[event]) {
        this._handlers[event] = this._handlers[event].filter((h) => h !== handler);
      }
      return this;
    }

    _trigger(event: string, data?: any) {
      (this._handlers[event] || []).forEach((h) => h(data));
    }

    remove() {
      this._handlers = {};
      this._sources = {};
      this._layers = {};
    }

    addControl() { return this; }
    setStyle() {
      this._sources = {};
      this._layers = {};
      queueMicrotask(() => {
        this._trigger('style.load');
      });
      return this;
    }
    getSource(id: string) {
      if (!this._sources[id]) return undefined;
      return {
        setData: (data: any) => {
          this._sources[id].data = data;
        },
      };
    }
    addSource(id: string, source: any) {
      this._sources[id] = source;
      return this;
    }
    addLayer(layer: any) {
      this._layers[layer.id] = layer;
      return this;
    }
    removeLayer(id: string) {
      delete this._layers[id];
      return this;
    }
    removeSource(id: string) {
      delete this._sources[id];
      return this;
    }
    easeTo() { return this; }
    fitBounds() { return this; }
    getZoom() { return 6; }
    setZoom() { return this; }
    zoomIn() { return this; }
    zoomOut() { return this; }
    getCenter() { return { lng: 106.8, lat: 16.2 }; }
    setCenter() { return this; }
    resize() { return this; }
  }

  class MockMarker {
    private _element: HTMLElement;
    private _lngLat: [number, number] = [0, 0];

    constructor(options?: any) {
      this._element = options?.element || document.createElement('div');
    }

    setLngLat(lngLat: [number, number]) {
      this._lngLat = lngLat;
      return this;
    }

    addTo(map: any) {
      const target = map?._container || document.getElementById('journey-map-container') || document.body;
      if (!this._element.parentNode) {
        target.appendChild(this._element);
      }
      return this;
    }

    remove() {
      this._element.remove();
      return this;
    }

    getElement() {
      return this._element;
    }
  }

  class MockNavigationControl {}

  class MockLngLatBounds {
    extend() { return this; }
  }

  return {
    Map: MockMap,
    Marker: MockMarker,
    NavigationControl: MockNavigationControl,
    LngLatBounds: MockLngLatBounds,
    supported: () => true,
    default: {
      Map: MockMap,
      Marker: MockMarker,
      NavigationControl: MockNavigationControl,
      LngLatBounds: MockLngLatBounds,
      supported: () => true,
    },
  };
});

describe('Love Journey and Bucket List Page', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  it('renders complete empty state for a new user with no seed data', () => {
    const page = renderLoveJourneyPage();
    document.body.appendChild(page);

    // Title and copy check
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
    expect(page.textContent).toContain('Lưu nơi đầu tiên hai bạn đã cùng nhau ghé qua.');
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

    expect(localStorage.getItem(MIGRATION_SEED_CLEANUP_KEY)).toBe('true');
    const storedPlaces = JSON.parse(localStorage.getItem(PLACES_STORAGE_KEY) || '[]');
    expect(storedPlaces.length).toBe(1);
    expect(storedPlaces[0].name).toBe('Quán Cà Phê Mưa');
    // Ensure latitude and longitude were populated by migration
    expect(typeof storedPlaces[0].latitude).toBe('number');
    expect(typeof storedPlaces[0].longitude).toBe('number');

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

  it('toggles place status between visited and wishlist', () => {
    localStorage.setItem(
      PLACES_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'p-1',
          name: 'Đà Lạt Mộng Mơ',
          latitude: 11.9404,
          longitude: 108.4583,
          region: 'central',
          status: 'wishlist',
          note: 'Muốn cùng đi ngắm mai anh đào',
        },
      ]),
    );
    localStorage.setItem(MIGRATION_SEED_CLEANUP_KEY, 'true');

    const page = renderLoveJourneyPage();
    document.body.appendChild(page);

    let visitedStat = page.querySelector('#stat-visited-places')?.textContent?.replace(/\s+/g, ' ').trim();
    expect(visitedStat).toBe('0 / 1');

    const toggleBtn = page.querySelector<HTMLButtonElement>('#btn-toggle-place-status');
    expect(toggleBtn).not.toBeNull();
    toggleBtn?.click();

    visitedStat = page.querySelector('#stat-visited-places')?.textContent?.replace(/\s+/g, ' ').trim();
    expect(visitedStat).toBe('1 / 1');

    const stored = JSON.parse(localStorage.getItem(PLACES_STORAGE_KEY) || '[]');
    expect(stored[0].status).toBe('visited');
    expect(stored[0].visitedDate).toBeDefined();
  });

  it('edits and deletes a place', () => {
    localStorage.setItem(
      PLACES_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'p-delete',
          name: 'Điểm Cần Xóa',
          latitude: 10.0,
          longitude: 105.0,
          region: 'south',
          status: 'wishlist',
        },
      ]),
    );
    localStorage.setItem(MIGRATION_SEED_CLEANUP_KEY, 'true');

    const page = renderLoveJourneyPage();
    document.body.appendChild(page);

    expect(page.querySelectorAll('.journey-map-pin').length).toBe(1);

    page.querySelector<HTMLButtonElement>('#btn-edit-place-note')?.click();

    const modal = document.querySelector<HTMLElement>('.journey-modal-backdrop');
    expect(modal).not.toBeNull();

    modal?.querySelector<HTMLButtonElement>('#btn-delete-place')?.click();

    expect(page.querySelectorAll('.journey-map-pin').length).toBe(0);
    expect(page.textContent).toContain('Chưa có điểm đến nào');
  });

  it('adds a new bucket item, toggles completed, and updates stats', () => {
    const page = renderLoveJourneyPage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>('#btn-add-bucket')?.click();

    const modal = document.querySelector<HTMLElement>('.journey-modal-backdrop');
    expect(modal).not.toBeNull();

    const titleInput = modal?.querySelector<HTMLInputElement>('#add-bucket-title');
    if (titleInput) titleInput.value = 'Làm bánh pizza tại nhà';

    const form = modal?.querySelector<HTMLFormElement>('#add-bucket-form');
    form?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));

    const card = page.querySelector<HTMLElement>('.journey-bucket-card');
    expect(card).not.toBeNull();
    expect(card?.textContent).toContain('Làm bánh pizza tại nhà');

    let bucketStat = page.querySelector('#stat-completed-bucket')?.textContent?.replace(/\s+/g, ' ').trim();
    expect(bucketStat).toBe('0 / 1');
    expect(page.querySelector('#stat-progress-percent')?.textContent?.trim()).toBe('0%');

    const checkBtn = card?.querySelector<HTMLButtonElement>('.journey-checkbox-btn');
    checkBtn?.click();

    bucketStat = page.querySelector('#stat-completed-bucket')?.textContent?.replace(/\s+/g, ' ').trim();
    expect(bucketStat).toBe('1 / 1');
    expect(page.querySelector('#stat-progress-percent')?.textContent?.trim()).toBe('100%');

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

  it('uses preset chips in add place modal to quickly fill location', () => {
    const page = renderLoveJourneyPage();
    document.body.appendChild(page);

    page.querySelector<HTMLButtonElement>('#btn-add-place')?.click();

    const modal = document.querySelector<HTMLElement>('.journey-modal-backdrop');
    expect(modal).not.toBeNull();

    const daLatChip = Array.from(modal?.querySelectorAll<HTMLButtonElement>('.journey-chip-btn') || [])
      .find((b) => b.textContent?.includes('Đà Lạt'));
    expect(daLatChip).toBeDefined();
    daLatChip?.click();

    const nameInput = modal?.querySelector<HTMLInputElement>('#add-place-name');
    expect(nameInput?.value).toBe('Đà Lạt');
    expect(nameInput?.dataset.lat).toBeDefined();
    expect(nameInput?.dataset.lng).toBeDefined();

    const regionSelect = modal?.querySelector<HTMLSelectElement>('#add-place-region');
    expect(regionSelect?.value).toBe('central');
  });

  it('filters map markers by visited and wishlist status', () => {
    localStorage.setItem(
      PLACES_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'p-visited',
          name: 'Hà Nội',
          latitude: 21.0285,
          longitude: 105.8542,
          region: 'north',
          status: 'visited',
          visitedDate: '2025-01-01',
        },
        {
          id: 'p-wishlist',
          name: 'Phú Quốc',
          latitude: 10.2899,
          longitude: 103.9840,
          region: 'islands',
          status: 'wishlist',
        },
      ]),
    );
    localStorage.setItem(MIGRATION_SEED_CLEANUP_KEY, 'true');

    const page = renderLoveJourneyPage();
    document.body.appendChild(page);

    expect(page.querySelectorAll('.journey-map-pin').length).toBe(2);

    // Filter to visited only
    const visitedFilterBtn = page.querySelector<HTMLButtonElement>('button[data-map-filter="visited"]');
    visitedFilterBtn?.click();
    expect(page.querySelectorAll('.journey-map-pin').length).toBe(1);
    expect(page.querySelector('.journey-pin-visited')).not.toBeNull();
    expect(page.querySelector('.journey-pin-wishlist')).toBeNull();

    // Filter to wishlist only
    const wishlistFilterBtn = page.querySelector<HTMLButtonElement>('button[data-map-filter="wishlist"]');
    wishlistFilterBtn?.click();
    expect(page.querySelectorAll('.journey-map-pin').length).toBe(1);
    expect(page.querySelector('.journey-pin-wishlist')).not.toBeNull();

    // Reset to all
    const allFilterBtn = page.querySelector<HTMLButtonElement>('button[data-map-filter="all"]');
    allFilterBtn?.click();
    expect(page.querySelectorAll('.journey-map-pin').length).toBe(2);
  });

  it('renders photo avatar marker when place has photoUrl', () => {
    localStorage.setItem(
      PLACES_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'p-photo',
          name: 'Nha Trang Biển Xanh',
          latitude: 12.2388,
          longitude: 109.1967,
          region: 'central',
          status: 'visited',
          visitedDate: '2025-06-15',
          photoUrl: 'https://example.com/memory.jpg',
        },
      ]),
    );
    localStorage.setItem(MIGRATION_SEED_CLEANUP_KEY, 'true');

    const page = renderLoveJourneyPage();
    document.body.appendChild(page);

    const avatarImg = page.querySelector<HTMLImageElement>('.journey-pin-avatar img');
    expect(avatarImg).not.toBeNull();
    expect(avatarImg?.getAttribute('src')).toBe('https://example.com/memory.jpg');

    const coverImg = page.querySelector<HTMLImageElement>('.journey-place-cover-img');
    expect(coverImg).not.toBeNull();
    expect(coverImg?.getAttribute('src')).toBe('https://example.com/memory.jpg');
  });

  it('triggers zoom and reset controls without crashing', () => {
    const page = renderLoveJourneyPage();
    document.body.appendChild(page);

    expect(() => {
      page.querySelector<HTMLButtonElement>('#journey-btn-zoom-in')?.click();
      page.querySelector<HTMLButtonElement>('#journey-btn-zoom-out')?.click();
      page.querySelector<HTMLButtonElement>('#journey-btn-reset')?.click();
    }).not.toThrow();
  });

  it('renders empty state outside .journey-map-canvas-wrap when places is empty (Bug 2 regression)', () => {
    const page = renderLoveJourneyPage();
    document.body.appendChild(page);

    const mapWrap = page.querySelector('.journey-map-canvas-wrap');
    const emptyState = page.querySelector('.journey-map-empty-state');
    const mapPanel = page.querySelector('.journey-map-panel');
    const mapContainer = page.querySelector('.journey-map-container');

    expect(mapContainer).not.toBeNull();
    expect(emptyState).not.toBeNull();
    expect(mapWrap).not.toBeNull();
    expect(mapPanel).not.toBeNull();

    // Regression test for Bug 2: empty state MUST NOT be inside .journey-map-canvas-wrap
    expect(mapWrap?.contains(emptyState)).toBe(false);
    expect(mapPanel?.contains(emptyState)).toBe(true);

    // Selected place slot inside map wrap must be empty when places = []
    const selectedSlot = page.querySelector('#journey-selected-place-slot');
    expect(selectedSlot?.children.length).toBe(0);
  });

  it('uses OpenFreeMap public vector styles and contains zero cartocdn references (Bug 1 regression)', async () => {
    expect(OPENFREEMAP_LIBERTY_STYLE).toBe('https://tiles.openfreemap.org/styles/liberty');
    expect(OPENFREEMAP_DARK_STYLE).toBe('https://tiles.openfreemap.org/styles/dark');

    const fs = await import('fs');
    const path = await import('path');
    const sourceContent = fs.readFileSync(path.resolve(__dirname, './love-journey.ts'), 'utf-8');
    const cssContent = fs.readFileSync(path.resolve(__dirname, '../styles/love-journey.css'), 'utf-8');

    expect(sourceContent).not.toContain('cartocdn.com');
    expect(sourceContent).not.toContain('CARTO_POSITRON_STYLE');
    expect(sourceContent).not.toContain('CARTO_DARK_STYLE');
    expect(cssContent).not.toContain('cartocdn.com');
  });

  it('ensures map attribution is restored and not hidden by CSS rules', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const cssContent = fs.readFileSync(path.resolve(__dirname, '../styles/love-journey.css'), 'utf-8');

    expect(cssContent).not.toMatch(/\.maplibregl-ctrl-attrib[^{]*\{[^}]*display\s*:\s*none/);
    expect(cssContent).not.toMatch(/\.maplibregl-ctrl-attrib[^{]*\{[^}]*visibility\s*:\s*hidden/);
    expect(cssContent).not.toMatch(/\.maplibregl-ctrl-attrib[^{]*\{[^}]*opacity\s*:\s*0/);
  });

  it('updates map style on theme change without losing journey route or markers', async () => {
    localStorage.setItem(
      PLACES_STORAGE_KEY,
      JSON.stringify([
        { id: 'p1', name: 'Hà Nội', latitude: 21.0285, longitude: 105.8542, status: 'visited', visitedDate: '2025-01-01' },
        { id: 'p2', name: 'Đà Nẵng', latitude: 16.0544, longitude: 108.2022, status: 'visited', visitedDate: '2025-02-01' },
      ]),
    );
    localStorage.setItem(MIGRATION_SEED_CLEANUP_KEY, 'true');

    const page = renderLoveJourneyPage();
    document.body.appendChild(page);

    expect(page.querySelectorAll('.journey-map-pin').length).toBe(2);

    // Trigger theme toggle to dark
    document.documentElement.setAttribute('data-theme', 'dark');
    await new Promise((r) => setTimeout(r, 10));

    expect(page.querySelectorAll('.journey-map-pin').length).toBe(2);
  });

  it('cleans up resources on destroy lifecycle', () => {
    const page = renderLoveJourneyPage() as HTMLElement & { destroy?: () => void };
    document.body.appendChild(page);

    expect(typeof page.destroy).toBe('function');
    expect(() => page.destroy?.()).not.toThrow();
  });
});
