// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tương thích ngược: nạp snapshot localStorage do client CŨ (trước redesign v2) ghi ra,
 * rồi kiểm tra UI/store v2 đọc đúng và KHÔNG làm mất hay đổi định dạng khoá cũ.
 */
const LEGACY_STATE = {
  token: 'legacy-token-in-state',
  user: { id: 'u1', name: 'Linh', partnerName: 'Nam' },
  couple: { id: 'c1', streak: 42 },
  theme: 'dark',
  hasNewCheckin: true,
};
const LEGACY_PLACES = JSON.stringify([{ id: 'p1', name: 'Đà Lạt' }]);
const LEGACY_BUCKET = JSON.stringify([{ id: 'b1', title: 'Ngắm hoàng hôn', done: false }]);
const LEGACY_WALLPAPER = 'https://example.test/wallpaper.jpg';
const LEGACY_BACKGROUND = JSON.stringify({ url: 'https://example.test/bg.jpg' });
const LEGACY_DRAFT = 'nháp dở dang 💬';
const LEGACY_KEYS: Record<string, string> = {
  lovecheck_state: JSON.stringify(LEGACY_STATE),
  lovecheck_journey_places: LEGACY_PLACES,
  lovecheck_journey_bucket: LEGACY_BUCKET,
  lovecheck_journey_seed_cleanup_v1: '1',
  lovecheck_chat_wallpaper: LEGACY_WALLPAPER,
  lovecheck_chat_background_v1: LEGACY_BACKGROUND,
  lovecheck_message_draft_after_sticker: LEGACY_DRAFT,
  'lovecheck:occasion-card:seen:v1:couple-1': '1',
};

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.head.innerHTML = '<meta name="theme-color" content="#f8e2e7" id="meta-theme-color" />';
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
  for (const [key, value] of Object.entries(LEGACY_KEYS)) localStorage.setItem(key, value);
});

describe('storage compatibility with pre-v2 clients', () => {
  it('store reads the legacy state, including a token that only lived inside lovecheck_state', async () => {
    const { store } = await import('../store/index');

    expect(store.get().theme).toBe('dark');
    expect(store.get().user?.partnerName).toBe('Nam');
    expect(store.get().couple?.streak).toBe(42);
    expect(store.getToken()).toBe('legacy-token-in-state');
  });

  it('v2 theme engine adopts the legacy theme, applies defaults and creates only lovecheck_ui_v2_* keys', async () => {
    const { store } = await import('../store/index');
    const ui = await import('./theme/index');
    const keysBefore = new Set(Object.keys(LEGACY_KEYS));

    store.initTheme();
    ui.initUiThemeEngine();

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(ui.UI_THEME_STORAGE_KEY)).toBe('dark');
    expect(ui.getUiAccent()).toBe('rose');
    expect(ui.getUiReducedMotion()).toBe('system');

    const created = Object.keys(localStorage).filter((key) => !keysBefore.has(key));
    expect(created.length).toBeGreaterThan(0);
    for (const key of created) expect(key.startsWith('lovecheck_ui_v2_')).toBe(true);
  });

  it('keeps every legacy key byte-for-byte after v2 initialisation', async () => {
    const { store } = await import('../store/index');
    const ui = await import('./theme/index');

    store.initTheme();
    ui.initUiThemeEngine();

    expect(localStorage.getItem('lovecheck_journey_places')).toBe(LEGACY_PLACES);
    expect(localStorage.getItem('lovecheck_journey_bucket')).toBe(LEGACY_BUCKET);
    expect(localStorage.getItem('lovecheck_journey_seed_cleanup_v1')).toBe('1');
    expect(localStorage.getItem('lovecheck_chat_wallpaper')).toBe(LEGACY_WALLPAPER);
    expect(localStorage.getItem('lovecheck_chat_background_v1')).toBe(LEGACY_BACKGROUND);
    expect(localStorage.getItem('lovecheck_message_draft_after_sticker')).toBe(LEGACY_DRAFT);
    expect(localStorage.getItem('lovecheck:occasion-card:seen:v1:couple-1')).toBe('1');
  });

  it('v2 modules still use the exact legacy key names', async () => {
    const wallpaper = await import('../utils/chat-wallpaper');
    const background = await import('../utils/message-background');
    const journey = await import('../pages/love-journey');

    expect(wallpaper.WALLPAPER_STORAGE_KEY).toBe('lovecheck_chat_wallpaper');
    expect(wallpaper.getChatWallpaper()).toBe(LEGACY_WALLPAPER);
    expect(background.CHAT_BACKGROUND_STORAGE_KEY).toBe('lovecheck_chat_background_v1');
    expect(journey.PLACES_STORAGE_KEY).toBe('lovecheck_journey_places');
    expect(journey.BUCKET_STORAGE_KEY).toBe('lovecheck_journey_bucket');
    expect(journey.MIGRATION_SEED_CLEANUP_KEY).toBe('lovecheck_journey_seed_cleanup_v1');
    expect(JSON.parse(localStorage.getItem(journey.PLACES_STORAGE_KEY)!)).toEqual(JSON.parse(LEGACY_PLACES));
  });

  it('an invalid v2 value falls back to a safe default instead of throwing', async () => {
    localStorage.setItem('lovecheck_ui_v2_accent', 'not-a-colour');
    localStorage.setItem('lovecheck_ui_v2_reduced_motion', 'maybe');
    const ui = await import('./theme/index');

    expect(ui.getUiAccent()).toBe('rose');
    expect(ui.getUiReducedMotion()).toBe('system');
  });
});
