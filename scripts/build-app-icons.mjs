// Sinh bộ icon app v2 cho PWA và Android. Chạy: node scripts/build-app-icons.mjs
// Dùng Chrome/Edge headless để rasterize, không thêm dependency.
// - PWA:     apps/pwa/public/icons/*  (SVG + PNG)
// - Android: mipmap-*dpi PNG legacy (API 24-25) + drawable-nodpi/ic_launcher_bitmap.png.
//   API 26+ dùng adaptive-icon XML (drawable/ic_launcher_foreground.xml) cùng motif tim + ống kính.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import process from 'node:process';

const PWA_ICONS = resolve('apps/pwa/public/icons');
const ANDROID_RES = resolve('apps/android/app/src/main/res');
const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const browser = BROWSERS.find((p) => existsSync(p));
if (!browser) throw new Error('Không tìm thấy Chrome/Edge để rasterize icon.');

// Cùng motif "tim + ống kính" với bộ icon Nét Yêu (src/ui/icons/icons.ts).
const HEART = 'M12 20.2s-7.5-4.5-7.5-10.1a4.3 4.3 0 0 1 7.5-2.8 4.3 4.3 0 0 1 7.5 2.8c0 5.6-7.5 10.1-7.5 10.1Z';
const INNER = 'M12 15.8s-3.3-2.1-3.3-4.5a1.9 1.9 0 0 1 3.3-1.2 1.9 1.9 0 0 1 3.3 1.2c0 2.4-3.3 4.5-3.3 4.5Z';

const BACKGROUNDS = {
  rounded: '<rect width="512" height="512" rx="116" fill="url(#g)"/>',
  circle: '<circle cx="256" cy="256" r="256" fill="url(#g)"/>',
  square: '<rect width="512" height="512" fill="url(#g)"/>',
};

function appIconSvg({ shape, scale }) {
  const tx = 256 - 12 * scale;
  const ty = 256 - 11.9 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<defs><linearGradient id="g" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse"><stop stop-color="#ff7aa8"/><stop offset=".55" stop-color="#ff3b7f"/><stop offset="1" stop-color="#d91f66"/></linearGradient></defs>
${BACKGROUNDS[shape]}
<g transform="translate(${tx} ${ty}) scale(${scale})">
<path d="${HEART}" transform="translate(.45 .6)" fill="#7a1238" opacity=".35"/>
<path d="${HEART}" fill="#fff"/>
<path d="${INNER}" fill="#ff3b7f"/>
</g></svg>`;
}

const badgeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96"><path fill="#fff" fill-rule="evenodd" d="${HEART} ${INNER}"/></svg>\n`;

const anySvg = appIconSvg({ shape: 'rounded', scale: 17 });
const circleSvg = appIconSvg({ shape: 'circle', scale: 15 });
const bleedSvg = appIconSvg({ shape: 'square', scale: 15 }); // heart nằm trong safe-zone 80%

mkdirSync(PWA_ICONS, { recursive: true });
writeFileSync(join(PWA_ICONS, 'favicon.svg'), anySvg);
writeFileSync(join(PWA_ICONS, 'badge.svg'), badgeSvg);

/** @type {Array<[string, number, string]>} đường dẫn tuyệt đối, kích thước px, SVG nguồn */
const targets = [
  [join(PWA_ICONS, 'icon-192.png'), 192, anySvg],
  [join(PWA_ICONS, 'icon-512.png'), 512, anySvg],
  [join(PWA_ICONS, 'icon-maskable-512.png'), 512, bleedSvg],
  [join(PWA_ICONS, 'apple-touch-icon-120.png'), 120, bleedSvg],
  [join(PWA_ICONS, 'apple-touch-icon-152.png'), 152, bleedSvg],
  [join(PWA_ICONS, 'apple-touch-icon-180.png'), 180, bleedSvg],
];

const DENSITIES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [density, px] of Object.entries(DENSITIES)) {
  targets.push([join(ANDROID_RES, `mipmap-${density}`, 'ic_launcher.png'), px, anySvg]);
  targets.push([join(ANDROID_RES, `mipmap-${density}`, 'ic_launcher_round.png'), px, circleSvg]);
}
targets.push([join(ANDROID_RES, 'drawable-nodpi', 'ic_launcher_bitmap.png'), 192, anySvg]);

const tmp = mkdtempSync(join(tmpdir(), 'lovecheck-icons-'));
try {
  targets.forEach(([out, size, svg], index) => {
    const html = join(tmp, `${index}.html`);
    writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    mkdirSync(dirname(out), { recursive: true });
    execFileSync(browser, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
      '--default-background-color=00000000', `--window-size=${size},${size}`,
      `--screenshot=${out}`, `file:///${html.replace(/\\/g, '/')}`,
    ], { stdio: 'ignore' });
    const buf = readFileSync(out);
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    const ok = w === size && h === size;
    process.stdout.write(`${relative(process.cwd(), out)}: ${w}x${h} (${buf.length} B)${ok ? '' : '  <-- SAI KÍCH THƯỚC'}\n`);
  });
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
