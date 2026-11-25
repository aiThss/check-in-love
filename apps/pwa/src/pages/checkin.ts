import '../styles/20-pages/checkin.css';
import { navigate } from '../router';
import { invalidateRoutes } from '../route-invalidation';
import { createCheckin } from '../api/checkins';
import { ApiError } from '../api/client';
import { store } from '../store/index';
import { logger } from '../utils/logger';
import { showToast } from '../components/toast';
import { iconMarkup, type IconName } from '../ui/icons/icons';
import { createButton, createChip } from '../ui/primitives';
import { triggerHaptic } from '../ui/haptics';
import {
  openCamera,
  openGallery,
  processImage,
  revokePreviewUrl,
  type CameraResult,
} from '../components/camera';

const PHOTO_ASPECT_RATIO = 1;

const QUICK_MESSAGES = [
  'Đang nhớ người ấy ghê',
  'Đang ăn ngon nè, ước có anh/em',
  'Đang làm việc chăm chỉ lắm',
  'Hôm nay hơi mệt, cần một cái ôm',
  'Đang dạo phố chiều nay',
  'Có chuyện vui muốn kể ngay',
];

export function renderCheckinPage(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'page checkin-page p-checkin animate-fade-in';

  // Header with accessible SVG close button inside form fallback
  const header = document.createElement('header');
  header.className = 'p-checkin-header';
  header.innerHTML = `
    <form action="/app/home" method="get" style="display:flex;margin:0;">
      <button type="submit" id="back-btn" class="c-icon-btn" aria-label="Đóng">${iconMarkup('close', { size: 20 })}</button>
    </form>
    <div class="p-checkin-header__copy">
      <h1>Gửi khoảnh khắc</h1>
      <p>Lưu lại hiện tại của bạn cho người ấy</p>
    </div>
  `;
  root.appendChild(header);

  // Mode Selector Tabs (Zero system emojis — bespoke SVG icons)
  const tabsWrapper = document.createElement('div');
  tabsWrapper.className = 'p-checkin-tabs';
  tabsWrapper.setAttribute('role', 'tablist');
  tabsWrapper.setAttribute('aria-label', 'Chế độ gửi khoảnh khắc');

  const modes: Array<{ id: 'photo' | 'text' | 'random'; icon: IconName; label: string }> = [
    { id: 'photo', icon: 'camera', label: 'Ảnh' },
    { id: 'text', icon: 'edit', label: 'Lời nhắn' },
    { id: 'random', icon: 'dice', label: 'Bất ngờ' },
  ];

  let activeMode: 'photo' | 'text' | 'random' = 'photo';

  modes.forEach((mode) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(mode.id === activeMode));
    tab.className = `tab-btn p-checkin-tab${mode.id === activeMode ? ' active' : ''}`;
    tab.dataset.mode = mode.id;
    tab.innerHTML = `${iconMarkup(mode.icon, { size: 16, variant: mode.id === activeMode ? 'filled' : 'outline' })}<span>${mode.label}</span>`;
    tabsWrapper.appendChild(tab);
  });
  root.appendChild(tabsWrapper);

  // Content Stage Card
  const contentArea = document.createElement('div');
  contentArea.className = 'card p-checkin-card u-grain-surface';
  root.appendChild(contentArea);

  // Form State
  let selectedFile: File | null = null;
  let selectedSourceFile: File | null = null;
  let selectedPreviewUrl: string | null = null;
  let isProcessingPhoto = false;
  let photoCaption = '';
  let photoSurpriseText = '';
  let includeScratch = true;
  let selectedQuickMsg: string | null = null;

  function clearSelectedPhoto(): void {
    selectedSourceFile = null;
    selectedFile = null;
    revokePreviewUrl(selectedPreviewUrl);
    selectedPreviewUrl = null;
  }

  function navigateHomeFromCheckin(): void {
    const target = '/app/home';
    try {
      clearSelectedPhoto();
    } catch (error) {
      logger.warn('Failed to clear the selected check-in photo before closing', error);
    }

    try {
      navigate(target);
    } catch (error) {
      logger.error('Failed to navigate away from check-in', error);
      window.location.replace(target);
      return;
    }

    window.setTimeout(() => {
      if (window.location.pathname === '/app/checkin') window.location.replace(target);
    }, 0);
  }

  const closeCheckin = header.querySelector<HTMLButtonElement>('#back-btn');
  if (closeCheckin) {
    let closeRequested = false;
    const handleClose = (event: Event): void => {
      event.preventDefault();
      event.stopPropagation();
      if (closeRequested) return;
      closeRequested = true;
      navigateHomeFromCheckin();
    };
    closeCheckin.addEventListener('pointerup', handleClose);
    closeCheckin.addEventListener('click', handleClose);
  }

  async function applyPhotoTransform(sourceFile: File): Promise<void> {
    isProcessingPhoto = true;
    renderContentForm();

    try {
      const result = await processImage(sourceFile, {
        aspectRatio: PHOTO_ASPECT_RATIO,
        maxSize: 2048,
        quality: 0.9,
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
      revokePreviewUrl(rawPreview);
    });
  }

  function buildPhotoPayload(file: File, caption: string, clientMutationId: string): FormData {
    const fd = new FormData();
    fd.append('type', 'photo');
    fd.append('clientMutationId', clientMutationId);
    fd.append('includeScratch', includeScratch ? 'true' : 'false');
    fd.append('file', file, file.name || 'checkin-photo.jpg');
    if (caption) {
      fd.append('caption', caption);
    }
    if (includeScratch && photoSurpriseText.trim()) {
      fd.append('surpriseText', photoSurpriseText.trim());
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
      if (!(err instanceof ApiError) || err.code !== 'NETWORK_ERROR' || !selectedSourceFile) {
        throw err;
      }

      showToast('Mạng hơi yếu, đang thử bản ảnh gọn hơn...', 'info');
      const fallback = await processImage(selectedSourceFile, {
        aspectRatio: PHOTO_ASPECT_RATIO,
        maxSize: 1080,
        quality: 0.75,
      });

      revokePreviewUrl(selectedPreviewUrl);
      selectedFile = fallback.file;
      selectedPreviewUrl = fallback.preview;
      renderContentForm();

      return createCheckin(buildPhotoPayload(fallback.file, caption, clientMutationId));
    }
  }

  function renderPhotoForm(): void {
    const picker = document.createElement('div');
    picker.className = `photo-composer p-checkin-polaroid${selectedPreviewUrl ? ' has-photo' : ''}`;

    if (selectedPreviewUrl) {
      picker.innerHTML = `
        <img class="photo-composer-image p-checkin-polaroid__img" src="${selectedPreviewUrl}" alt="Ảnh check-in đã chọn" />
        <div class="p-checkin-polaroid__topbar">
          <button type="button" id="remove-photo" class="c-icon-btn" aria-label="Bỏ chọn ảnh">${iconMarkup('close', { size: 20 })}</button>
        </div>
        <div class="p-checkin-polaroid__actions">
          <button id="retake-photo" class="c-btn c-btn--secondary c-btn--sm c-btn--pill" type="button">${iconMarkup('camera', { size: 16 })}<span>Chụp lại</span></button>
          <button id="change-photo" class="c-btn c-btn--secondary c-btn--sm c-btn--pill" type="button">${iconMarkup('gallery', { size: 16 })}<span>Đổi ảnh</span></button>
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
        <div class="p-checkin-empty">
          <div class="p-checkin-empty__lens">${iconMarkup('polaroid', { size: 32, motion: 'pop' })}</div>
          <div class="p-checkin-empty__copy">
            <strong>Đang tráng ảnh Polaroid...</strong>
            <span>Đợi một nhịp cho ảnh sắc nét nhé</span>
          </div>
        </div>
      `;
    } else {
      picker.innerHTML = `
        <div class="photo-composer-empty p-checkin-empty">
          <div class="p-checkin-empty__lens">${iconMarkup('checkin-lens', { size: 32, variant: 'filled' })}</div>
          <div class="photo-composer-copy p-checkin-empty__copy">
            <strong>Gửi ảnh cho người ấy</strong>
            <span>Mở ống kính chụp mới hoặc chọn từ album</span>
          </div>
          <div class="photo-composer-actions" style="display:flex;gap:10px;margin-top:4px;">
            <button id="camera-photo" class="c-btn c-btn--primary c-btn--pill" type="button">${iconMarkup('camera', { size: 20 })}<span>Chụp ảnh</span></button>
            <button id="gallery-photo" class="c-btn c-btn--secondary c-btn--pill" type="button">${iconMarkup('gallery', { size: 20 })}<span>Album</span></button>
          </div>
        </div>
      `;

      picker.querySelector('#camera-photo')?.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerHaptic('tap');
        openCamera((res) => selectPhoto(res));
      });
      picker.querySelector('#gallery-photo')?.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerHaptic('tap');
        openGallery((res) => selectPhoto(res));
      });
    }

    contentArea.appendChild(picker);

    const capGroup = document.createElement('div');
    capGroup.className = 'c-field';
    capGroup.innerHTML = `
      <input
        type="text"
        id="caption-input"
        class="c-input"
        aria-label="Mô tả khoảnh khắc"
        placeholder="Viết vài dòng ngọt ngào..."
        maxlength="280"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="sentences"
        spellcheck="false"
        data-lpignore="true"
        data-form-type="other"
        data-1p-ignore="true"
      />
    `;
    const captionInput = capGroup.querySelector<HTMLInputElement>('#caption-input');
    if (captionInput) {
      captionInput.value = photoCaption;
      captionInput.addEventListener('input', () => {
        photoCaption = captionInput.value;
      });
    }
    contentArea.appendChild(capGroup);

    // Love Foil Scratch Toggle
    const scratchToggle = document.createElement('button');
    scratchToggle.type = 'button';
    scratchToggle.className = `checkin-scratch-toggle p-checkin-scratch${includeScratch ? ' is-on' : ''}`;
    scratchToggle.setAttribute('aria-pressed', String(includeScratch));
    scratchToggle.setAttribute('aria-expanded', String(includeScratch));
    scratchToggle.setAttribute('aria-controls', 'surprise-text-group');
    scratchToggle.innerHTML = `
      <span class="p-checkin-scratch__lead">
        ${iconMarkup('scratch-card', { size: 20, variant: includeScratch ? 'filled' : 'outline' })}
        <span>Lớp cào bất ngờ (Love Foil)</span>
      </span>
      <span class="p-checkin-scratch__pill">${includeScratch ? 'Đang bật' : 'Đang tắt'}</span>
    `;
    scratchToggle.addEventListener('click', () => {
      includeScratch = !includeScratch;
      triggerHaptic('select');
      renderContentForm();
    });
    contentArea.appendChild(scratchToggle);

    if (includeScratch) {
      const surpriseTextGroup = document.createElement('div');
      surpriseTextGroup.className = 'c-field checkin-scratch-message';
      surpriseTextGroup.id = 'surprise-text-group';
      surpriseTextGroup.innerHTML = `
        <input
          type="text"
          id="surprise-text-input"
          class="c-input"
          aria-label="Lời nhắn trên lớp cào"
          placeholder="Lời nhắn hiện trên lớp nhũ trước khi cào..."
          maxlength="120"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="sentences"
          spellcheck="false"
          data-lpignore="true"
          data-form-type="other"
          data-1p-ignore="true"
        />
      `;
      const surpriseTextInput = surpriseTextGroup.querySelector<HTMLInputElement>('#surprise-text-input');
      if (surpriseTextInput) {
        surpriseTextInput.value = photoSurpriseText;
        surpriseTextInput.addEventListener('input', () => {
          photoSurpriseText = surpriseTextInput.value;
        });
      }
      contentArea.appendChild(surpriseTextGroup);
    }

    const chipsWrapper = document.createElement('div');
    chipsWrapper.className = 'p-checkin-chips';
    QUICK_MESSAGES.forEach((msg) => {
      const chip = createChip({
        label: msg,
        selected: selectedQuickMsg === msg,
        interactive: true,
        onClick: () => {
          if (selectedQuickMsg === msg) {
            selectedQuickMsg = null;
          } else {
            selectedQuickMsg = msg;
            photoCaption = msg;
          }
          renderContentForm();
        },
      });
      chipsWrapper.appendChild(chip);
    });
    contentArea.appendChild(chipsWrapper);
  }

  function renderContentForm(): void {
    contentArea.replaceChildren();

    if (activeMode === 'photo') {
      renderPhotoForm();
      return;
    }

    if (activeMode === 'text') {
      const textGroup = document.createElement('div');
      textGroup.className = 'c-field';
      textGroup.innerHTML = `
        <label class="c-field__label" for="text-input">Viết đôi lời gửi người ấy</label>
        <textarea id="text-input" class="c-textarea" rows="5" placeholder="Hôm nay của bạn thế nào? Kể cho người ấy nghe nhé..." maxlength="280"></textarea>
      `;
      contentArea.appendChild(textGroup);

      const chipsWrapper = document.createElement('div');
      chipsWrapper.className = 'p-checkin-chips';
      QUICK_MESSAGES.forEach((msg) => {
        const chip = createChip({
          label: msg,
          interactive: true,
          onClick: () => {
            const textarea = contentArea.querySelector<HTMLTextAreaElement>('#text-input');
            if (textarea) {
              textarea.value = msg;
              textarea.focus();
            }
          },
        });
        chipsWrapper.appendChild(chip);
      });
      contentArea.appendChild(chipsWrapper);
      return;
    }

    const randomCard = document.createElement('div');
    randomCard.className = 'p-checkin-empty';
    randomCard.innerHTML = `
      <div class="p-checkin-empty__lens">${iconMarkup('dice', { size: 32, variant: 'filled' })}</div>
      <div class="p-checkin-empty__copy">
        <strong>Trò chơi & Gợi ý ngẫu nhiên</strong>
        <span>Bốc câu hỏi sâu sắc, thử thách dễ thương hoặc ý tưởng hẹn hò cho hai bạn.</span>
      </div>
    `;
    randomCard.appendChild(
      createButton({
        label: 'Mở hộp Bất ngờ',
        variant: 'primary',
        pill: true,
        leadingIcon: 'sparkle',
        onClick: () => navigate('/app/random'),
      }).element,
    );
    contentArea.appendChild(randomCard);
  }

  tabsWrapper.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.tab-btn');
    if (!btn) return;
    const mode = btn.dataset.mode as 'photo' | 'text' | 'random' | undefined;
    if (!mode || mode === activeMode) return;

    activeMode = mode;
    triggerHaptic('select');
    tabsWrapper.querySelectorAll<HTMLButtonElement>('.tab-btn').forEach((b) => {
      const m = b.dataset.mode as 'photo' | 'text' | 'random';
      const isAct = m === activeMode;
      b.classList.toggle('active', isAct);
      b.setAttribute('aria-selected', String(isAct));
      const modeDef = modes.find((item) => item.id === m);
      if (modeDef) {
        b.innerHTML = `${iconMarkup(modeDef.icon, { size: 16, variant: isAct ? 'filled' : 'outline' })}<span>${modeDef.label}</span>`;
      }
    });

    renderContentForm();
  });

  renderContentForm();

  // Sticky Primary Send Button
  const sendBtn = document.createElement('button');
  sendBtn.type = 'button';
  sendBtn.className = 'c-btn c-btn--primary c-btn--lg p-checkin-submit';

  function resetSendButton(): void {
    sendBtn.disabled = false;
    sendBtn.innerHTML = `${iconMarkup('send', { size: 20 })}<span>Gửi ngay cho người ấy</span>`;
  }
  resetSendButton();
  root.appendChild(sendBtn);

  function setSendProgressState(label: string): void {
    sendBtn.disabled = true;
    sendBtn.innerHTML = `
      <svg class="p-checkin-ring" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke-opacity="0.25"></circle>
        <path d="M12 3a9 9 0 0 1 9 9" stroke-linecap="round"></path>
      </svg>
      <span>${label}</span>
    `;
  }

  sendBtn.addEventListener('click', async () => {
    let payload: FormData | Record<string, unknown>;
    const clientMutationId = `checkin:${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;

    if (activeMode === 'photo') {
      if (isProcessingPhoto) {
        showToast('Ảnh đang được chuẩn bị, chờ một nhịp nhé.', 'info');
        return;
      }
      if (!selectedFile) {
        showToast('Hãy chụp hoặc chọn một tấm ảnh trước nhé!', 'error');
        return;
      }
      const caption = root.querySelector<HTMLInputElement>('#caption-input')?.value.trim();
      photoCaption = caption ?? '';
      payload = buildPhotoPayload(selectedFile, photoCaption, clientMutationId);
    } else if (activeMode === 'text') {
      const text = root.querySelector<HTMLTextAreaElement>('#text-input')?.value.trim();
      if (!text) {
        showToast('Nội dung lời nhắn chưa được nhập!', 'error');
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

    setSendProgressState('Đang gửi khoảnh khắc...');

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

      triggerHaptic('confirm');
      showHeartBurstEffect();
      showToast('Đã gửi khoảnh khắc thành công!', 'success');

      if (activeMode === 'photo') {
        clearSelectedPhoto();
        photoCaption = '';
        photoSurpriseText = '';
        includeScratch = true;
        selectedQuickMsg = null;
        renderContentForm();
      }
      resetSendButton();
      invalidateRoutes('/app/checkin');

      setTimeout(() => {
        navigate('/app/home');
      }, 650);
    } catch (err) {
      logger.error('Failed to submit check-in', err);
      showToast((err as Error).message || 'Gửi check-in thất bại!', 'error');
      resetSendButton();
    }
  });

  // Bespoke SVG Heart-Burst Celebration (<= 2KB, respects reduced-motion)
  function showHeartBurstEffect(): void {
    if (document.documentElement.getAttribute('data-reduced-motion') === 'true') return;

    let burstContainer = document.getElementById('heart-burst-container');
    if (!burstContainer) {
      burstContainer = document.createElement('div');
      burstContainer.id = 'heart-burst-container';
      burstContainer.className = 'p-heart-burst-layer';
      document.body.appendChild(burstContainer);
    }

    const rect = sendBtn.getBoundingClientRect();
    let x = rect.left + rect.width / 2;
    let y = rect.top + rect.height / 2;
    if (!x || !y || Number.isNaN(x) || Number.isNaN(y)) {
      x = window.innerWidth / 2;
      y = window.innerHeight / 2;
    }

    const svgIcons: IconName[] = ['heart', 'heart-burst', 'sparkle'];
    for (let i = 0; i < 14; i++) {
      const particle = document.createElement('div');
      particle.className = 'p-burst-svg';
      const chosen = svgIcons[i % svgIcons.length];
      particle.innerHTML = iconMarkup(chosen, { size: 20, variant: 'filled' });

      const angle = (Math.PI * 2 * i) / 14 + (Math.random() - 0.5) * 0.35;
      const distance = 64 + Math.random() * 110;
      const tx = Math.round(Math.cos(angle) * distance);
      const ty = Math.round(Math.sin(angle) * distance - 44);
      const scale = (0.65 + Math.random() * 0.65).toFixed(2);
      const rot = Math.round(-36 + Math.random() * 72);

      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.style.setProperty('--tx', `${tx}px`);
      particle.style.setProperty('--ty', `${ty}px`);
      particle.style.setProperty('--scale', scale);
      particle.style.setProperty('--rot', `${rot}deg`);

      burstContainer.appendChild(particle);
      particle.addEventListener('animationend', () => particle.remove(), { once: true });
    }
  }

  return root;
}
