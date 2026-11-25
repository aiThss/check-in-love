import { store, type AppState } from '../../store/index';

export type UiThemePreference = AppState['theme'];
export type UiAccentId = 'rose' | 'coral' | 'violet' | 'teal' | 'sky' | 'amber';
export type UiReducedMotionPreference = 'system' | 'on' | 'off';

export const UI_THEME_STORAGE_KEY = 'lovecheck_ui_v2_theme';
export const UI_ACCENT_STORAGE_KEY = 'lovecheck_ui_v2_accent';
export const UI_REDUCED_MOTION_STORAGE_KEY = 'lovecheck_ui_v2_reduced_motion';

export interface AccentPreset {
  id: UiAccentId;
  label: string;
  hue: number;
  swatchHex: string;
  light: {
    solidBg: string;
    onSolid: string;
    inkOnPaper: string;
    paperBg: string;
  };
  dark: {
    solidBg: string;
    onSolid: string;
    inkOnPaper: string;
    paperBg: string;
  };
}

export const ACCENT_PRESETS: readonly AccentPreset[] = [
  {
    id: 'rose',
    label: 'Hồng nguyên bản',
    hue: 339,
    swatchHex: '#ff3b7f',
    light: { solidBg: '#d9205f', onSolid: '#ffffff', inkOnPaper: '#b4124b', paperBg: '#fff8f4' },
    dark: { solidBg: '#e0246a', onSolid: '#ffffff', inkOnPaper: '#ff8fb6', paperBg: '#3a2230' },
  },
  {
    id: 'coral',
    label: 'San hô ấm',
    hue: 16,
    swatchHex: '#ff6242',
    light: { solidBg: '#c83717', onSolid: '#ffffff', inkOnPaper: '#9f270c', paperBg: '#fff8f4' },
    dark: { solidBg: '#d43d1c', onSolid: '#ffffff', inkOnPaper: '#ffab96', paperBg: '#3a2230' },
  },
  {
    id: 'violet',
    label: 'Tím chiều tà',
    hue: 262,
    swatchHex: '#8b5cf6',
    light: { solidBg: '#6d35de', onSolid: '#ffffff', inkOnPaper: '#5521b5', paperBg: '#fff8f4' },
    dark: { solidBg: '#7640e6', onSolid: '#ffffff', inkOnPaper: '#cbb2ff', paperBg: '#3a2230' },
  },
  {
    id: 'teal',
    label: 'Ngọc lam dịu',
    hue: 172,
    swatchHex: '#14b8a6',
    light: { solidBg: '#0c776b', onSolid: '#ffffff', inkOnPaper: '#085c53', paperBg: '#fff8f4' },
    dark: { solidBg: '#0d7f72', onSolid: '#ffffff', inkOnPaper: '#7cead9', paperBg: '#3a2230' },
  },
  {
    id: 'sky',
    label: 'Xanh bầu trời',
    hue: 214,
    swatchHex: '#3b82f6',
    light: { solidBg: '#1d5ed8', onSolid: '#ffffff', inkOnPaper: '#1849a9', paperBg: '#fff8f4' },
    dark: { solidBg: '#2563eb', onSolid: '#ffffff', inkOnPaper: '#9ec5ff', paperBg: '#3a2230' },
  },
  {
    id: 'amber',
    label: 'Mật ong nắng',
    hue: 33,
    swatchHex: '#f59e0b',
    light: { solidBg: '#a85503', onSolid: '#ffffff', inkOnPaper: '#854000', paperBg: '#fff8f4' },
    dark: { solidBg: '#b45a04', onSolid: '#ffffff', inkOnPaper: '#fcd37d', paperBg: '#3a2230' },
  },
] as const;

const VALID_ACCENTS = new Set<string>(ACCENT_PRESETS.map((p) => p.id));

export const THEME_CHROME_HEX = {
  light: '#f8e2e7',
  dark: '#261824',
} as const;

export function isValidAccentId(value: string | null | undefined): value is UiAccentId {
  return Boolean(value && VALID_ACCENTS.has(value));
}

export function getUiAccent(): UiAccentId {
  try {
    const raw = localStorage.getItem(UI_ACCENT_STORAGE_KEY);
    if (isValidAccentId(raw)) return raw;
  } catch {}
  return 'rose';
}

export function setUiAccent(accent: UiAccentId): void {
  const safeAccent = isValidAccentId(accent) ? accent : 'rose';
  try {
    localStorage.setItem(UI_ACCENT_STORAGE_KEY, safeAccent);
  } catch {}
  if (typeof document !== 'undefined') {
    if (safeAccent === 'rose') {
      document.documentElement.removeAttribute('data-accent');
    } else {
      document.documentElement.setAttribute('data-accent', safeAccent);
    }
  }
}

export function getUiReducedMotion(): UiReducedMotionPreference {
  try {
    const raw = localStorage.getItem(UI_REDUCED_MOTION_STORAGE_KEY);
    if (raw === 'on' || raw === 'off' || raw === 'system') return raw;
  } catch {}
  return 'system';
}

export function setUiReducedMotion(pref: UiReducedMotionPreference): void {
  try {
    localStorage.setItem(UI_REDUCED_MOTION_STORAGE_KEY, pref);
  } catch {}
  applyReducedMotionAttribute(pref);
}

export function isReducedMotionActive(): boolean {
  const pref = getUiReducedMotion();
  if (pref === 'on') return true;
  if (pref === 'off') return false;
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark), (prefers-reduced-motion: reduce)').media !== ''
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function applyReducedMotionAttribute(pref: UiReducedMotionPreference): void {
  if (typeof document === 'undefined') return;
  if (pref === 'on' || pref === 'off') {
    document.documentElement.setAttribute('data-reduced-motion', pref);
  } else {
    document.documentElement.removeAttribute('data-reduced-motion');
  }
}

export function getResolvedTheme(pref: UiThemePreference = store.get().theme): 'light' | 'dark' {
  if (pref === 'dark') return 'dark';
  if (pref === 'light') return 'light';
  const prefersDark = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

export function syncThemeColorMeta(resolved: 'light' | 'dark' = getResolvedTheme()): void {
  if (typeof document === 'undefined') return;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = THEME_CHROME_HEX[resolved];
}

export function setUiTheme(theme: UiThemePreference): void {
  try {
    localStorage.setItem(UI_THEME_STORAGE_KEY, theme);
  } catch {}
  store.set({ theme });
  syncThemeColorMeta(getResolvedTheme(theme));
}

let initialized = false;

export function initUiThemeEngine(): void {
  if (typeof document === 'undefined') return;

  // Hydrate stored v2 theme if present while keeping legacy store in sync
  try {
    const v2Theme = localStorage.getItem(UI_THEME_STORAGE_KEY);
    if ((v2Theme === 'light' || v2Theme === 'dark' || v2Theme === 'system') && v2Theme !== store.get().theme) {
      store.set({ theme: v2Theme });
    } else {
      localStorage.setItem(UI_THEME_STORAGE_KEY, store.get().theme);
    }
  } catch {}

  setUiAccent(getUiAccent());
  applyReducedMotionAttribute(getUiReducedMotion());
  syncThemeColorMeta(getResolvedTheme(store.get().theme));

  if (initialized) return;
  initialized = true;

  store.subscribe((next, prev) => {
    if (next.theme !== prev.theme) {
      try {
        localStorage.setItem(UI_THEME_STORAGE_KEY, next.theme);
      } catch {}
      syncThemeColorMeta(getResolvedTheme(next.theme));
    }
  });

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (store.get().theme === 'system') {
        syncThemeColorMeta(getResolvedTheme('system'));
      }
    });
  }
}

// ── WCAG 2.1 Luminance & Contrast Verification Utilities ────────────────────

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.trim().replace(/^#/, '');
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  if (clean.length !== 6) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foregroundHex: string, backgroundHex: string): number {
  const l1 = relativeLuminance(foregroundHex);
  const l2 = relativeLuminance(backgroundHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsWcagAA(foregroundHex: string, backgroundHex: string, largeText = false): boolean {
  return contrastRatio(foregroundHex, backgroundHex) >= (largeText ? 3.0 : 4.5);
}
