// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { navigate } from '../router';

vi.mock('../router', () => ({
  navigate: vi.fn(),
  invalidateRoutes: vi.fn(),
}));

vi.mock('../store/index', () => ({
  store: {
    get: () => ({
      user: { id: 'me', name: 'Me' },
      couple: { streak: 5 },
    }),
  },
}));

vi.mock('../api/checkins', () => ({
  createCheckin: vi.fn(),
}));

vi.mock('../components/toast', () => ({
  showToast: vi.fn(),
}));

vi.mock('../components/camera', () => ({
  openCamera: vi.fn(),
  openGallery: vi.fn(),
  processImage: vi.fn(),
  revokePreviewUrl: vi.fn(),
}));

describe('Check-in v2 composer & close navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('navigates to /app/home when clicking the bespoke SVG header close button', async () => {
    const { renderCheckinPage } = await import('./checkin');
    const page = renderCheckinPage();
    document.body.appendChild(page);

    const closeBtn = page.querySelector<HTMLButtonElement>('#back-btn');
    expect(closeBtn).not.toBeNull();
    expect(closeBtn?.type).toBe('submit');
    expect(closeBtn?.form?.action).toBe('http://localhost:3000/app/home');
    expect(closeBtn?.querySelector('[data-cil-icon="close"]')).not.toBeNull();

    closeBtn?.click();

    expect(navigate).toHaveBeenCalledWith('/app/home');
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('navigates on pointer release for touch-style interaction', async () => {
    const { renderCheckinPage } = await import('./checkin');
    const page = renderCheckinPage();
    document.body.appendChild(page);

    const closeBtn = page.querySelector<HTMLButtonElement>('#back-btn');
    closeBtn?.dispatchEvent(new Event('pointerup', { bubbles: true, cancelable: true }));

    expect(navigate).toHaveBeenCalledWith('/app/home');
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('renders custom SVG tabs without emojis and toggles Love Foil scratch option', async () => {
    const { renderCheckinPage } = await import('./checkin');
    const page = renderCheckinPage();
    document.body.appendChild(page);

    const tabs = page.querySelectorAll<HTMLButtonElement>('.tab-btn');
    expect(tabs.length).toBe(3);
    expect(tabs[0]?.querySelector('[data-cil-icon="camera"]')).not.toBeNull();
    expect(tabs[1]?.querySelector('[data-cil-icon="edit"]')).not.toBeNull();
    expect(tabs[2]?.querySelector('[data-cil-icon="dice"]')).not.toBeNull();

    const scratchToggle = page.querySelector<HTMLButtonElement>('.checkin-scratch-toggle');
    expect(scratchToggle?.getAttribute('aria-pressed')).toBe('true');
    expect(page.querySelector('#surprise-text-input')).not.toBeNull();

    scratchToggle?.click();
    const toggled = page.querySelector<HTMLButtonElement>('.checkin-scratch-toggle');
    expect(toggled?.getAttribute('aria-pressed')).toBe('false');
    expect(page.querySelector('#surprise-text-input')).toBeNull();
  });
});
