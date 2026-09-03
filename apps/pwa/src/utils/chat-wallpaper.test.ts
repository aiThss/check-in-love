// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import {
  getChatWallpaper,
  setChatWallpaper,
  applyChatWallpaper,
  WALLPAPER_STORAGE_KEY,
  WALLPAPER_PRESETS,
} from './chat-wallpaper';

describe('chat-wallpaper utility', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores and retrieves wallpaper from localStorage', () => {
    expect(getChatWallpaper()).toBeNull();
    setChatWallpaper('https://example.com/test-bg.jpg');
    expect(getChatWallpaper()).toBe('https://example.com/test-bg.jpg');
    expect(localStorage.getItem(WALLPAPER_STORAGE_KEY)).toBe('https://example.com/test-bg.jpg');

    setChatWallpaper(null);
    expect(getChatWallpaper()).toBeNull();
    expect(localStorage.getItem(WALLPAPER_STORAGE_KEY)).toBeNull();
  });

  it('applies custom wallpaper to container element', () => {
    const container = document.createElement('div');
    applyChatWallpaper(container);
    expect(container.classList.contains('has-custom-wallpaper')).toBe(false);

    setChatWallpaper('https://example.com/starry.jpg');
    applyChatWallpaper(container);
    expect(container.classList.contains('has-custom-wallpaper')).toBe(true);
    expect(container.style.getPropertyValue('--chat-wallpaper-url')).toBe('url("https://example.com/starry.jpg")');

    setChatWallpaper(null);
    applyChatWallpaper(container);
    expect(container.classList.contains('has-custom-wallpaper')).toBe(false);
    expect(container.style.getPropertyValue('--chat-wallpaper-url')).toBe('');
  });

  it('provides at least 5 preset wallpapers', () => {
    expect(WALLPAPER_PRESETS.length).toBeGreaterThanOrEqual(5);
    WALLPAPER_PRESETS.forEach((preset) => {
      expect(preset.id).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.url).toBeTruthy();
      expect(preset.thumbnail).toBeTruthy();
    });
  });
});
