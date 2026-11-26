// Sinh bộ icon app v2 (SVG + PNG) cho PWA. Chạy: node scripts/build-app-icons.mjs
// Dùng Chrome/Edge headless để rasterize, không thêm dependency.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';

const OUT = resolve('apps/pwa/public/icons');
const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const browser = BROWSERS.find((p) => existsSync(p));
if (!browser) throw new Error('Không tìm thấy Chrome/Edge để rasterize icon.');

// Cùng motif "tim + ống kính" với bộ icon Nét Yêu (src/ui/icons/icons.ts).
const HEART = 'M12 20.2s-7.5-4.5-7.5-10.1a4.3 4.3 0 0 1 7.5-2.8 4.3 4.3 0 0 1 7.5 2.8c0 5.6-7.5 10.1-7.5 10.1Z';
const INNER = 'M12 15.8s-3.3-2.1-3.3-4.5a1.9 1.9 0 0 1 3.3-1.2 1.9 1.9 0 0 1 3.3 1.2c0 2.4-3.3 4.5-3.3 4.5Z';

function appIconSvg({ rounded, scale }) {
  const tx = 256 - 12 * scale;
  const ty = 256 - 11.9 * scale;
  const bg = rounded
    ? '<rect width="512" height="512" rx="116" fill="url(#g)"/>'
    : '<rect width="512" height="512" fill="url(#g)"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<defs><linearGradient id="g" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse"><stop stop-color="#ff7aa8"/><stop offset=".55" stop-color="#ff3b7f"/><stop offset="1" stop-color="#d91f66"/></linearGradient></defs>
${bg}
<g transform="translate(${tx} ${ty}) scale(${scale})">
<path d="${HEART}" transform="translate(.45 .6)" fill="#7a1238" opacity=".35"/>
<path d="${HEART}" fill="#fff"/>
<path d="${INNER}" fill="#ff3b7f"/>
</g></svg>`;
}

const badgeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96"><path fill="#fff" fill-rule="evenodd" d="${HEART} ${INNER}"/></svg>\n`;

const anySvg = appIconSvg({ rounded: true, scale: 17 });
const bleedSvg = appIconSvg({ rounded: false, scale: 15 }); // heart nằm trong safe-zone 80%

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'favicon.svg'), anySvg);
writeFileSync(join(OUT, 'badge.svg'), badgeSvg);

const targets = [
  ['icon-192.png', 192, anySvg],
  ['icon-512.png', 512, anySvg],
  ['icon-maskable-512.png', 512, bleedSvg],
  ['apple-touch-icon-120.png', 120, bleedSvg],
  ['apple-touch-icon-152.png', 152, bleedSvg],
  ['apple-touch-icon-180.png', 180, bleedSvg],
];

const tmp = mkdtempSync(join(tmpdir(), 'lovecheck-icons-'));
try {
  for (const [name, size, svg] of targets) {
    const html = join(tmp, `${name}.html`);
    writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    const out = join(OUT, name);
    execFileSync(browser, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
      '--default-background-color=00000000', `--window-size=${size},${size}`,
      `--screenshot=${out}`, `file:///${html.replace(/\\/g, '/')}`,
    ], { stdio: 'ignore' });
    const buf = readFileSync(out);
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    process.stdout.write(`${name}: ${w}x${h} (${buf.length} B)${w === size && h === size ? '' : '  <-- SAI KÍCH THƯỚC'}\n`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
