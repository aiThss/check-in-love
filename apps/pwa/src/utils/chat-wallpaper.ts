import { processImage } from '../components/camera';
import { showToast } from '../components/toast';

export const WALLPAPER_STORAGE_KEY = 'lovecheck_chat_wallpaper';

export interface WallpaperPreset {
  id: string;
  name: string;
  thumbnail: string;
  url: string;
}

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  {
    id: 'pink_clouds',
    name: 'Hoàng hôn hồng',
    thumbnail: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=260&q=75',
    url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1200&q=85',
  },
  {
    id: 'starry_night',
    name: 'Bầu trời sao',
    thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=260&q=75',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=85',
  },
  {
    id: 'cherry_blossom',
    name: 'Hoa anh đào',
    thumbnail: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?auto=format&fit=crop&w=260&q=75',
    url: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?auto=format&fit=crop&w=1200&q=85',
  },
  {
    id: 'sunset_beach',
    name: 'Biển hoàng hôn',
    thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=260&q=75',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=85',
  },
  {
    id: 'heart_bokeh',
    name: 'Trái tim lung linh',
    thumbnail: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?auto=format&fit=crop&w=260&q=75',
    url: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?auto=format&fit=crop&w=1200&q=85',
  },
  {
    id: 'twilight_purple',
    name: 'Hoàng hôn tím',
    thumbnail: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=260&q=75',
    url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=85',
  },
];

export function getChatWallpaper(): string | null {
  try {
    return localStorage.getItem(WALLPAPER_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function setChatWallpaper(url: string | null): void {
  try {
    if (url) {
      localStorage.setItem(WALLPAPER_STORAGE_KEY, url);
    } else {
      localStorage.removeItem(WALLPAPER_STORAGE_KEY);
    }
  } catch {
    // Fail silently on storage errors
  }
}

export function applyChatWallpaper(container: HTMLElement): void {
  const current = getChatWallpaper();
  if (current) {
    container.style.setProperty('--chat-wallpaper-url', `url("${current}")`);
    container.classList.add('has-custom-wallpaper');
  } else {
    container.style.removeProperty('--chat-wallpaper-url');
    container.classList.remove('has-custom-wallpaper');
  }
}

export function openWallpaperPickerModal(
  container: HTMLElement,
  onApply?: (url: string | null) => void,
): void {
  const current = getChatWallpaper();

  const overlay = document.createElement('div');
  overlay.className = 'wallpaper-modal-backdrop animate-fade-in';

  const modal = document.createElement('div');
  modal.className = 'wallpaper-modal-sheet';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-label', 'Đổi hình nền đoạn chat');

  const close = () => {
    modal.classList.add('is-closing');
    overlay.classList.add('is-closing');
    window.setTimeout(() => {
      overlay.remove();
    }, 240);
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.hidden = true;

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      showToast('Đang xử lý ảnh nền...', 'loading');
      const processed = await processImage(file, { maxSize: 1200, quality: 0.82 });
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setChatWallpaper(dataUrl);
        applyChatWallpaper(container);
        onApply?.(dataUrl);
        showToast('Đã đổi hình nền từ album 💕', 'success');
        close();
      };
      reader.readAsDataURL(processed.file);
    } catch {
      showToast('Không thể cài đặt ảnh này làm nền', 'error');
    }
  });

  modal.innerHTML = `
    <div class="wallpaper-modal-header">
      <div class="wallpaper-modal-title-group">
        <span class="wallpaper-modal-eyebrow">Tùy biến Messenger</span>
        <h2 class="wallpaper-modal-title">🖼️ Đổi hình nền chat</h2>
      </div>
      <button type="button" class="wallpaper-modal-close" aria-label="Đóng">✕</button>
    </div>

    <div class="wallpaper-modal-actions">
      <button type="button" class="wallpaper-action-btn wallpaper-upload-btn">
        <span class="wallpaper-action-icon">📸</span>
        <div class="wallpaper-action-text">
          <strong>Chọn từ Album ảnh</strong>
          <small>Tải ảnh bất kỳ từ điện thoại làm nền</small>
        </div>
      </button>

      <button type="button" class="wallpaper-action-btn wallpaper-reset-btn ${!current ? 'is-active' : ''}">
        <span class="wallpaper-action-icon">🎨</span>
        <div class="wallpaper-action-text">
          <strong>Mặc định</strong>
          <small>Sử dụng màu nền chuẩn của ứng dụng</small>
        </div>
        ${!current ? '<span class="wallpaper-check">✓</span>' : ''}
      </button>
    </div>

    <div class="wallpaper-section-label">Hình nền gợi ý có sẵn</div>
    <div class="wallpaper-preset-grid">
      ${WALLPAPER_PRESETS.map((preset) => {
        const isActive = current === preset.url;
        return `
          <button type="button" class="wallpaper-preset-card ${isActive ? 'is-active' : ''}" data-wallpaper-url="${preset.url}" data-wallpaper-name="${preset.name}">
            <img src="${preset.thumbnail}" alt="${preset.name}" loading="lazy" />
            <div class="wallpaper-preset-overlay">
              <span class="wallpaper-preset-name">${preset.name}</span>
              ${isActive ? '<span class="wallpaper-check-badge">✓</span>' : ''}
            </div>
          </button>
        `;
      }).join('')}
    </div>
  `;

  modal.appendChild(fileInput);

  modal.querySelector('.wallpaper-modal-close')?.addEventListener('click', close);
  
  modal.querySelector('.wallpaper-upload-btn')?.addEventListener('click', () => {
    fileInput.click();
  });

  modal.querySelector('.wallpaper-reset-btn')?.addEventListener('click', () => {
    setChatWallpaper(null);
    applyChatWallpaper(container);
    onApply?.(null);
    showToast('Đã khôi phục hình nền mặc định', 'info');
    close();
  });

  modal.querySelectorAll<HTMLButtonElement>('.wallpaper-preset-card').forEach((card) => {
    card.addEventListener('click', () => {
      const url = card.dataset.wallpaperUrl;
      const name = card.dataset.wallpaperName || 'Mới';
      if (!url) return;
      setChatWallpaper(url);
      applyChatWallpaper(container);
      onApply?.(url);
      showToast(`Đã đổi hình nền: ${name} ✨`, 'success');
      close();
    });
  });

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}
