// Chụp 44 ảnh after WebP + ảnh manifest screenshots + đo Web Vitals mobile (4x CPU, Fast 3G).
// Chạy: node scripts/capture-after-and-metrics.mjs
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import process from 'node:process';
import { gzipSync } from 'node:zlib';

const DIST_DIR = resolve('apps/pwa/dist');
const AFTER_DIR = resolve('design/redesign-v2/after');
const PUBLIC_SCREENSHOTS_DIR = resolve('apps/pwa/public/screenshots');

const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const browserBin = BROWSERS.find((p) => existsSync(p));
if (!browserBin) throw new Error('Không tìm thấy Chrome/Edge để chạy CDP.');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

function startSpaServer() {
  return new Promise((resolveServer) => {
    const server = createServer((req, res) => {
      const urlPath = (req.url || '/').split('?')[0];
      if (urlPath === '/api/events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        res.write(': ok\n\n');
        return;
      }
      if (urlPath.startsWith('/api/')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{}');
        return;
      }

      let filePath = join(DIST_DIR, urlPath === '/' ? 'index.html' : urlPath);
      if (!existsSync(filePath) || !extname(filePath)) {
        filePath = join(DIST_DIR, 'index.html');
      }
      try {
        const raw = readFileSync(filePath);
        const ext = extname(filePath).toLowerCase();
        const contentType = MIME[ext] || 'application/octet-stream';
        const acceptGzip = String(req.headers['accept-encoding'] || '').includes('gzip');
        const compressible = ['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.svg'].includes(ext);
        if (acceptGzip && compressible) {
          res.writeHead(200, { 'Content-Type': contentType, 'Content-Encoding': 'gzip' });
          res.end(gzipSync(raw));
        } else {
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(raw);
        }
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolveServer({ server, port: addr.port });
    });
  });
}

const sleep = (ms) => new Promise((r) => globalThis.setTimeout(r, ms));

class CdpSession {
  constructor(wsUrl) {
    this.ws = new globalThis.WebSocket(wsUrl);
    this.seq = 0;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    await new Promise((res, rej) => {
      this.ws.addEventListener('open', res, { once: true });
      this.ws.addEventListener('error', rej, { once: true });
    });
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && this.pending.has(msg.id)) {
        const { res, rej } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) rej(new Error(msg.error.message));
        else res(msg.result);
      } else if (msg.method && this.listeners.has(msg.method)) {
        for (const fn of this.listeners.get(msg.method)) fn(msg.params);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  onceEvent(method, timeoutMs = 8000) {
    return new Promise((res) => {
      const timer = globalThis.setTimeout(() => {
        off();
        res(null);
      }, timeoutMs);
      const handler = (params) => {
        globalThis.clearTimeout(timer);
        off();
        res(params);
      };
      const off = () => {
        const list = this.listeners.get(method) || [];
        this.listeners.set(method, list.filter((f) => f !== handler));
      };
      const list = this.listeners.get(method) || [];
      list.push(handler);
      this.listeners.set(method, list);
    });
  }

  close() {
    this.ws.close();
  }
}

function buildSeedScript({ authenticated, theme }) {
  return `
    (function() {
      try {
        localStorage.setItem('lovecheck_ui_v2_theme', ${JSON.stringify(theme)});
        localStorage.setItem('lovecheck_ui_v2_install_dismissed', '1');
        if (${authenticated ? 'true' : 'false'}) {
          var user = {
            id: 'mock_user_1',
            displayName: 'Danh Thái',
            partnerName: 'Thúy Hà',
            email: 'danhthai4560@gmail.com',
            birthday: '2001-05-14',
            partnerBirthday: '2002-09-20',
            deviceId: 'mock-device-local',
            coupleId: 'mock_couple_1',
            createdAt: '2025-09-24T00:00:00.000Z',
            updatedAt: '2026-11-26T00:00:00.000Z'
          };
          var couple = {
            id: 'mock_couple_1',
            code: 'LOVE2026',
            loveStartDate: '2025-09-24T00:00:00.000Z',
            streak: 42,
            totalDays: 428,
            createdAt: '2025-09-24T00:00:00.000Z'
          };
          localStorage.setItem('lovecheck_token', 'mock_preview_token');
          localStorage.setItem('lovecheck_state', JSON.stringify({
            token: 'mock_preview_token',
            user: user,
            couple: couple,
            theme: ${JSON.stringify(theme)},
            hasNewCheckin: false
          }));
          sessionStorage.setItem('lovecheck:birthday-setup-notice:v1:mock_user_1', '1');
          localStorage.setItem('lovecheck_journey_seed_cleanup_v1', 'true');
          localStorage.setItem('lovecheck_journey_places', JSON.stringify([
            { id: 'p1', name: 'Hà Nội', latitude: 21.0285, longitude: 105.8542, status: 'visited', visitedDate: '2025-10-12', note: 'Buổi hẹn đầu tiên' },
            { id: 'p2', name: 'Đà Lạt', latitude: 11.9404, longitude: 108.4583, status: 'visited', visitedDate: '2026-02-14', note: 'Săn mây Cầu Đất' },
            { id: 'p3', name: 'Phú Quốc', latitude: 10.2899, longitude: 103.9840, status: 'wishlist', note: 'Ngắm hoàng hôn biển' }
          ]));
          localStorage.setItem('lovecheck_journey_bucket', JSON.stringify([
            { id: 'b1', title: 'Chụp bộ ảnh Polaroid ở Đà Lạt', category: 'travel', completed: true },
            { id: 'b2', title: 'Cùng nấu bữa tối kỷ niệm', category: 'cozy', completed: false }
          ]));
        } else {
          localStorage.removeItem('lovecheck_token');
          localStorage.setItem('lovecheck_state', JSON.stringify({
            token: null,
            user: null,
            couple: null,
            theme: ${JSON.stringify(theme)},
            hasNewCheckin: false
          }));
        }
      } catch (e) {}
    })();
  `;
}

const VITALS_OBSERVER_SCRIPT = `
  window.__cilVitals = { fcp: 0, lcp: 0, cls: 0, tbt: 0 };
  try {
    new PerformanceObserver(function(list) {
      for (var entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') window.__cilVitals.fcp = entry.startTime;
      }
    }).observe({ type: 'paint', buffered: true });
    new PerformanceObserver(function(list) {
      var entries = list.getEntries();
      if (entries.length) window.__cilVitals.lcp = entries[entries.length - 1].startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(function(list) {
      for (var entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__cilVitals.cls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver(function(list) {
      for (var entry of list.getEntries()) {
        if (entry.duration > 50) window.__cilVitals.tbt += (entry.duration - 50);
      }
    }).observe({ type: 'longtask', buffered: true });
  } catch (e) {}
`;

const HIDE_DEV_HELPER_CSS = '#dev-helper-root, .toast-container, #c-pwa-prompts { display: none !important; }';

const SCREENS = [
  { name: 'login', path: '/login', auth: false },
  { name: 'onboarding', path: '/onboarding', auth: false },
  { name: 'install', path: '/install', auth: false, iosUa: true },
  { name: 'home', path: '/app/home', auth: true },
  { name: 'memories', path: '/app/memories', auth: true },
  { name: 'checkin', path: '/app/checkin', auth: true },
  { name: 'messages', path: '/app/messages', auth: true },
  { name: 'profile', path: '/app/profile', auth: true },
  { name: 'random', path: '/app/random', auth: true },
  { name: 'replies', path: '/app/replies?checkinId=mock_checkin_1', auth: true },
  { name: 'journey', path: '/app/journey', auth: true },
];

const VIEWPORTS = [
  { w: 390, h: 844 },
  { w: 360, h: 800 },
];

async function waitForPageTarget(debugPort) {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await globalThis.fetch(`http://127.0.0.1:${debugPort}/json`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // chờ Chrome khởi động
    }
    await sleep(150);
  }
  throw new Error('Không kết nối được cổng CDP của Chrome.');
}

async function main() {
  mkdirSync(AFTER_DIR, { recursive: true });
  mkdirSync(PUBLIC_SCREENSHOTS_DIR, { recursive: true });

  const { server, port } = await startSpaServer();
  const baseUrl = `http://127.0.0.1:${port}`;
  const profileDir = mkdtempSync(join(tmpdir(), 'cil-cdp-'));
  const debugPort = 9345;

  const chrome = spawn(
    browserBin,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profileDir}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  try {
    const wsUrl = await waitForPageTarget(debugPort);
    const cdp = new CdpSession(wsUrl);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('Network.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');

    // Chặn các URL ngoài (tiles bản đồ, Google GSI, Unsplash) để đo offline nhất quán như baseline
    await cdp.send('Network.setBlockedURLs', {
      urls: [
        'https://accounts.google.com/*',
        'https://tiles.openfreemap.org/*',
        'https://images.unsplash.com/*',
        'https://fonts.googleapis.com/*',
        'https://fonts.gstatic.com/*',
        'https://unpkg.com/*',
      ],
    });

    // ── PHẦN A: Đo Web Vitals mobile (4x CPU, Fast 3G, 390x844) ──
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });

    const vitalsRoutes = [
      { label: '/login (cold)', path: '/login', auth: false },
      { label: '/app/home (seeded mock)', path: '/app/home', auth: true },
      { label: '/app/messages (seeded mock)', path: '/app/messages', auth: true },
    ];

    const vitalsResults = [];
    for (const item of vitalsRoutes) {
      await cdp.send('Network.clearBrowserCache');
      const s1 = await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
        source: buildSeedScript({ authenticated: item.auth, theme: 'light' }) + '\n' + VITALS_OBSERVER_SCRIPT,
      });

      const loadDone = cdp.onceEvent('Page.loadEventFired', 10000);
      await cdp.send('Page.navigate', { url: `${baseUrl}${item.path}` });
      await loadDone;
      await sleep(900);

      const evalRes = await cdp.send('Runtime.evaluate', {
        expression: `JSON.stringify((function(){
          var nav = performance.getEntriesByType('navigation')[0];
          var v = window.__cilVitals || {};
          return {
            fcp: Math.round(v.fcp || 0),
            lcp: Math.round(v.lcp || v.fcp || 0),
            cls: Number((v.cls || 0).toFixed(3)),
            tbt: Math.round(v.tbt || 0),
            dcl: Number((nav ? nav.domContentLoadedEventEnd : 0).toFixed(1))
          };
        })())`,
        returnByValue: true,
      });

      const metrics = JSON.parse(evalRes.result.value);
      vitalsResults.push({ route: item.label, ...metrics });
      await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: s1.identifier });
    }

    // Bỏ giới hạn mạng/CPU khi chụp 44 ảnh after để chạy nhanh và sắc nét
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });

    // ── PHẦN B: Chụp 44 ảnh after WebP (11 màn × light/dark × 390x844/360x800) ──
    let shotCount = 0;
    for (const vp of VIEWPORTS) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.w,
        height: vp.h,
        deviceScaleFactor: 2,
        mobile: true,
      });

      for (const theme of ['light', 'dark']) {
        await cdp.send('Emulation.setEmulatedMedia', {
          features: [
            { name: 'prefers-color-scheme', value: theme },
            { name: 'prefers-reduced-motion', value: 'reduce' },
          ],
        });

        for (const scr of SCREENS) {
          await cdp.send('Emulation.setUserAgentOverride', {
            userAgent: scr.iosUa
              ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
              : 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
          });
          const scriptDoc = await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
            source: buildSeedScript({ authenticated: scr.auth, theme }),
          });

          const loadDone = cdp.onceEvent('Page.loadEventFired', 6000);
          await cdp.send('Page.navigate', { url: `${baseUrl}${scr.path}` });
          await loadDone;
          await sleep(scr.name === 'journey' || scr.name === 'checkin' ? 420 : 260);

          await cdp.send('Runtime.evaluate', {
            expression: `(function(){
              var s = document.getElementById('__cil-shot-clean');
              if (!s) {
                s = document.createElement('style');
                s.id = '__cil-shot-clean';
                s.textContent = ${JSON.stringify(HIDE_DEV_HELPER_CSS)};
                document.head.appendChild(s);
              }
              return document.fonts ? document.fonts.ready.then(function(){ return true; }) : true;
            })()`,
            awaitPromise: true,
          });
          await sleep(80);

          const shot = await cdp.send('Page.captureScreenshot', {
            format: 'webp',
            quality: 84,
          });
          const buf = globalThis.Buffer.from(shot.data, 'base64');
          const fileName = `${scr.name}-${theme}-${vp.w}x${vp.h}.webp`;
          writeFileSync(join(AFTER_DIR, fileName), buf);
          shotCount++;

          if (vp.w === 390 && vp.h === 844 && theme === 'light') {
            if (scr.name === 'home') writeFileSync(join(PUBLIC_SCREENSHOTS_DIR, 'home-mobile.webp'), buf);
            if (scr.name === 'messages') writeFileSync(join(PUBLIC_SCREENSHOTS_DIR, 'chat-mobile.webp'), buf);
          }

          await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: scriptDoc.identifier });
        }
      }
    }

    cdp.close();
    writeFileSync(resolve('design/redesign-v2/after-vitals.json'), JSON.stringify(vitalsResults, null, 2));
    process.stdout.write(`Đã chụp ${shotCount} ảnh WebP vào design/redesign-v2/after/\n`);
    process.stdout.write(`Web Vitals After:\n${JSON.stringify(vitalsResults, null, 2)}\n`);
  } finally {
    chrome.kill();
    server.close();
    await sleep(300);
    rmSync(profileDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  process.stderr.write(`Lỗi: ${err.stack || err.message}\n`);
  process.exit(1);
});
