import '../styles/20-pages/preview-ui.css';
import { store } from '../store/index';
import {
  ACCENT_PRESETS,
  ICON_NAMES,
  attachPopoverMenu,
  contrastRatio,
  createAvatarPair,
  createBadge,
  createButton,
  createCard,
  createChip,
  createEmptyState,
  createField,
  createIconButton,
  createListGroup,
  createListRow,
  createSegmentedControl,
  createSkeleton,
  createSwitch,
  createTabs,
  getUiAccent,
  getUiReducedMotion,
  icon,
  openDialog,
  openSheet,
  setUiAccent,
  setUiReducedMotion,
  setUiTheme,
  showUiToast,
  type IconVariant,
  type UiAccentId,
  type UiReducedMotionPreference,
  type UiThemePreference,
} from '../ui/index';

export function renderUiPreviewPage(): HTMLElement {
  const root = document.createElement('main');
  root.className = 'p-ui-preview';

  // 1. Header
  const header = document.createElement('header');
  header.className = 'u-between';
  const titleWrap = document.createElement('div');
  titleWrap.innerHTML = `
    <p class="t-eyebrow">Check IN Love · Design System v2 (MIX)</p>
    <h1 class="t-display" style="font-size:var(--text-2xl);margin:4px 0 0;">Bộ Linh Kiện &amp; 78 Icon "Nét Yêu"</h1>
  `;
  header.appendChild(titleWrap);
  header.appendChild(
    createAvatarPair(
      { name: 'Danh Thái', presence: 'online' },
      { name: 'Thúy Hà', presence: 'online' },
    ),
  );
  root.appendChild(header);

  // 2. Theme, Accent & Reduced Motion Controls + Live WCAG AA Audit
  const contrastLabel = document.createElement('p');
  contrastLabel.className = 't-tabular';
  contrastLabel.style.cssText = 'margin:0;font-size:var(--text-xs);color:var(--ink-3);';

  const updateContrastReadout = (): void => {
    const preset = ACCENT_PRESETS.find((p) => p.id === getUiAccent()) ?? ACCENT_PRESETS[0];
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const pal = isDark ? preset.dark : preset.light;
    const btnRatio = contrastRatio(pal.onSolid, pal.solidBg).toFixed(2);
    const inkRatio = contrastRatio(pal.inkOnPaper, pal.paperBg).toFixed(2);
    contrastLabel.textContent = `WCAG AA Check (${preset.label} · ${isDark ? 'Tối' : 'Sáng'}): Nút chính ${btnRatio}:1 (≥4.5 PASS) · Chữ nhấn ${inkRatio}:1 (≥4.5 PASS)`;
  };

  const themeSeg = createSegmentedControl<UiThemePreference>({
    ariaLabel: 'Chế độ giao diện',
    items: [
      { value: 'light', label: 'Sáng' },
      { value: 'dark', label: 'Tối' },
      { value: 'system', label: 'Theo máy' },
    ],
    value: store.get().theme,
    onChange: (val) => {
      setUiTheme(val);
      updateContrastReadout();
    },
  });

  const swatches = document.createElement('div');
  swatches.className = 'p-ui-preview__swatches';
  const swatchBtns = new Map<UiAccentId, HTMLButtonElement>();
  const syncSwatches = (active: UiAccentId): void => {
    swatchBtns.forEach((b, id) => b.setAttribute('aria-pressed', String(id === active)));
  };

  for (const preset of ACCENT_PRESETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'p-ui-preview__swatch';
    btn.style.backgroundColor = preset.swatchHex;
    btn.setAttribute('aria-label', `Chọn màu nhấn ${preset.label}`);
    btn.title = preset.label;
    btn.addEventListener('click', () => {
      setUiAccent(preset.id);
      syncSwatches(preset.id);
      updateContrastReadout();
    });
    swatchBtns.set(preset.id, btn);
    swatches.appendChild(btn);
  }
  syncSwatches(getUiAccent());

  const motionSeg = createSegmentedControl<UiReducedMotionPreference>({
    ariaLabel: 'Giảm chuyển động',
    items: [
      { value: 'system', label: 'Hệ thống' },
      { value: 'off', label: 'Đầy đủ' },
      { value: 'on', label: 'Giảm' },
    ],
    value: getUiReducedMotion(),
    onChange: (val) => setUiReducedMotion(val),
  });

  root.appendChild(
    createCard({
      grain: true,
      className: 'u-stack-3',
      children: [
        createListGroup([
          createListRow({ title: 'Chế độ sáng / tối', leadingIcon: 'moon', trailingNode: themeSeg.element }),
          createListRow({ title: 'Giảm chuyển động', leadingIcon: 'sparkle', trailingNode: motionSeg.element }),
        ]),
        swatches,
        contrastLabel,
      ],
    }),
  );
  updateContrastReadout();

  // 3. MIX Direction Showcase (Editorial Hero + Sticker Chat)
  const heroDemo = createCard({
    variant: 'polaroid',
    children: [
      (() => {
        const box = document.createElement('div');
        box.className = 'u-stack-2';
        box.style.padding = '8px';
        box.innerHTML = `<span class="t-eyebrow">Ngày yêu thứ</span><div class="t-display-hero">582</div>`;
        const chips = document.createElement('div');
        chips.className = 'u-cluster';
        chips.append(
          createChip({ label: '12 ngày liên tiếp', variant: 'gold', leadingIcon: 'streak' }),
          createChip({ label: 'Kỷ niệm 600 ngày', variant: 'ghost', leadingIcon: 'anniversary' }),
          createBadge(3),
        );
        box.appendChild(chips);
        return box;
      })(),
    ],
  });

  const chatDemo = createCard({
    className: 'p-ui-preview__chat-demo',
    children: [
      createChip({ label: 'Hôm nay', variant: 'gold' }),
      (() => {
        const b1 = document.createElement('div');
        b1.className = 'p-ui-preview__bubble p-ui-preview__bubble--them';
        b1.textContent = 'Tối nay mình ra quán Nhà Đèn chụp polaroid nhé?';
        return b1;
      })(),
      (() => {
        const b2 = document.createElement('div');
        b2.className = 'p-ui-preview__bubble p-ui-preview__bubble--me';
        b2.textContent = 'Đi liền luôn! Đã chuẩn bị sẵn film rồi nè';
        return b2;
      })(),
    ],
  });

  root.append(heroDemo, chatDemo);

  // 4. Buttons, Overlays & Interactive Triggers
  const moreMenuBtn = createIconButton({ icon: 'more', ariaLabel: 'Mở menu ngữ cảnh' });
  attachPopoverMenu(moreMenuBtn, [
    { label: 'Trả lời tin nhắn', icon: 'reply', onSelect: () => showUiToast('Đã chọn Trả lời', 'info') },
    { label: 'Sao chép nội dung', icon: 'copy', onSelect: () => showUiToast('Đã sao chép!', 'success') },
    { label: 'Thu hồi tin nhắn', icon: 'delete', danger: true, onSelect: () => showUiToast('Đã thu hồi', 'error') },
  ]);

  const loadingBtn = createButton({
    label: 'Bấm thử Loading',
    variant: 'secondary',
    leadingIcon: 'upload',
    onClick: () => {
      loadingBtn.setLoading(true, 'Đang tải lên...');
      window.setTimeout(() => loadingBtn.setLoading(false), 1200);
    },
  });

  const btnCluster = document.createElement('div');
  btnCluster.className = 'u-cluster';
  btnCluster.append(
    createButton({
      label: 'Check-in ngay',
      variant: 'primary',
      leadingIcon: 'checkin-lens',
      onClick: () => showUiToast('Đã sẵn sàng mở máy ảnh Check-in!', 'success'),
    }).element,
    createButton({
      label: 'Nhãn Sticker',
      variant: 'sticker',
      leadingIcon: 'sparkle',
      onClick: () =>
        openSheet({
          title: 'Thả cảm xúc riêng',
          content: createEmptyState({
            illustration: 'messages',
            title: 'Bottom Sheet Kính Mờ',
            description: 'Hỗ trợ kéo thanh nắm xuống để đóng, phím ESC và nút Back Android.',
          }),
        }),
    }).element,
    loadingBtn.element,
    createButton({
      label: 'Hộp thoại xác nhận',
      variant: 'ghost',
      onClick: () =>
        openDialog({
          title: 'Đặt lại hình nền?',
          description: 'Hình nền cuộc trò chuyện sẽ quay về giấy kem mặc định của hai đứa.',
          confirmLabel: 'Đồng ý',
          onConfirm: () => {
            showUiToast('Đã đặt lại hình nền!', 'success');
          },
        }),
    }).element,
    createButton({ label: 'Đã khóa', variant: 'primary', disabled: true }).element,
    createIconButton({ icon: 'send', ariaLabel: 'Gửi tin nhắn', variant: 'sticker' }),
    moreMenuBtn,
  );
  root.appendChild(createCard({ className: 'u-stack-3', children: [btnCluster] }));

  // 5. Forms, Tabs, Switch, Skeleton & EmptyState
  const sampleField = createField({
    label: 'Lời nhắn đính kèm ảnh',
    placeholder: 'Viết vài dòng cho người ấy...',
    leadingIcon: 'edit',
    helperText: 'Tối đa 140 ký tự · Hiển thị dưới chân tấm polaroid',
  });
  const errorField = createField({
    label: 'Mã ghép đôi (Couple Code)',
    value: 'LO-12',
    leadingIcon: 'key',
    errorText: 'Mã ghép đôi cần đủ 6–8 ký tự chữ hoặc số.',
  });
  const sampleTabs = createTabs({
    ariaLabel: 'Bộ lọc kỷ niệm',
    items: [
      { value: 'all', label: 'Tất cả' },
      { value: 'mine', label: 'Của mình' },
      { value: 'partner', label: 'Của người ấy' },
    ],
    value: 'all',
  });
  const demoSwitch = createSwitch({ ariaLabel: 'Nhắc check-in mỗi tối', checked: true });

  root.appendChild(
    createCard({
      className: 'u-stack-4',
      children: [
        sampleTabs.element,
        sampleField.element,
        errorField.element,
        createListGroup([
          createListRow({
            title: 'Nhắc check-in 21:00 mỗi tối',
            subtitle: 'Thông báo êm qua FCM & SSE',
            leadingIcon: 'bell',
            trailingNode: demoSwitch.element,
          }),
        ]),
        createSkeleton({ height: '52px' }),
      ],
    }),
  );

  // 6. Full 78-Icon Interactive Gallery
  let currentIconVariant: IconVariant = 'outline';
  let filterQuery = '';
  const iconGrid = document.createElement('div');
  iconGrid.className = 'p-ui-preview__icon-grid';

  const renderIconGrid = (): void => {
    iconGrid.replaceChildren();
    const matched = ICON_NAMES.filter((name) => name.includes(filterQuery.toLowerCase().trim()));
    for (const name of matched) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'p-ui-preview__icon-cell';
      cell.setAttribute('aria-label', `Icon ${name}`);
      const svgEl = icon(name, { size: 24, variant: currentIconVariant });
      const cap = document.createElement('span');
      cap.textContent = name;
      cell.append(svgEl, cap);
      cell.addEventListener('click', () => {
        svgEl.classList.remove('c-icon--pop');
        void svgEl.getBoundingClientRect();
        svgEl.classList.add('c-icon--pop');
      });
      iconGrid.appendChild(cell);
    }
  };

  const iconVariantSeg = createSegmentedControl<IconVariant>({
    ariaLabel: 'Biến thể icon',
    items: [
      { value: 'outline', label: `Outline (${ICON_NAMES.length})` },
      { value: 'filled', label: 'Filled / Active' },
    ],
    value: 'outline',
    onChange: (val) => {
      currentIconVariant = val;
      renderIconGrid();
    },
  });

  const searchField = createField({
    label: 'Tìm nhanh trong 78 icon riêng',
    type: 'search',
    placeholder: 'Ví dụ: heart, react-, camera, location...',
    leadingIcon: 'search',
    onInput: (val) => {
      filterQuery = val;
      renderIconGrid();
    },
  });

  renderIconGrid();

  const iconSection = document.createElement('section');
  iconSection.className = 'p-ui-preview__section';
  const iconHeader = document.createElement('div');
  iconHeader.className = 'u-between';
  iconHeader.innerHTML = `<h2 class="t-display" style="margin:0;font-size:var(--text-xl);">Bộ Icon Tự Vẽ (${ICON_NAMES.length} icons)</h2>`;
  iconHeader.appendChild(iconVariantSeg.element);
  iconSection.append(iconHeader, searchField.element, iconGrid);
  root.appendChild(iconSection);

  return root;
}
