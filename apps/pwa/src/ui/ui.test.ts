// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '../store/index';
import { renderUiPreviewPage } from '../pages/ui-preview';
import {
  ACCENT_PRESETS,
  ICON_NAMES,
  REACTION_ICON_MAP,
  UI_ACCENT_STORAGE_KEY,
  UI_REDUCED_MOTION_STORAGE_KEY,
  UI_THEME_STORAGE_KEY,
  contrastRatio,
  createAvatarPair,
  createButton,
  createField,
  createIconButton,
  createSegmentedControl,
  createSwitch,
  ensureIconSprite,
  getUiAccent,
  icon,
  iconMarkup,
  initUiThemeEngine,
  meetsWcagAA,
  openDialog,
  openSheet,
  setUiAccent,
  setUiReducedMotion,
  setUiTheme,
} from './index';

describe('Design System v2 (P1 Foundation)', () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta name="theme-color" content="#f8e2e7" />';
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-accent');
    document.documentElement.removeAttribute('data-reduced-motion');
    localStorage.clear();
    store.set({ theme: 'light' });
  });

  it('passes WCAG AA contrast (>= 4.5:1) across light, dark, gold chips, and all 6 accent presets', () => {
    // Base text hierarchy on editorial canvas & paper (light)
    expect(meetsWcagAA('#1f0f15', '#fff8f4')).toBe(true);
    expect(meetsWcagAA('#593944', '#fff8f4')).toBe(true);
    expect(meetsWcagAA('#6e4b57', '#fff8f4')).toBe(true);
    expect(meetsWcagAA('#6e4b57', '#f8e2e7')).toBe(true);

    // Base text hierarchy on dark plum surface
    expect(meetsWcagAA('#ffffff', '#3a2230')).toBe(true);
    expect(meetsWcagAA('#e2ced8', '#3a2230')).toBe(true);
    expect(meetsWcagAA('#c7aeb9', '#3a2230')).toBe(true);

    // Gold sticker badges (light & dark)
    expect(meetsWcagAA('#1f0f15', '#ffeaa7')).toBe(true);
    expect(meetsWcagAA('#ffd875', '#543700')).toBe(true);

    // Every accent preset in both light & dark modes
    expect(ACCENT_PRESETS.length).toBeGreaterThanOrEqual(6);
    for (const preset of ACCENT_PRESETS) {
      expect(
        contrastRatio(preset.light.onSolid, preset.light.solidBg),
        `${preset.id} light solid button contrast`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(preset.light.inkOnPaper, preset.light.paperBg),
        `${preset.id} light ink contrast`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(preset.dark.onSolid, preset.dark.solidBg),
        `${preset.id} dark solid button contrast`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(preset.dark.inkOnPaper, preset.dark.paperBg),
        `${preset.id} dark ink contrast`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('syncs theme, accent, reduced-motion, and theme-color meta without touching legacy storage keys', () => {
    localStorage.setItem('lovecheck_token', 'legacy_user_token');
    localStorage.setItem('lovecheck_chat_wallpaper', 'rose-bloom');

    initUiThemeEngine();
    setUiTheme('dark');
    setUiAccent('violet');
    setUiReducedMotion('on');

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-accent')).toBe('violet');
    expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('on');
    expect(localStorage.getItem(UI_THEME_STORAGE_KEY)).toBe('dark');
    expect(localStorage.getItem(UI_ACCENT_STORAGE_KEY)).toBe('violet');
    expect(localStorage.getItem(UI_REDUCED_MOTION_STORAGE_KEY)).toBe('on');
    expect(getUiAccent()).toBe('violet');
    expect(store.get().theme).toBe('dark');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#261824');

    // Legacy keys remain 100% untouched
    expect(localStorage.getItem('lovecheck_token')).toBe('legacy_user_token');
    expect(localStorage.getItem('lovecheck_chat_wallpaper')).toBe('rose-bloom');
  });

  it('provides >= 70 bespoke SVG icons with outline/filled variants, sprite deduping, and zero emojis', () => {
    expect(ICON_NAMES.length).toBeGreaterThanOrEqual(70);
    const sprite1 = ensureIconSprite(document);
    const sprite2 = ensureIconSprite(document);
    expect(sprite1).not.toBeNull();
    expect(sprite1).toBe(sprite2);
    expect(document.querySelectorAll('#cil-icon-sprite').length).toBe(1);

    const emojiRegex = /[\u{1F300}-\u{1FAFF}]/u;
    for (const name of ICON_NAMES) {
      const markup = iconMarkup(name, { variant: 'filled', size: 20 });
      expect(markup).toContain(`data-cil-icon="${name}"`);
      expect(emojiRegex.test(markup)).toBe(false);
    }

    const labelled = icon('checkin-lens', { label: 'Tạo check-in mới', variant: 'filled', motion: 'pop' });
    expect(labelled.getAttribute('role')).toBe('img');
    expect(labelled.getAttribute('aria-label')).toBe('Tạo check-in mới');
    expect(labelled.classList.contains('c-icon--filled')).toBe(true);
    expect(labelled.classList.contains('c-icon--pop')).toBe(true);
    expect(REACTION_ICON_MAP['❤️']).toBe('heart');
    expect(REACTION_ICON_MAP['😂']).toBe('react-haha');

    // Verify hybrid icon set contract: streak preserved, memories & send use Liquid Glass, chat & settings use Enamel Sticker
    expect(iconMarkup('streak')).toContain('cil-tone cil-fill-active');
    expect(iconMarkup('memories')).toContain('cil-lg-front');
    expect(iconMarkup('send')).toContain('cil-lg-front');
    expect(iconMarkup('chat')).toContain('cil-enamel-gold');
    expect(iconMarkup('chat')).toContain('cil-enamel-rose');
    expect(iconMarkup('settings')).toContain('M10.6 2.7h2.8');
  });

  it('renders accessible UI components and interactive states cleanly', () => {
    const onClick = vi.fn();
    const btn = createButton({ label: 'Gửi ngay', leadingIcon: 'send', onClick });
    btn.element.click();
    expect(onClick).toHaveBeenCalledTimes(1);

    btn.setLoading(true, 'Đang gửi...');
    expect(btn.element.disabled).toBe(true);
    expect(btn.element.getAttribute('aria-busy')).toBe('true');
    expect(btn.element.textContent).toContain('Đang gửi...');

    btn.setLoading(false);
    expect(btn.element.disabled).toBe(false);
    expect(btn.element.textContent).toBe('Gửi ngay');

    const iconBtn = createIconButton({ icon: 'camera', ariaLabel: 'Mở máy ảnh', variant: 'sticker' });
    expect(iconBtn.getAttribute('aria-label')).toBe('Mở máy ảnh');
    expect(iconBtn.classList.contains('c-icon-btn--sticker')).toBe(true);

    const field = createField({ label: 'Email', helperText: 'Nhập email nhận OTP' });
    expect(field.input.getAttribute('aria-invalid')).toBe('false');
    field.setError('Email không hợp lệ');
    expect(field.input.getAttribute('aria-invalid')).toBe('true');
    expect(field.element.querySelector('[role="alert"]')?.textContent).toBe('Email không hợp lệ');

    const sw = createSwitch({ ariaLabel: 'Bật âm báo', checked: false });
    sw.element.click();
    expect(sw.isChecked()).toBe(true);
    expect(sw.element.getAttribute('aria-checked')).toBe('true');

    const seg = createSegmentedControl({
      ariaLabel: 'Chế độ',
      items: [
        { value: 'a', label: 'Mục A' },
        { value: 'b', label: 'Mục B' },
      ],
      value: 'a',
    });
    expect(seg.element.querySelectorAll('[role="tab"]').length).toBe(2);

    const pair = createAvatarPair({ name: 'Danh Thái' }, { name: 'Thúy Hà', presence: 'online' });
    expect(pair.querySelectorAll('.c-avatar').length).toBe(2);
  });

  it('opens and closes Sheet, Dialog, and renders /preview/ui showcase page', () => {
    const sheet = openSheet({ title: 'Chọn nhãn dán', content: 'Nội dung thử nghiệm' });
    expect(document.querySelector('.c-sheet')?.getAttribute('aria-label')).toBe('Chọn nhãn dán');
    sheet.close();

    const dialog = openDialog({ title: 'Xác nhận', description: 'Bạn chắc chứ?', confirmLabel: 'Đồng ý' });
    expect(document.querySelector('.c-dialog')?.getAttribute('aria-label')).toBe('Xác nhận');
    dialog.close();

    const previewPage = renderUiPreviewPage();
    expect(previewPage.querySelectorAll('.p-ui-preview__icon-cell').length).toBe(ICON_NAMES.length);
    expect(previewPage.textContent).toContain('WCAG AA Check');
  });
});
