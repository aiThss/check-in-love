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

describe('Check-in close button navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('navigates to /app/home when clicking the ✕ header close button', async () => {
    const { renderCheckinPage } = await import('./checkin');
    const page = renderCheckinPage();
    document.body.appendChild(page);

    const closeBtn = page.querySelector<HTMLButtonElement>('#back-btn');
    expect(closeBtn).not.toBeNull();
    expect(closeBtn?.textContent).toBe('✕');

    closeBtn?.click();

    expect(navigate).toHaveBeenCalledWith('/app/home');
  });
});
