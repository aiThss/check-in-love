import { processImage, revokePreviewUrl } from '../../components/camera';
import { showModal } from '../../components/modal';
import { showToast } from '../../components/toast';
import type { ChatBackgroundSnapshot } from '../../api/types';
import { iconMarkup } from '../../ui/icons/icons';
import { analyzeImageTone, themeFallbackTone } from '../../utils/image-contrast';
import {
  CHAT_BACKGROUND_PRESETS,
  getChatBackgroundImage,
  readChatBackground,
  type ChatBackgroundSelection,
} from '../../utils/message-background';

export function toCssBackgroundImage(url: string): string {
  const escaped = url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `url("${escaped}")`;
}

const systemEventToneRequests = new WeakMap<HTMLElement, number>();

function applySystemEventTone(page: HTMLElement, image: string | null): void {
  const requestId = (systemEventToneRequests.get(page) ?? 0) + 1;
  systemEventToneRequests.set(page, requestId);

  if (!image) {
    delete page.dataset.systemEventTone;
    return;
  }

  const fallback = themeFallbackTone();
  page.dataset.systemEventTone = fallback;
  void analyzeImageTone(image).then((tone) => {
    if (systemEventToneRequests.get(page) !== requestId) return;
    page.dataset.systemEventTone = tone ?? fallback;
  });
}

export function applyChatBackground(page: HTMLElement, selection: ChatBackgroundSelection): void {
  const image = getChatBackgroundImage(selection);
  applySystemEventTone(page, image);
  const wallpaperLayer = page.querySelector<HTMLElement>('.messages-wallpaper-layer');
  if (!image) {
    page.classList.remove('has-chat-wallpaper');
    if (wallpaperLayer) {
      wallpaperLayer.style.removeProperty('background-image');
      wallpaperLayer.style.removeProperty('display');
      wallpaperLayer.style.removeProperty('position');
      wallpaperLayer.style.removeProperty('top');
      wallpaperLayer.style.removeProperty('right');
      wallpaperLayer.style.removeProperty('bottom');
      wallpaperLayer.style.removeProperty('left');
      wallpaperLayer.style.removeProperty('z-index');
    }
    page.style.removeProperty('background-image');
    delete page.dataset.chatBackground;
    return;
  }

  page.classList.add('has-chat-wallpaper');
  page.dataset.chatBackground = selection.kind === 'custom' ? 'custom' : selection.id;
  if (wallpaperLayer) {
    wallpaperLayer.style.display = 'block';
    wallpaperLayer.style.position = 'absolute';
    wallpaperLayer.style.top = '0';
    wallpaperLayer.style.right = '0';
    wallpaperLayer.style.bottom = '0';
    wallpaperLayer.style.left = '0';
    wallpaperLayer.style.zIndex = '0';
    wallpaperLayer.style.backgroundImage = toCssBackgroundImage(image);
    page.style.removeProperty('background-image');
  } else {
    page.style.backgroundImage = toCssBackgroundImage(image);
  }
}

export function selectionFromSharedBackground(
  background: ChatBackgroundSnapshot | null | undefined,
): ChatBackgroundSelection | null {
  if (!background) return null;
  if (
    background.kind === 'preset'
    && background.id
    && CHAT_BACKGROUND_PRESETS.some((item) => item.id === background.id)
  ) {
    return { kind: 'preset', id: background.id };
  }
  if (background.kind === 'custom' && background.imageUrl) {
    return { kind: 'custom', dataUrl: background.imageUrl };
  }
  return null;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Không đọc được ảnh nền'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Không đọc được ảnh nền'));
    reader.readAsDataURL(file);
  });
}

export function openChatBackgroundModal(
  onSelect: (selection: ChatBackgroundSelection, successMessage: string) => Promise<void>,
): void {
  const current = readChatBackground();
  const picker = document.createElement('div');
  picker.className = 'messages-wallpaper-picker';

  const description = document.createElement('p');
  description.className = 'messages-wallpaper-description';
  description.textContent = 'Chọn một nền nhẹ mắt cho cuộc trò chuyện của hai đứa mình.';

  const grid = document.createElement('div');
  grid.className = 'messages-wallpaper-grid';
  grid.setAttribute('role', 'radiogroup');
  grid.setAttribute('aria-label', 'Nền chat có sẵn');

  CHAT_BACKGROUND_PRESETS.forEach((preset) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'messages-wallpaper-option';
    option.setAttribute('role', 'radio');
    option.setAttribute(
      'aria-checked',
      current.kind === 'preset' && current.id === preset.id ? 'true' : 'false',
    );
    option.setAttribute('aria-label', `Chọn nền ${preset.name}`);
    option.style.backgroundImage = preset.imageUrl
      ? toCssBackgroundImage(preset.imageUrl)
      : preset.preview;
    option.innerHTML = `<span class="messages-wallpaper-option-label">${preset.name}</span>`;
    option.addEventListener('click', () => {
      void onSelect(
        { kind: 'preset', id: preset.id },
        preset.id === 'default' ? 'Đã khôi phục nền mặc định' : `Đã đổi nền: ${preset.name}`,
      );
    });
    grid.appendChild(option);
  });

  const customInput = document.createElement('input');
  customInput.type = 'file';
  customInput.accept = 'image/*';
  customInput.hidden = true;
  customInput.setAttribute('aria-label', 'Chọn ảnh nền từ album');

  const customButton = document.createElement('button');
  customButton.type = 'button';
  customButton.className = 'messages-wallpaper-custom';
  if (current.kind === 'custom') {
    customButton.style.setProperty('--wallpaper-custom-image', toCssBackgroundImage(current.dataUrl));
  }
  customButton.innerHTML = `
    <span class="messages-wallpaper-custom-icon" aria-hidden="true">
      ${iconMarkup('gallery', { size: 20 })}
    </span>
    <span>
      <strong>${current.kind === 'custom' ? 'Chọn ảnh khác' : 'Chọn ảnh từ album'}</strong>
      <small>${current.kind === 'custom' ? 'Đang dùng ảnh riêng · đã đồng bộ' : 'Được đồng bộ cho cả hai người'}</small>
    </span>
  `;
  customButton.addEventListener('click', () => customInput.click());
  customInput.addEventListener('change', async () => {
    const source = customInput.files?.[0];
    customInput.value = '';
    if (!source) return;

    let previewSource: string | null = null;
    try {
      customButton.disabled = true;
      const processed = await processImage(source, { maxSize: 1600, quality: 0.82 });
      previewSource = processed.preview;
      const dataUrl = await readFileAsDataUrl(processed.file);
      void onSelect({ kind: 'custom', dataUrl }, 'Đã đặt ảnh riêng làm nền chat');
    } catch {
      showToast('Không xử lý được ảnh nền này, thử ảnh khác nhé', 'error');
    } finally {
      revokePreviewUrl(previewSource);
      customButton.disabled = false;
    }
  });

  picker.append(description, grid, customButton, customInput);
  showModal({
    title: 'Nền trò chuyện',
    content: picker,
    cancelText: 'Đóng',
    center: true,
    modalClass: 'messages-wallpaper-modal',
  });
}
