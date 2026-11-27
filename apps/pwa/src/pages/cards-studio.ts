import '../styles/20-pages/cards-fan-deck.css';
import '../styles/20-pages/cards-studio.css';
import {
  deleteAuthoredOccasionCard,
  getOccasionCardsDashboard,
  saveAuthoredOccasionCard,
  uploadOccasionCardAsset,
  type AuthoredOccasionCard,
  type OccasionCardsDashboardResponse,
  type ReceivedOccasionCardEntry,
} from '../api/occasion-cards';
import { processImage } from '../components/camera';
import { showToast } from '../components/toast';
import { navigate } from '../router';
import { store } from '../store/index';
import { createEmptyState, createSkeleton } from '../ui/feedback';
import { createSegmentedControl, createSwitch } from '../ui/forms';
import { triggerHaptic } from '../ui/haptics';
import { iconMarkup } from '../ui/icons/icons';
import { openSheet } from '../ui/overlays';
import { createButton } from '../ui/primitives';
import {
  buildBuiltinOccasionCard,
  openOccasionCardModal,
  toOccasionCardFromServer,
  type OccasionCard,
} from '../utils/anniversary-cards';
import {
  CARD_TEMPLATE_DECKS,
  OCCASION_CATALOG,
  type BuiltinOccasionKey,
  type CardTemplatePreset,
  type OccasionCatalogEntry,
  type OccasionPattern,
} from '../utils/occasion-catalog';

function escapeHtml(value: string | undefined): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

interface FanDeckController {
  element: HTMLElement;
  getSelectedTemplate: () => CardTemplatePreset | null;
}

function createCinemaFanDeck(options: {
  initialTemplateId?: string;
  confirmLabel?: (preset: CardTemplatePreset) => string;
  onConfirmPreset: (preset: CardTemplatePreset) => void;
}): FanDeckController {
  const deckTitles = ['Lãng Mạn', 'Lễ & Sắc Việt', 'Tinh Vân'];
  const initialPreset = CARD_TEMPLATE_DECKS.find((t) => t.id === options.initialTemplateId);
  let activeDeck = initialPreset?.deckIndex ?? 0;
  let liftedId: string | null = initialPreset?.id ?? null;

  const root = document.createElement('section');
  root.className = 'p-fan-stage';

  const head = document.createElement('div');
  head.className = 'p-fan-stage__head';
  head.innerHTML = `
    <div class="p-fan-stage__copy">
      <strong>Bộ bài mẫu thiệp nghệ thuật</strong>
      <span>Chạm vào 1 lá để rút bài lên, bấm xác nhận để chọn mẫu</span>
    </div>
  `;
  root.appendChild(head);

  const deckTabs = document.createElement('div');
  deckTabs.className = 'p-fan-deck-tabs';
  deckTabs.setAttribute('role', 'tablist');
  deckTabs.setAttribute('aria-label', 'Bộ sưu tập mẫu thiệp');
  root.appendChild(deckTabs);

  const hand = document.createElement('div');
  hand.className = 'p-fan-hand';
  root.appendChild(hand);

  const confirmBar = document.createElement('div');
  confirmBar.className = 'p-fan-confirm-bar';
  root.appendChild(confirmBar);

  function renderDeck(): void {
    deckTabs.replaceChildren();
    deckTitles.forEach((title, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `p-fan-deck-pill${idx === activeDeck ? ' is-active' : ''}`;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', String(idx === activeDeck));
      btn.textContent = title;
      btn.addEventListener('click', () => {
        if (activeDeck === idx) return;
        activeDeck = idx;
        liftedId = null;
        triggerHaptic('select');
        renderDeck();
      });
      deckTabs.appendChild(btn);
    });

    const cards = CARD_TEMPLATE_DECKS.filter((item) => item.deckIndex === activeDeck);
    hand.replaceChildren();
    hand.classList.toggle('has-selection', Boolean(liftedId && cards.some((c) => c.id === liftedId)));

    cards.forEach((preset, slot) => {
      const isLifted = preset.id === liftedId;
      const cardBtn = document.createElement('button');
      cardBtn.type = 'button';
      cardBtn.className = `p-fan-card${isLifted ? ' is-lifted' : ''}`;
      cardBtn.dataset.slot = String(slot);
      cardBtn.dataset.templateId = preset.id;
      cardBtn.setAttribute('aria-pressed', String(isLifted));
      cardBtn.setAttribute('aria-label', `Mẫu thiệp ${preset.name}`);
      cardBtn.style.background = `linear-gradient(150deg, ${preset.colors[0]}, ${preset.colors[1]} 54%, ${preset.colors[2]})`;
      cardBtn.innerHTML = `
        <span class="p-fan-card__badge">${escapeHtml(preset.badge)}</span>
        <span class="p-fan-card__crest">${iconMarkup(preset.icon, { size: 20, variant: 'filled' })}</span>
        <div>
          <div class="p-fan-card__title">${escapeHtml(preset.name)}</div>
          <div class="p-fan-card__sub">${escapeHtml(preset.subtitle)}</div>
        </div>
      `;
      cardBtn.addEventListener('click', () => {
        if (liftedId === preset.id) {
          triggerHaptic('confirm');
          options.onConfirmPreset(preset);
          return;
        }
        liftedId = preset.id;
        triggerHaptic('select');
        renderDeck();
      });
      hand.appendChild(cardBtn);
    });

    confirmBar.replaceChildren();
    const liftedPreset = cards.find((c) => c.id === liftedId) ?? null;
    if (liftedPreset) {
      const confirmBtn = createButton({
        label: options.confirmLabel ? options.confirmLabel(liftedPreset) : `Xác nhận chọn "${liftedPreset.name}"`,
        variant: 'primary',
        size: 'sm',
        pill: true,
        leadingIcon: 'check',
        onClick: () => {
          triggerHaptic('confirm');
          options.onConfirmPreset(liftedPreset);
        },
      });
      confirmBtn.element.classList.add('p-fan-confirm-btn');
      confirmBar.appendChild(confirmBtn.element);
    } else {
      const hint = document.createElement('span');
      hint.className = 'p-fan-confirm-hint';
      hint.textContent = 'Chạm vào 1 trong 3 lá bài trên để xem & xác nhận chọn';
      confirmBar.appendChild(hint);
    }
  }

  renderDeck();

  return {
    element: root,
    getSelectedTemplate: () => CARD_TEMPLATE_DECKS.find((t) => t.id === liftedId) ?? null,
  };
}

export function renderCardsStudioPage(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'page p-cards-studio animate-fade-in';

  const initialTab = new URLSearchParams(window.location.search).get('tab') === 'studio'
    ? 'studio'
    : 'album';
  let activeTab: 'album' | 'studio' = initialTab;
  let dashboard: OccasionCardsDashboardResponse = {
    authoredCards: [],
    receivedAlbum: [],
    upcomingOccasion: null,
  };
  let loading = true;

  const user = store.get().user;
  const senderName = user?.displayName || 'Bạn';
  const partnerName = user?.partnerName || 'Người ấy';

  // Header
  const header = document.createElement('header');
  header.className = 'p-cards-header';
  header.innerHTML = `
    <button type="button" class="c-icon-btn" id="cards-back-btn" aria-label="Quay lại Hồ sơ">
      ${iconMarkup('back', { size: 20 })}
    </button>
    <div class="p-cards-header__copy">
      <h1>Hộp thiệp bí mật</h1>
      <p>Lưu giữ thiệp kỷ niệm & chuẩn bị bất ngờ cho ${escapeHtml(partnerName)}</p>
    </div>
  `;
  header.querySelector('#cards-back-btn')?.addEventListener('click', () => navigate('/app/profile'));
  root.appendChild(header);

  const tabSwitcher = createSegmentedControl<'album' | 'studio'>({
    ariaLabel: 'Chế độ Hộp thiệp bí mật',
    value: activeTab,
    fullWidth: true,
    items: [
      { value: 'album', label: 'Album đã nhận' },
      { value: 'studio', label: `Xưởng tặng ${partnerName}` },
    ],
    onChange: (next) => {
      activeTab = next;
      triggerHaptic('select');
      renderBody();
    },
  });
  root.appendChild(tabSwitcher.element);

  const stageHost = document.createElement('div');
  stageHost.className = 'u-stack-4';
  root.appendChild(stageHost);

  async function refreshDashboard(): Promise<void> {
    loading = true;
    renderBody();
    try {
      dashboard = await getOccasionCardsDashboard();
    } catch {
      showToast('Chưa tải được dữ liệu hộp thiệp, thử lại sau nhé', 'error');
    } finally {
      loading = false;
      renderBody();
    }
  }

  function renderAlbumView(): void {
    if (dashboard.upcomingOccasion) {
      const up = dashboard.upcomingOccasion;
      const banner = document.createElement('section');
      banner.className = 'p-cards-countdown';
      banner.innerHTML = `
        <div class="p-cards-countdown__copy">
          <span class="p-cards-countdown__eyebrow">Đếm ngược ngày đặc biệt</span>
          <strong class="p-cards-countdown__title">${escapeHtml(up.label)}</strong>
        </div>
        <span class="p-cards-countdown__pill">Còn ${up.daysLeft} ngày</span>
      `;
      stageHost.appendChild(banner);
    }

    if (dashboard.receivedAlbum.length === 0) {
      const empty = createEmptyState({
        illustration: 'memories',
        title: 'Chưa có thiệp nào mở khóa',
        description: `Để giữ trọn bất ngờ, các tấm thiệp ${partnerName} dành tặng bạn sẽ chỉ tự động xuất hiện đúng 00:00 ngày đặc biệt!`,
        action: {
          label: `Sang Xưởng làm thiệp tặng ${partnerName}`,
          onClick: () => {
            activeTab = 'studio';
            tabSwitcher.setValue('studio');
            renderBody();
          },
        },
      });
      stageHost.appendChild(empty);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'p-album-grid';

    dashboard.receivedAlbum.forEach((entry: ReceivedOccasionCardEntry) => {
      const card = toOccasionCardFromServer(entry.card);
      const itemBtn = document.createElement('button');
      itemBtn.type = 'button';
      itemBtn.className = 'p-album-card';
      itemBtn.setAttribute('aria-label', `Mở lại thiệp ${card.title}`);
      itemBtn.style.background = card.backgroundImageUrl
        ? `linear-gradient(180deg, rgba(20,8,22,0.28), rgba(20,8,22,0.78)), url('${card.backgroundImageUrl}') center/cover`
        : `linear-gradient(150deg, ${card.colors[0]}, ${card.colors[1]} 55%, ${card.colors[2]})`;
      itemBtn.innerHTML = `
        <span class="p-album-card__date">${escapeHtml(entry.dateKey)}</span>
        <div class="p-album-card__body">
          <strong>${escapeHtml(card.title)}</strong>
          <small>${escapeHtml(entry.card.occasionLabel)}</small>
        </div>
      `;
      itemBtn.addEventListener('click', () => {
        triggerHaptic('tap');
        openOccasionCardModal(card, { skipScratch: true });
      });
      grid.appendChild(itemBtn);
    });

    stageHost.appendChild(grid);
  }

  function openCardEditor(params: {
    builtin?: OccasionCatalogEntry;
    existing?: AuthoredOccasionCard;
    preselectedTemplate?: CardTemplatePreset;
  }): void {
    const builtin = params.builtin;
    const existing = params.existing;
    const isCustomOccasion = !builtin;

    const occasionKey = existing?.occasionKey ?? builtin?.key ?? `custom-${Date.now()}`;
    const defaults = builtin
      ? builtin.defaultCopy({
          recipientName: partnerName,
          senderName,
          yearsTogether: 1,
        })
      : {
          eyebrow: 'Món quà bất ngờ dành riêng bạn',
          title: `Gửi ${partnerName} thương yêu`,
          message: '',
          signature: `Thương nhiều — ${senderName}.`,
          coverText: 'Cào nhẹ để mở bí mật dành riêng cho bạn',
        };

    let selectedColors: [string, string, string] =
      params.preselectedTemplate?.colors
      ?? existing?.colors
      ?? builtin?.colors
      ?? ['#ff8fb1', '#ff5f8f', '#9f3564'];
    let selectedPattern: OccasionPattern =
      params.preselectedTemplate?.pattern
      ?? existing?.pattern
      ?? builtin?.pattern
      ?? 'hearts';
    let selectedTemplateId: string | undefined =
      params.preselectedTemplate?.id ?? existing?.templateId;

    let scratchCoverUrl = existing?.scratchCoverUrl ?? '';
    let scratchCoverStoragePath = existing?.scratchCoverStoragePath ?? '';
    let backgroundImageUrl = existing?.backgroundImageUrl ?? '';
    let backgroundStoragePath = existing?.backgroundStoragePath ?? '';
    let cardEnabled = existing ? existing.enabled : true;

    const form = document.createElement('div');
    form.className = 'p-card-editor';

    // Enable toggle
    const enableRow = document.createElement('div');
    enableRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border-radius:14px;background:var(--bg-canvas);';
    enableRow.innerHTML = `
      <div>
        <strong style="display:block;font-size:13px;">Kích hoạt gửi dịp này</strong>
        <span class="u-text-secondary" style="font-size:11px;">Tự động mở trên máy ${escapeHtml(partnerName)} đúng ngày</span>
      </div>
    `;
    const enableSwitch = createSwitch({
      ariaLabel: 'Kích hoạt gửi thiệp dịp này',
      checked: cardEnabled,
      onChange: (on) => {
        cardEnabled = on;
      },
    });
    enableRow.appendChild(enableSwitch.element);
    form.appendChild(enableRow);

    // Custom date fields if custom occasion
    const todayIso = new Date().toISOString().slice(0, 10);
    let customLabelInput: HTMLInputElement | null = null;
    let customDateInput: HTMLInputElement | null = null;
    let scheduleSelect: HTMLSelectElement | null = null;

    if (isCustomOccasion) {
      const customFields = document.createElement('div');
      customFields.className = 'u-stack-2';
      customFields.innerHTML = `
        <div>
          <label class="c-field__label" for="custom-occ-label" style="font-size:11px;">Tên dịp đặc biệt</label>
          <input id="custom-occ-label" class="c-input" maxlength="80" placeholder="Ví dụ: Ngày đầu tiên nắm tay, Chuyến đi Đà Lạt..." value="${escapeHtml(existing?.occasionLabel ?? '')}" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div>
            <label class="c-field__label" for="custom-occ-date" style="font-size:11px;">Ngày mở khóa</label>
            <input id="custom-occ-date" type="date" class="c-input" value="${escapeHtml(existing?.customDate?.slice(0, 10) || todayIso)}" />
          </div>
          <div>
            <label class="c-field__label" for="custom-occ-repeat" style="font-size:11px;">Chu kỳ</label>
            <select id="custom-occ-repeat" class="c-input">
              <option value="once"${existing?.scheduleType !== 'annual' ? ' selected' : ''}>Một lần duy nhất</option>
              <option value="annual"${existing?.scheduleType === 'annual' ? ' selected' : ''}>Lặp lại hàng năm</option>
            </select>
          </div>
        </div>
      `;
      customLabelInput = customFields.querySelector('#custom-occ-label');
      customDateInput = customFields.querySelector('#custom-occ-date');
      scheduleSelect = customFields.querySelector('#custom-occ-repeat');
      form.appendChild(customFields);
    }

    // 3-Card Cinema Fan Deck inside Editor
    const editorDeck = createCinemaFanDeck({
      initialTemplateId: selectedTemplateId,
      confirmLabel: (preset) => `Áp dụng mẫu "${preset.name}"`,
      onConfirmPreset: (preset) => {
        selectedTemplateId = preset.id;
        selectedColors = preset.colors;
        selectedPattern = preset.pattern;
        showToast(`Đã áp dụng mẫu "${preset.name}"!`, 'success');
      },
    });
    form.appendChild(editorDeck.element);

    // Custom Image Uploads: Scratch Cover & Inner Background
    const uploadWrap = document.createElement('div');
    uploadWrap.innerHTML = `<span class="c-field__label" style="display:block;font-size:11px;margin-bottom:6px;">Ảnh riêng cho Lớp cào & Nền thiệp (Tùy chọn)</span>`;
    const uploadGrid = document.createElement('div');
    uploadGrid.className = 'p-card-upload-grid';

    const scratchInput = document.createElement('input');
    scratchInput.type = 'file';
    scratchInput.accept = 'image/*';
    scratchInput.hidden = true;

    const bgInput = document.createElement('input');
    bgInput.type = 'file';
    bgInput.accept = 'image/*';
    bgInput.hidden = true;

    const scratchBox = document.createElement('button');
    scratchBox.type = 'button';
    scratchBox.className = 'p-card-upload-box';
    scratchBox.setAttribute('aria-label', 'Tải ảnh lớp nhũ cào');

    const bgBox = document.createElement('button');
    bgBox.type = 'button';
    bgBox.className = 'p-card-upload-box';
    bgBox.setAttribute('aria-label', 'Tải ảnh nền bên trong thiệp');

    const syncUploadBoxes = () => {
      scratchBox.classList.toggle('has-img', Boolean(scratchCoverUrl));
      scratchBox.style.backgroundImage = scratchCoverUrl ? `url('${scratchCoverUrl}')` : '';
      scratchBox.innerHTML = `
        ${iconMarkup('scratch-card', { size: 20, variant: scratchCoverUrl ? 'filled' : 'outline' })}
        <strong>${scratchCoverUrl ? 'Đã có ảnh lớp cào' : 'Ảnh lớp cào'}</strong>
        <small>${scratchCoverUrl ? 'Chạm để đổi ảnh khác' : 'Tải ảnh che mặt trước'}</small>
      `;

      bgBox.classList.toggle('has-img', Boolean(backgroundImageUrl));
      bgBox.style.backgroundImage = backgroundImageUrl ? `url('${backgroundImageUrl}')` : '';
      bgBox.innerHTML = `
        ${iconMarkup('gallery', { size: 20, variant: backgroundImageUrl ? 'filled' : 'outline' })}
        <strong>${backgroundImageUrl ? 'Đã có ảnh nền' : 'Ảnh nền thiệp'}</strong>
        <small>${backgroundImageUrl ? 'Chạm để đổi ảnh khác' : 'Tải ảnh nền bên trong'}</small>
      `;
    };
    syncUploadBoxes();

    const handleAssetPick = async (file: File, kind: 'scratch' | 'bg') => {
      showToast('Đang tải ảnh lên...', 'info');
      try {
        const processed = await processImage(file, { maxSize: 1800, quality: 0.88 });
        const uploaded = await uploadOccasionCardAsset(processed.file);
        if (kind === 'scratch') {
          scratchCoverUrl = uploaded.url;
          scratchCoverStoragePath = uploaded.storagePath;
        } else {
          backgroundImageUrl = uploaded.url;
          backgroundStoragePath = uploaded.storagePath;
        }
        syncUploadBoxes();
        showToast('Đã cập nhật ảnh thiệp!', 'success');
      } catch (err) {
        showToast('Không tải được ảnh: ' + (err as Error).message, 'error');
      }
    };

    scratchBox.addEventListener('click', () => scratchInput.click());
    bgBox.addEventListener('click', () => bgInput.click());
    scratchInput.addEventListener('change', () => {
      const f = scratchInput.files?.[0];
      if (f) void handleAssetPick(f, 'scratch');
      scratchInput.value = '';
    });
    bgInput.addEventListener('change', () => {
      const f = bgInput.files?.[0];
      if (f) void handleAssetPick(f, 'bg');
      bgInput.value = '';
    });

    uploadGrid.append(scratchBox, bgBox);
    uploadWrap.append(scratchInput, bgInput, uploadGrid);

    const clearImgRow = document.createElement('div');
    clearImgRow.style.cssText = 'display:flex;gap:8px;margin-top:6px;';
    const clearScratchBtn = document.createElement('button');
    clearScratchBtn.type = 'button';
    clearScratchBtn.className = 'c-btn c-btn--ghost c-btn--sm';
    clearScratchBtn.textContent = 'Xoá ảnh lớp cào';
    clearScratchBtn.addEventListener('click', () => {
      scratchCoverUrl = '';
      scratchCoverStoragePath = '';
      syncUploadBoxes();
    });
    const clearBgBtn = document.createElement('button');
    clearBgBtn.type = 'button';
    clearBgBtn.className = 'c-btn c-btn--ghost c-btn--sm';
    clearBgBtn.textContent = 'Xoá ảnh nền';
    clearBgBtn.addEventListener('click', () => {
      backgroundImageUrl = '';
      backgroundStoragePath = '';
      syncUploadBoxes();
    });
    clearImgRow.append(clearScratchBtn, clearBgBtn);
    uploadWrap.appendChild(clearImgRow);
    form.appendChild(uploadWrap);

    // Text fields
    const textWrap = document.createElement('div');
    textWrap.className = 'u-stack-2';
    textWrap.innerHTML = `
      <div>
        <label class="c-field__label" for="card-cover-input" style="font-size:11px;">Lời dẫn ngoài lớp nhũ cào</label>
        <input id="card-cover-input" class="c-input" maxlength="120" value="${escapeHtml(existing?.coverText ?? defaults.coverText)}" />
      </div>
      <div>
        <label class="c-field__label" for="card-eyebrow-input" style="font-size:11px;">Dòng mở đầu nhỏ</label>
        <input id="card-eyebrow-input" class="c-input" maxlength="90" value="${escapeHtml(existing?.eyebrow ?? defaults.eyebrow)}" />
      </div>
      <div>
        <label class="c-field__label" for="card-title-input" style="font-size:11px;">Tiêu đề chính</label>
        <input id="card-title-input" class="c-input" maxlength="120" value="${escapeHtml(existing?.title ?? defaults.title)}" />
      </div>
      <div>
        <label class="c-field__label" for="card-msg-input" style="font-size:11px;">Tâm thư gửi ${escapeHtml(partnerName)}</label>
        <textarea id="card-msg-input" class="c-textarea" rows="4" maxlength="1200" placeholder="Viết lời chúc từ tận đáy lòng...">${escapeHtml(existing?.message ?? defaults.message)}</textarea>
      </div>
      <div>
        <label class="c-field__label" for="card-sig-input" style="font-size:11px;">Chữ ký cuối thư</label>
        <input id="card-sig-input" class="c-input" maxlength="90" value="${escapeHtml(existing?.signature ?? defaults.signature)}" />
      </div>
    `;
    form.appendChild(textWrap);

    const coverInput = textWrap.querySelector<HTMLInputElement>('#card-cover-input')!;
    const eyebrowInput = textWrap.querySelector<HTMLInputElement>('#card-eyebrow-input')!;
    const titleInput = textWrap.querySelector<HTMLInputElement>('#card-title-input')!;
    const msgInput = textWrap.querySelector<HTMLTextAreaElement>('#card-msg-input')!;
    const sigInput = textWrap.querySelector<HTMLInputElement>('#card-sig-input')!;

    const buildDraftPreviewCard = (): OccasionCard => ({
      id: occasionKey,
      occasionKey,
      coverText: coverInput.value.trim() || defaults.coverText,
      eyebrow: eyebrowInput.value.trim() || defaults.eyebrow,
      title: titleInput.value.trim() || defaults.title,
      message: msgInput.value.trim() || defaults.message || `Gửi trọn yêu thương đến ${partnerName}!`,
      signature: sigInput.value.trim() || defaults.signature,
      icon: builtin?.icon ?? 'gift',
      pattern: selectedPattern,
      colors: selectedColors,
      coverImage: scratchCoverUrl || builtin?.coverImage,
      scratchCoverUrl: scratchCoverUrl || undefined,
      backgroundImageUrl: backgroundImageUrl || undefined,
    });

    let closeEditorSheet = () => {};
    const actionsRow = document.createElement('div');
    actionsRow.className = 'p-card-editor-actions';

    const previewDraftBtn = createButton({
      label: 'Cào thử bản nháp',
      variant: 'secondary',
      size: 'sm',
      pill: true,
      leadingIcon: 'scratch-card',
      onClick: () => {
        triggerHaptic('tap');
        openOccasionCardModal(buildDraftPreviewCard(), { isDraftPreview: true });
      },
    });

    const saveBtn = createButton({
      label: 'Lưu thiệp bí mật',
      variant: 'primary',
      size: 'sm',
      pill: true,
      leadingIcon: 'check',
      onClick: async () => {
        if (isCustomOccasion && !customDateInput?.value) {
          showToast('Vui lòng chọn ngày mở thiệp!', 'error');
          return;
        }
        saveBtn.setLoading(true, 'Đang lưu...');
        try {
          await saveAuthoredOccasionCard(occasionKey, {
            kind: isCustomOccasion ? 'custom' : 'builtin',
            enabled: cardEnabled,
            scheduleType: isCustomOccasion
              ? ((scheduleSelect?.value as 'once' | 'annual') || 'once')
              : 'builtin',
            customDate: isCustomOccasion ? (customDateInput?.value || null) : null,
            occasionLabel: isCustomOccasion
              ? (customLabelInput?.value.trim() || `Bất ngờ tặng ${partnerName}`)
              : (builtin?.label ?? null),
            coverText: coverInput.value.trim() || null,
            eyebrow: eyebrowInput.value.trim() || null,
            title: titleInput.value.trim() || null,
            message: msgInput.value.trim() || null,
            signature: sigInput.value.trim() || null,
            templateId: selectedTemplateId ?? null,
            pattern: selectedPattern,
            colors: selectedColors,
            scratchCoverUrl: scratchCoverUrl || null,
            scratchCoverStoragePath: scratchCoverStoragePath || null,
            backgroundImageUrl: backgroundImageUrl || null,
            backgroundStoragePath: backgroundStoragePath || null,
          });
          showToast(`Đã lưu thiệp bí mật dành tặng ${partnerName}!`, 'success');
          closeEditorSheet();
          void refreshDashboard();
        } catch (err) {
          showToast('Không lưu được thiệp: ' + (err as Error).message, 'error');
        } finally {
          saveBtn.setLoading(false);
        }
      },
    });

    actionsRow.append(previewDraftBtn.element, saveBtn.element);

    if (existing) {
      const resetBtn = createButton({
        label: isCustomOccasion ? 'Xoá thiệp này' : 'Về mặc định',
        variant: 'danger',
        size: 'sm',
        pill: true,
        onClick: async () => {
          resetBtn.setLoading(true, 'Đang xoá...');
          try {
            await deleteAuthoredOccasionCard(occasionKey);
            showToast(isCustomOccasion ? 'Đã xoá thiệp tự chọn' : 'Đã khôi phục mẫu mặc định', 'info');
            closeEditorSheet();
            void refreshDashboard();
          } catch (err) {
            showToast('Lỗi: ' + (err as Error).message, 'error');
          } finally {
            resetBtn.setLoading(false);
          }
        },
      });
      actionsRow.appendChild(resetBtn.element);
    }

    form.appendChild(actionsRow);

    closeEditorSheet = openSheet({
      title: builtin ? `Soạn thiệp: ${builtin.label}` : 'Tạo thiệp ngày tự chọn',
      content: form,
    }).close;
  }

  function renderStudioView(): void {
    const byKey = new Map(dashboard.authoredCards.map((c) => [c.occasionKey, c]));

    // 1. Cinema 3-Card Fan Deck Showcase at top of Studio
    const showcaseDeck = createCinemaFanDeck({
      confirmLabel: (preset) => `Dùng mẫu "${preset.name}" tạo thiệp mới`,
      onConfirmPreset: (preset) => {
        openCardEditor({ preselectedTemplate: preset });
      },
    });
    stageHost.appendChild(showcaseDeck.element);

    // 2. Custom Date Occasions Section + Create Button
    const customSection = document.createElement('section');
    customSection.className = 'p-studio-group';
    const customHead = document.createElement('div');
    customHead.className = 'p-studio-group__head';
    customHead.innerHTML = `<span class="p-studio-group__label">Thiệp ngày tự chọn của bạn</span>`;
    customHead.appendChild(
      createButton({
        label: '+ Tạo ngày đặc biệt',
        variant: 'primary',
        size: 'sm',
        pill: true,
        onClick: () => openCardEditor({}),
      }).element,
    );
    customSection.appendChild(customHead);

    const customCards = dashboard.authoredCards.filter((c) => c.kind === 'custom');
    if (customCards.length > 0) {
      const customList = document.createElement('div');
      customList.className = 'p-studio-list';
      customCards.forEach((c) => {
        const colors = c.colors ?? ['#ff8fb1', '#ff5f8f', '#9f3564'];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `p-studio-item${c.enabled ? ' is-customized' : ''}`;
        btn.innerHTML = `
          <div class="p-studio-item__lead">
            <span class="p-studio-item__swatch" style="background:linear-gradient(135deg,${colors[0]},${colors[1]});">
              ${iconMarkup('gift', { size: 20, variant: 'filled' })}
            </span>
            <div class="p-studio-item__copy">
              <strong>${escapeHtml(c.occasionLabel || c.title || 'Thiệp bất ngờ')}</strong>
              <small>${escapeHtml(c.customDate || '')} · ${c.scheduleType === 'annual' ? 'Hàng năm' : 'Một lần'}</small>
            </div>
          </div>
          <span class="p-studio-badge ${c.enabled ? 'p-studio-badge--custom' : 'p-studio-badge--off'}">${c.enabled ? 'Đã hẹn ngày' : 'Đang tắt'}</span>
        `;
        btn.addEventListener('click', () => openCardEditor({ existing: c }));
        customList.appendChild(btn);
      });
      customSection.appendChild(customList);
    }
    stageHost.appendChild(customSection);

    // 3. Built-in Categorized 20 Occasions
    const groups: Array<{ id: OccasionCatalogEntry['category']; title: string }> = [
      { id: 'milestone', title: 'Sinh nhật & Cột mốc tình yêu' },
      { id: 'lunar', title: 'Lễ cổ truyền Âm lịch Việt Nam' },
      { id: 'vietnam', title: 'Ngày lễ Việt Nam & Dịp hẹn hò' },
    ];

    groups.forEach((grp) => {
      const sec = document.createElement('section');
      sec.className = 'p-studio-group';
      sec.innerHTML = `
        <div class="p-studio-group__head">
          <span class="p-studio-group__label">${escapeHtml(grp.title)}</span>
        </div>
      `;
      const list = document.createElement('div');
      list.className = 'p-studio-list';

      OCCASION_CATALOG.filter((item) => item.category === grp.id).forEach((entry) => {
        const existing = byKey.get(entry.key as BuiltinOccasionKey);
        const colors = existing?.colors ?? entry.colors;
        const isActiveCustom = Boolean(existing && existing.enabled);
        const isDisabled = existing ? !existing.enabled : Boolean(entry.genderSpecific);

        const badgeText = isActiveCustom
          ? 'Đã soạn riêng'
          : isDisabled
            ? (entry.genderSpecific ? 'Bấm để bật' : 'Đang tắt')
            : 'Mẫu tự động';

        const rowBtn = document.createElement('button');
        rowBtn.type = 'button';
        rowBtn.className = `p-studio-item${isActiveCustom ? ' is-customized' : ''}`;
        rowBtn.innerHTML = `
          <div class="p-studio-item__lead">
            <span class="p-studio-item__swatch" style="background:linear-gradient(135deg,${colors[0]},${colors[1]});">
              ${iconMarkup(entry.icon, { size: 20, variant: 'filled' })}
            </span>
            <div class="p-studio-item__copy">
              <strong>${escapeHtml(entry.label)}</strong>
              <small>${escapeHtml(entry.dateBadge)}</small>
            </div>
          </div>
          <span class="p-studio-badge${isActiveCustom ? ' p-studio-badge--custom' : isDisabled ? ' p-studio-badge--off' : ''}">${badgeText}</span>
        `;
        rowBtn.addEventListener('click', () => openCardEditor({ builtin: entry, existing }));
        list.appendChild(rowBtn);
      });

      sec.appendChild(list);
      stageHost.appendChild(sec);
    });
  }

  function renderBody(): void {
    stageHost.replaceChildren();
    if (loading) {
      stageHost.append(
        createSkeleton({ width: '100%', height: '84px' }),
        createSkeleton({ width: '100%', height: '210px' }),
        createSkeleton({ width: '100%', height: '68px' }),
      );
      return;
    }

    if (activeTab === 'album') renderAlbumView();
    else renderStudioView();
  }

  // Unused import guard for buildBuiltinOccasionCard (used when quick testing templates)
  void buildBuiltinOccasionCard;

  void refreshDashboard();
  return root;
}
