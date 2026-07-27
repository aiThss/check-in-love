import { navigate } from '../router';
import { createCheckin } from '../api/checkins';
import { ApiError } from '../api/client';
import { store } from '../store/index';
import { logger } from '../utils/logger';
import { showToast } from '../components/toast';
import {
  openCamera,
  openGallery,
  processImage,
  revokePreviewUrl,
  type CameraResult,
} from '../components/camera';
import type { CheckIn } from '../api/types';

const PHOTO_ASPECT_RATIO = 1;
const PHOTO_CSS_RATIO = '1 / 1';

const _MOODS = [
  { value: 'happy', emoji: '😊', label: 'Vui vẻ' },
  { value: 'love', emoji: '🥰', label: 'Đang yêu' },
  { value: 'sad', emoji: '😢', label: 'Buồn' },
  { value: 'excited', emoji: '🤩', label: 'Hào hứng' },
  { value: 'tired', emoji: '😴', label: 'Mệt mỏi' },
  { value: 'calm', emoji: '😌', label: 'Bình yên' },
  { value: 'miss', emoji: '🥺', label: 'Nhớ nhung' }
];

const QUICK_MESSAGES = [
  'Đang nhớ người ấy ghê 💕',
  'Đang ăn nè, thèm quá 🍲',
  'Đang học/làm việc chăm chỉ ✍️',
  'Hôm nay mệt xỉu luôn 😴',
  'Cần ôm một cái thật chặt 🫂',
  'Đang đi chơi nè 🌸',
  'Có tin vui muốn khoe 🎉'
];

export function renderCheckinPage(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'page checkin-page animate-fade-in';
  root.style.cssText = `
    padding: calc(var(--safe-top) + 16px) 16px calc(170px + var(--safe-bottom)) 16px;
    display: flex;
    flex-direction: column;
    gap: clamp(10px, 2vh, 16px);
    margin: 0 auto;
    width: 100%;
    max-width: min(480px, 100%);
    box-sizing: border-box;
    min-height: 100dvh;
    overflow-x: hidden;
    overflow-y: auto;
  `;

  // Header with back button
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:0;min-width:0;';
  header.innerHTML = `
    <button id="back-btn" class="btn-icon" style="border-radius:50%;width:44px;height:44px;">←</button>
    <div>
      <h1 style="font-size:20px;font-weight:700;letter-spacing:-0.02em;">Gửi khoảnh khắc</h1>
      <p style="font-size:13px;color:var(--text-secondary);">Chia sẻ hiện tại của bạn với người ấy</p>
    </div>
  `;
  root.appendChild(header);

  const backButton = header.querySelector<HTMLButtonElement>('#back-btn');
  if (backButton) {
    backButton.style.width = '40px';
    backButton.style.height = '40px';
    backButton.style.flexShrink = '0';
  }

  const headerText = header.querySelector<HTMLElement>('div');
  if (headerText) {
    headerText.style.minWidth = '0';
    const subtitle = headerText.querySelector<HTMLElement>('p');
    if (subtitle) {
      subtitle.style.fontSize = '12px';
      subtitle.style.lineHeight = '1.35';
    }
  }

  header.querySelector('#back-btn')?.addEventListener('click', () => {
    navigate('/app/home');
  });

  // Type Selector Tab
  const tabsWrapper = document.createElement('div');
  tabsWrapper.style.cssText = `
    display: flex;
    background: var(--surface-solid);
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    padding: 4px;
    gap: 4px;
    width:100%;
    max-width:100%;
    overflow:hidden;
  `;
  
  const modes = [
    { id: 'photo', label: '📸 Ảnh' },
    { id: 'text', label: '✍️ Tin nhắn' },
    { id: 'random', label: '🎲 Random' }
  ];

  let activeMode = 'photo';

  modes.forEach(mode => {
    const tab = document.createElement('button');
    tab.className = `tab-btn ${mode.id === activeMode ? 'active' : ''}`;
    tab.style.cssText = `
      flex: 1;
      min-width:0;
      padding: 8px 6px;
      font-size: clamp(12px, 3.4vw, 14px);
      font-weight: 600;
      border-radius: var(--radius-pill);
      text-align: center;
      transition: all var(--duration-fast) var(--ease);
      color: ${mode.id === activeMode ? 'var(--accent)' : 'var(--text-secondary)'};
      background: ${mode.id === activeMode ? 'var(--bg)' : 'transparent'};
      box-shadow: ${mode.id === activeMode ? 'var(--shadow)' : 'none'};
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    `;
    tab.textContent = mode.label;
    tab.dataset.mode = mode.id;
    tabsWrapper.appendChild(tab);
  });
  root.appendChild(tabsWrapper);

  // Content Area
  const contentArea = document.createElement('div');
  contentArea.className = 'card';
  contentArea.style.cssText = 'padding: clamp(14px, 3.5vw, 18px); display: flex; flex-direction: column; gap: 12px; min-height: 0; width:100%; max-width:100%; overflow:hidden;';
  root.appendChild(contentArea);

  // Form State
  let selectedFile: File | null = null;
  let selectedSourceFile: File | null = null;
  let selectedPreviewUrl: string | null = null;
  let isProcessingPhoto = false;
  let photoCaption = '';
  let selectedQuickMsg: string | null = null;

  function clearSelectedPhoto(): void {
    selectedSourceFile = null;
    selectedFile = null;
    revokePreviewUrl(selectedPreviewUrl);
    selectedPreviewUrl = null;
  }

  async function applyPhotoTransform(sourceFile: File): Promise<void> {
    isProcessingPhoto = true;
    renderContentForm();

    try {
      const result = await processImage(sourceFile, {
        aspectRatio: PHOTO_ASPECT_RATIO,
        // Max 1600px — balance between quality and upload speed
        maxSize: 1600,
        quality: 0.85,
      });

      revokePreviewUrl(selectedPreviewUrl);
      selectedFile = result.file;
      selectedPreviewUrl = result.preview;
    } catch {
      showToast('Không thể xử lý ảnh này, thử ảnh JPG/PNG khác nhé.', 'error');
      clearSelectedPhoto();
    } finally {
      isProcessingPhoto = false;
      renderContentForm();
    }
  }

  function selectPhoto(res: CameraResult): void {
    selectedSourceFile = res.file;
    const rawPreview = res.preview;
    void applyPhotoTransform(res.file).then(() => {
      // Revoke the temporary raw-file blob URL produced by camera capture
      revokePreviewUrl(rawPreview);
    });
  }

  function buildPhotoPayload(file: File, caption: string, clientMutationId: string): FormData {
    const fd = new FormData();
    fd.append('type', 'photo');
    fd.append('clientMutationId', clientMutationId);
    fd.append('file', file, file.name || 'checkin-photo.jpg');
    if (caption) {
      fd.append('caption', caption);
    }
    return fd;
  }

  async function createPhotoCheckinWithRetry(caption: string, clientMutationId: string) {
    if (!selectedFile) {
      throw new Error('NO_PHOTO');
    }

    try {
      return await createCheckin(buildPhotoPayload(selectedFile, caption, clientMutationId));
    } catch (err) {
      if (
        !(err instanceof ApiError) ||
        err.code !== 'NETWORK_ERROR' ||
        !selectedSourceFile
      ) {
        throw err;
      }

      showToast('Upload ảnh chưa ổn, đang thử bản nhẹ hơn...', 'info');
      const fallback = await processImage(selectedSourceFile, {
        aspectRatio: PHOTO_ASPECT_RATIO,
        maxSize: 640,
        quality: 0.62,
      });

      revokePreviewUrl(selectedPreviewUrl);
      selectedFile = fallback.file;
      selectedPreviewUrl = fallback.preview;
      renderContentForm();

      return createCheckin(buildPhotoPayload(fallback.file, caption, clientMutationId));
    }
  }

  function compactUploadPicker(picker: HTMLElement): void {
    const icon = picker.children[0] as HTMLElement | undefined;
    const copy = picker.children[1] as HTMLElement | undefined;
    const title = copy?.querySelector<HTMLElement>('p:first-child');
    const subtitle = copy?.querySelector<HTMLElement>('p:last-child');

    if (icon) {
      icon.style.fontSize = 'clamp(46px, 13vw, 56px)';
      icon.style.lineHeight = '1';
    }

    if (copy) {
      copy.style.maxWidth = '100%';
      copy.style.padding = '0 10px';
    }

    if (title) {
      title.style.fontSize = 'clamp(13px, 3.6vw, 15px)';
      title.style.lineHeight = '1.25';
    }

    if (subtitle) {
      subtitle.style.fontSize = '11px';
      subtitle.style.lineHeight = '1.25';
    }
  }

  function compactCaptionGroup(group: HTMLElement): void {
    group.querySelector('label')?.remove();
    group.style.gap = '0';

    const input = group.querySelector<HTMLInputElement>('#caption-input');
    if (input) {
      input.style.minHeight = '46px';
      input.style.padding = '12px 14px';
      input.style.fontSize = '14px';
      input.style.borderRadius = '16px';
    }
  }

  function renderPhotoForm(): void {
    const picker = document.createElement('div');
    picker.className = `photo-composer${selectedPreviewUrl ? ' has-photo' : ''}`;
    picker.style.aspectRatio = PHOTO_CSS_RATIO;

    if (selectedPreviewUrl) {
      picker.innerHTML = `
        <img class="photo-composer-image" src="${selectedPreviewUrl}" alt="Ảnh check-in đã chọn" />
        <div class="photo-composer-vignette"></div>
        <div class="photo-composer-topbar">
          <button id="remove-photo" class="photo-icon-button" aria-label="Xóa ảnh">×</button>
        </div>
        <div class="photo-composer-actions">
          <button id="retake-photo" class="photo-action-button" type="button">Chụp lại</button>
          <button id="change-photo" class="photo-action-button" type="button">Đổi ảnh</button>
        </div>
      `;

      picker.querySelector('#remove-photo')?.addEventListener('click', (e) => {
        e.stopPropagation();
        clearSelectedPhoto();
        renderContentForm();
      });
      picker.querySelector('#retake-photo')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openCamera((res) => selectPhoto(res));
      });
      picker.querySelector('#change-photo')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openGallery((res) => selectPhoto(res));
      });
    } else if (isProcessingPhoto) {
      picker.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;">
          <svg viewBox="0 0 64 76" width="136" height="162" class="l-polaroid" aria-hidden="true">
            <defs>
              <linearGradient id="ciPolGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#ffb3cc"/>
                <stop offset="55%" stop-color="#ff85a1"/>
                <stop offset="100%" stop-color="#c0456c"/>
              </linearGradient>
            </defs>
            <rect width="64" height="76" rx="4" fill="#fff4f7"/>
            <rect class="l-polaroid__photo" x="6" y="6" width="52" height="52" rx="2" fill="url(#ciPolGrad)"/>
            <rect x="10" y="66" width="26" height="3" rx="1.5" fill="#c0456c" opacity=".4"/>
          </svg>
          <span style="font-size:13px;color:var(--text-secondary);">Đang chuẩn bị ảnh...</span>
        </div>
      `;
    } else {
      picker.innerHTML = `
        <div class="photo-composer-empty">
          <img class="photo-composer-lens" src="/icons8-photo-gallery-96.apng.png" alt="Gallery Icon" width="96" height="96" />
          <div class="photo-composer-copy">
            <strong>Gửi ảnh cho người ấy</strong>
            <span>Chụp mới hoặc chọn ảnh từ album</span>
          </div>
          <div class="photo-composer-actions photo-composer-actions-empty">
            <button id="camera-photo" class="photo-action-button primary" type="button">Chụp</button>
            <button id="gallery-photo" class="photo-action-button" type="button">Album</button>
          </div>
        </div>
      `;

      const lensImg = picker.querySelector<HTMLImageElement>('.photo-composer-lens');
      const resetAnimation = () => {
        if (lensImg) {
          lensImg.src = '/icons8-photo-gallery-96.apng.png?t=' + Date.now();
        }
      };

      picker.addEventListener('pointerenter', resetAnimation);
      picker.addEventListener('click', resetAnimation);

      picker.querySelector('#camera-photo')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openCamera((res) => selectPhoto(res));
      });
      picker.querySelector('#gallery-photo')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openGallery((res) => selectPhoto(res));
      });
    }



    contentArea.appendChild(picker);

    const capGroup = document.createElement('div');
    capGroup.className = 'input-group';
    capGroup.innerHTML = `
      <label class="input-label">Mô tả (Không bắt buộc)</label>
      <input type="text" id="caption-input" class="input" placeholder="Viết vài dòng ngọt ngào..." maxlength="280" />
    `;
    compactCaptionGroup(capGroup);
    const captionInput = capGroup.querySelector<HTMLInputElement>('#caption-input');
    if (captionInput) {
      captionInput.value = photoCaption;
      captionInput.addEventListener('input', () => {
        photoCaption = captionInput.value;
      });
    }
    contentArea.appendChild(capGroup);

    const quickHeader = document.createElement('label');
    quickHeader.className = 'input-label';
    quickHeader.textContent = 'Chọn nhanh tin nhắn';
    quickHeader.style.marginBottom = '0';
    contentArea.appendChild(quickHeader);

    const chipsWrapper = document.createElement('div');
    chipsWrapper.className = 'chip-scroll photo-chip-scroll';
    QUICK_MESSAGES.forEach((msg) => {
      const chip = document.createElement('button');
      chip.className = `chip ${selectedQuickMsg === msg ? 'active' : ''}`;
      chip.type = 'button';
      chip.textContent = msg;
      chip.addEventListener('click', () => {
        if (selectedQuickMsg === msg) {
          selectedQuickMsg = null;
        } else {
          selectedQuickMsg = msg;
          photoCaption = msg;
          const input = contentArea.querySelector<HTMLInputElement>('#caption-input');
          if (input) input.value = msg;
        }
        chipsWrapper.querySelectorAll<HTMLButtonElement>('button').forEach((btn, idx) => {
          btn.classList.toggle('active', QUICK_MESSAGES[idx] === selectedQuickMsg);
        });
      });
      chipsWrapper.appendChild(chip);
    });
    contentArea.appendChild(chipsWrapper);
  }

  // Render content depending on activeMode
  function renderContentForm() {
    contentArea.innerHTML = '';

    if (activeMode === 'photo') {
      renderPhotoForm();
      return;
    }

    if (activeMode === 'text') {
      // Text Checkin
      const textGroup = document.createElement('div');
      textGroup.className = 'input-group';
      textGroup.style.flex = '1';
      textGroup.innerHTML = `
        <label class="input-label">Viết gì đó gửi người ấy</label>
        <textarea id="text-input" class="input" placeholder="Hôm nay của bạn thế nào? Kể cho người ấy nghe nhé..." maxlength="280" style="flex:1;min-height:140px;"></textarea>
      `;
      const textInput = textGroup.querySelector<HTMLTextAreaElement>('#text-input');
      if (textInput) {
        textInput.style.minHeight = '112px';
        textInput.style.lineHeight = '1.45';
      }
      contentArea.appendChild(textGroup);

      // Quick message selection
      const quickHeader = document.createElement('label');
      quickHeader.className = 'input-label';
      quickHeader.textContent = 'Gợi ý tin nhắn';
      quickHeader.style.marginBottom = '0';
      contentArea.appendChild(quickHeader);

      const chipsWrapper = document.createElement('div');
      chipsWrapper.style.cssText = 'display:flex;gap:6px;overflow-x:auto;overflow-y:hidden;padding-bottom:4px;margin-top:-8px;max-width:100%;scrollbar-width:none;-webkit-overflow-scrolling:touch;';
      QUICK_MESSAGES.forEach(msg => {
        const chip = document.createElement('button');
        chip.style.cssText = `
          white-space:nowrap;
          flex-shrink:0;
          font-size:12px;
          padding:5px 10px;
          border-radius:12px;
          background: var(--surface-solid);
          border: 1px solid var(--border);
          color: var(--text-primary);
        `;
        chip.textContent = msg;
        chip.addEventListener('click', () => {
          const textarea = contentArea.querySelector('#text-input') as HTMLTextAreaElement;
          if (textarea) {
            textarea.value = msg;
            textarea.focus();
          }
        });
        chipsWrapper.appendChild(chip);
      });
      contentArea.appendChild(chipsWrapper);

    } else if (activeMode === 'random') {
      const randomCard = document.createElement('div');
      randomCard.className = 'card-solid';
      randomCard.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px;padding:24px 16px;text-align:center;';
      randomCard.innerHTML = `
        <div style="font-size:48px;line-height:1">🎲</div>
        <strong>Random cho hai bạn</strong>
        <span style="font-size:13px;color:var(--text-secondary)">Bốc câu hỏi, thử thách hoặc một gợi ý bất ngờ.</span>
        <button type="button" class="btn-primary">Mở Random</button>
      `;
      randomCard.querySelector('button')?.addEventListener('click', () => navigate('/app/random'));
      contentArea.appendChild(randomCard);
    }
  }

  // Switch tab event handlers
  tabsWrapper.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.tab-btn') as HTMLButtonElement | null;
    if (!btn) return;
    const mode = btn.dataset.mode;
    if (!mode || mode === activeMode) return;

    activeMode = mode;
    tabsWrapper.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach(b => {
      const isAct = b.getAttribute('data-mode') === activeMode;
      b.style.color = isAct ? 'var(--accent)' : 'var(--text-secondary)';
      b.style.background = isAct ? 'var(--bg)' : 'transparent';
      b.style.boxShadow = isAct ? 'var(--shadow)' : 'none';
    });

    renderContentForm();
  });

  renderContentForm();

  // Send Button
  const sendBtn = document.createElement('button');
  sendBtn.className = 'btn-primary btn-primary-full';
  sendBtn.style.cssText = `
    position:fixed;
    left:50%;
    bottom:calc(92px + var(--safe-bottom));
    transform:translateX(-50%);
    z-index:90;
    width:min(448px, calc(100% - 32px));
    padding:16px;
    font-size:17px;
    font-weight:700;
    box-shadow:0 12px 32px var(--accent-glow);
  `;
  sendBtn.innerHTML = `Gửi ngay 💕`;
  root.appendChild(sendBtn);

  // Send Action handler
  sendBtn.addEventListener('click', async () => {
    let payload: FormData | Record<string, any>;
    const clientMutationId = `checkin:${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
    
    if (activeMode === 'photo') {
      if (isProcessingPhoto) {
        showToast('Ảnh đang được xử lý, chờ một chút nhé.', 'info');
        return;
      }
      if (!selectedFile) {
        showToast('Vui lòng chọn hoặc chụp ảnh!', 'error');
        return;
      }
      const caption = (root.querySelector('#caption-input') as HTMLInputElement)?.value.trim();
      photoCaption = caption ?? '';
      payload = buildPhotoPayload(selectedFile, photoCaption, clientMutationId);
    } else if (activeMode === 'text') {
      const text = (root.querySelector('#text-input') as HTMLTextAreaElement)?.value.trim();
      if (!text) {
        showToast('Nội dung tin nhắn không được để trống!', 'error');
        return;
      }
      payload = {
        type: 'text',
        caption: text,
        clientMutationId,
      };
    } else {
      navigate('/app/random');
      return;
    }

    sendBtn.disabled = true;
    sendBtn.innerHTML = `<span class="spinner" style="width:20px;height:20px;border-width:2px;border-color:#fff transparent transparent transparent;"></span> Đang gửi...`;

    try {
      const result = activeMode === 'photo'
        ? await createPhotoCheckinWithRetry(photoCaption, clientMutationId)
        : await createCheckin(payload);
      if (typeof result.streak === 'number') {
        const current = store.get();
        if (current.couple) {
          store.set({ couple: { ...current.couple, streak: result.streak } });
        }
      }
      
      // Success Heart Burst animation
      showHeartBurstEffect();
      showToast('Gửi check-in thành công!', 'success');

      if (activeMode === 'photo') {
        clearSelectedPhoto();
        photoCaption = '';
        selectedQuickMsg = null;
        renderContentForm();
      }
      
      setTimeout(() => {
        navigate('/app/home');
      }, 700);

    } catch (err) {
      logger.error('Failed to submit check-in', err);
      showToast((err as Error).message || 'Gửi check-in thất bại!', 'error');
      sendBtn.disabled = false;
      sendBtn.innerHTML = `Gửi ngay 💕`;
    }
  });

  // Helper for Heart Burst Effect
  function showHeartBurstEffect() {
    let burstContainer = document.getElementById('heart-burst-container');
    if (!burstContainer) {
      burstContainer = document.createElement('div');
      burstContainer.id = 'heart-burst-container';
      burstContainer.className = 'heart-burst-container';
      document.body.appendChild(burstContainer);
    }

    const rect = sendBtn.getBoundingClientRect();
    let x = rect.left + rect.width / 2;
    let y = rect.top + rect.height / 2;

    // Fallback to center of viewport if coordinates are invalid (0 or NaN)
    if (!x || !y || isNaN(x) || isNaN(y)) {
      x = window.innerWidth / 2;
      y = window.innerHeight / 2;
      logger.warn('[HeartBurst] Invalid button coordinates, falling back to viewport center:', { x, y, rect });
    } else {
      logger.info('[HeartBurst] Triggered at button coordinates:', { x, y, rect });
    }

    const particleCount = 18;
    const hearts = ["❤️", "💖", "💕", "🌸", "🥰"];

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle-heart';
      particle.textContent = hearts[Math.floor(Math.random() * hearts.length)];

      const angle = Math.random() * Math.PI * 2;
      const distance = 60 + Math.random() * 120;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance - 40; // bias upwards
      const scale = 0.5 + Math.random() * 0.8;
      const rot = -45 + Math.random() * 90;

      particle.style.setProperty('--tx', `${tx}px`);
      particle.style.setProperty('--ty', `${ty}px`);
      particle.style.setProperty('--scale', `${scale}`);
      particle.style.setProperty('--rot', `${rot}deg`);

      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;

      burstContainer.appendChild(particle);

      particle.addEventListener('animationend', () => {
        particle.remove();
      });
    }
  }

  // Inject Nav
  return root;
}
