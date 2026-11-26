// @vitest-environment jsdom
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '../store/index';
import { MOCK_PREVIEW_TOKEN, seedMockPreviewData } from '../dev/mock-data';
import { ACCENT_PRESETS, contrastRatio } from './theme/index';
import { createNav } from '../components/nav';
import { renderLoginPage } from '../pages/login';
import { renderOnboardingPage } from '../pages/onboarding';
import { renderInstallPage } from '../pages/install';
import { renderHomePage } from '../pages/home';
import { renderCheckinPage } from '../pages/checkin';
import { renderMemoriesPage } from '../pages/memories';
import { renderMessagesPage } from '../pages/messages';
import { renderProfilePage } from '../pages/profile';
import { renderRandomPage } from '../pages/random';
import { renderRepliesPage } from '../pages/replies';
import { renderCardPreviewPage } from '../pages/card-preview';
import { renderTestMailPage } from '../pages/test-mail';

const PWA_ROOT = path.resolve(__dirname, '../..');
const SRC_ROOT = path.join(PWA_ROOT, 'src');
const PUBLIC_ROOT = path.join(PWA_ROOT, 'public');

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

describe('P9 Acceptance Criteria — Hygiene, PWA & Full-App Accessibility', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.head.innerHTML = '<meta name="theme-color" content="#f8e2e7" id="meta-theme-color" />';
    document.body.innerHTML = '';
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
  });

  it('enforces zero non-a11y !important rules and <= 400 lines per v2 component/page CSS file', () => {
    const prodFiles = walkFiles(SRC_ROOT).filter(
      (f) => (f.endsWith('.css') || f.endsWith('.ts')) && !f.endsWith('.test.ts'),
    );

    const violations: string[] = [];
    for (const file of prodFiles) {
      const rel = path.relative(SRC_ROOT, file).replace(/\\/g, '/');
      const content = fs.readFileSync(file, 'utf8');
      const count = (content.match(/!important/g) || []).length;
      if (count > 0 && rel !== 'styles/01-base.css') {
        violations.push(`${rel} (${count} !important)`);
      }
    }
    expect(violations).toEqual([]);

    // Verify 01-base.css only uses !important for reduced-motion accessibility
    const baseCss = fs.readFileSync(path.join(SRC_ROOT, 'styles/01-base.css'), 'utf8');
    expect((baseCss.match(/!important/g) || []).length).toBe(8);

    // Every v2 component & page stylesheet stays modular (<= 400 lines)
    const modularDirs = [
      path.join(SRC_ROOT, 'styles/10-components'),
      path.join(SRC_ROOT, 'styles/20-pages'),
    ];
    for (const dir of modularDirs) {
      for (const file of walkFiles(dir).filter((f) => f.endsWith('.css'))) {
        const rel = path.relative(SRC_ROOT, file).replace(/\\/g, '/');
        const lines = fs.readFileSync(file, 'utf8').split('\n').length;
        expect(lines, `${rel} exceeds 400 lines`).toBeLessThanOrEqual(400);
      }
    }
  });

  it('contains zero runtime Google Fonts, unpkg CDN, lottie-player, or orphaned legacy patch/icon files', () => {
    const indexHtml = fs.readFileSync(path.join(PWA_ROOT, 'index.html'), 'utf8');
    const prodSources = walkFiles(SRC_ROOT)
      .filter((f) => (f.endsWith('.css') || f.endsWith('.ts')) && !f.endsWith('.test.ts'))
      .map((f) => ({ rel: path.relative(SRC_ROOT, f).replace(/\\/g, '/'), text: fs.readFileSync(f, 'utf8') }));

    const bannedRuntimeRefs = ['fonts.googleapis.com', 'fonts.gstatic.com', 'unpkg.com', 'lottie-player'];
    for (const banned of bannedRuntimeRefs) {
      expect(indexHtml).not.toContain(banned);
      for (const src of prodSources) {
        expect(src.text, `${src.rel} contains banned runtime ref ${banned}`).not.toContain(banned);
      }
    }

    // Deleted patch files & orphaned raster assets must stay gone
    const removedFiles = [
      path.join(SRC_ROOT, 'utils/profile-ui-cleanup.ts'),
      path.join(SRC_ROOT, 'styles/messages-layout-fix.css'),
      path.join(SRC_ROOT, 'styles/message-thread-enhancements.css'),
      path.join(SRC_ROOT, 'styles/auth-interaction-vibe.css'),
      path.join(PUBLIC_ROOT, 'user.png'),
      path.join(PUBLIC_ROOT, 'profile.png'),
    ];
    for (const removed of removedFiles) {
      expect(fs.existsSync(removed), `${path.basename(removed)} should be deleted`).toBe(false);
    }

    const publicRootFiles = fs.readdirSync(PUBLIC_ROOT);
    expect(publicRootFiles.filter((name) => name.startsWith('icons8-'))).toEqual([]);
  });

  it('verifies PWA manifest, offline fallback, and Service Worker v10 contracts', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(PUBLIC_ROOT, 'manifest.webmanifest'), 'utf8')) as {
      id: string;
      start_url: string;
      scope: string;
      shortcuts: Array<{ url: string }>;
      share_target: { action: string; method: string };
      icons: Array<{ src: string; purpose?: string }>;
    };

    expect(manifest.id).toBe('/');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.share_target.action).toBe('/app/messages');
    expect(manifest.share_target.method).toBe('POST');
    expect(manifest.shortcuts.map((s) => s.url)).toEqual([
      '/app/checkin',
      '/app/messages',
      '/app/memories',
    ]);
    expect(manifest.icons.some((i) => i.purpose === 'any')).toBe(true);
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);

    const offlineHtml = fs.readFileSync(path.join(PUBLIC_ROOT, 'offline.html'), 'utf8');
    expect(offlineHtml).toContain('lang="vi"');
    expect(offlineHtml).toContain('lovecheck_ui_v2_theme');

    const sw = fs.readFileSync(path.join(PUBLIC_ROOT, 'sw.js'), 'utf8');
    expect(sw).toContain("const CACHE_NAME = 'lovecheck-v10'");
    expect(sw).toContain("url.pathname.startsWith('/api/')");
    expect(sw).toContain('networkOnly(request)');
    expect(sw).toContain('captureShareTarget(request)');
    expect(sw).toContain('SKIP_WAITING');
  });

  it('passes WCAG AA contrast on both paper AND canvas across all 6 accent presets', () => {
    for (const preset of ACCENT_PRESETS) {
      // Light ink must also be readable on the pastel pink canvas (#f8e2e7), not only paper
      expect(
        contrastRatio(preset.light.inkOnPaper, '#f8e2e7'),
        `${preset.id} light ink on canvas #f8e2e7`,
      ).toBeGreaterThanOrEqual(4.5);
      // Dark ink must also be readable on the dark plum canvas (#261824)
      expect(
        contrastRatio(preset.dark.inkOnPaper, '#261824'),
        `${preset.id} dark ink on canvas #261824`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('ensures every button has an accessible label and every image has alt across rendered screens', async () => {
    const preview = seedMockPreviewData();
    store.set({
      token: MOCK_PREVIEW_TOKEN,
      user: preview.user,
      couple: preview.couple,
    });

    type ScreenNode = HTMLElement | { element: HTMLElement };
    const screens: Array<[string, ScreenNode | Promise<ScreenNode>]> = [
      ['nav', createNav()],
      ['login', renderLoginPage()],
      ['onboarding', renderOnboardingPage()],
      ['install', renderInstallPage()],
      ['home', renderHomePage()],
      ['checkin', renderCheckinPage()],
      ['memories', renderMemoriesPage()],
      ['messages', renderMessagesPage()],
      ['profile', renderProfilePage()],
      ['random', renderRandomPage()],
      ['replies', renderRepliesPage()],
      ['card-preview', renderCardPreviewPage()],
      ['test-mail', renderTestMailPage()],
    ];

    const unlabeledButtons: string[] = [];
    const missingAltImages: string[] = [];

    for (const [name, rawRoot] of screens) {
      const resolved = await rawRoot;
      const root = resolved instanceof HTMLElement ? resolved : resolved.element;
      document.body.replaceChildren(root);
      // Allow synchronous/microtask mock data hydration
      await new Promise((resolve) => setTimeout(resolve, 15));

      root.querySelectorAll<HTMLButtonElement>('button').forEach((btn, idx) => {
        const text = (btn.textContent || '').trim();
        const ariaLabel = (btn.getAttribute('aria-label') || '').trim();
        const labelledBy = (btn.getAttribute('aria-labelledby') || '').trim();
        const title = (btn.getAttribute('title') || '').trim();
        if (!text && !ariaLabel && !labelledBy && !title) {
          unlabeledButtons.push(`${name}: button#${btn.id || idx}.${btn.className}`);
        }
      });

      root.querySelectorAll<HTMLImageElement>('img').forEach((img, idx) => {
        if (!img.hasAttribute('alt')) {
          missingAltImages.push(`${name}: img#${img.id || idx}[src="${img.getAttribute('src') || ''}"]`);
        }
      });
    }

    expect(unlabeledButtons).toEqual([]);
    expect(missingAltImages).toEqual([]);
  });
});
