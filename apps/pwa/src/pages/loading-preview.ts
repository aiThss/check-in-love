import { loadingDemos } from '../components/loading-demo-svgs';

function ensureStyles(): void {
  if (document.getElementById('loading-preview-styles')) return;
  const style = document.createElement('style');
  style.id = 'loading-preview-styles';
  style.textContent = `
    .loading-preview{min-height:100dvh;padding:calc(var(--safe-top,0px) + 28px) 16px calc(var(--safe-bottom,0px) + 40px);background:radial-gradient(circle at 90% 0,rgba(255,104,158,.15),transparent 32%),radial-gradient(circle at 0 75%,rgba(159,132,255,.13),transparent 34%),var(--bg);color:var(--text-primary)}
    .loading-preview__wrap{width:min(860px,100%);margin:0 auto}.loading-preview__badge{display:inline-flex;padding:7px 11px;border:1px solid rgba(255,102,155,.22);border-radius:999px;background:rgba(255,102,155,.09);color:var(--accent);font-size:12px;font-weight:800}.loading-preview h1{margin:17px 0 8px;font-size:clamp(29px,7vw,44px);line-height:1.06;letter-spacing:-.045em}.loading-preview__intro{max-width:620px;margin:0;color:var(--text-secondary);font-size:14px;line-height:1.65}
    .loading-preview__grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:24px}.loading-demo-card{position:relative;display:grid;grid-template-columns:132px 1fr;align-items:center;min-height:164px;padding:16px;border:1px solid var(--border);border-radius:24px;background:var(--surface);box-shadow:0 12px 35px rgba(73,42,62,.07);overflow:hidden}.loading-demo-card:first-child{grid-column:1/-1}.loading-demo-card__stage{display:grid;place-items:center;width:120px;height:120px;border-radius:28px;background:linear-gradient(145deg,rgba(255,255,255,.82),rgba(255,236,246,.72));box-shadow:inset 0 0 0 1px rgba(255,255,255,.7)}.loading-demo-card svg{width:104px;height:104px;overflow:visible}.loading-demo-card__number{font-size:11px;font-weight:900;letter-spacing:.12em;color:var(--accent)}.loading-demo-card h2{margin:7px 0 6px;font-size:18px}.loading-demo-card p{margin:0;color:var(--text-secondary);font-size:12px;line-height:1.55}.loading-preview__tip{margin:18px 2px 0;color:var(--text-secondary);font-size:12px}
    [data-theme='dark'] .loading-demo-card__stage{background:linear-gradient(145deg,rgba(255,255,255,.11),rgba(255,101,158,.08))}@media(max-width:680px){.loading-preview__grid{grid-template-columns:1fr}.loading-demo-card:first-child{grid-column:auto}}@media(max-width:420px){.loading-demo-card{grid-template-columns:104px 1fr;padding:12px}.loading-demo-card__stage{width:94px;height:110px}.loading-demo-card svg{width:88px;height:88px}}
  `;
  document.head.appendChild(style);
}

export function renderLoadingPreviewPage(): HTMLElement {
  ensureStyles();
  const root = document.createElement('div');
  root.className = 'page page-no-nav loading-preview animate-fade-in';
  root.innerHTML = `<main class="loading-preview__wrap">
    <span class="loading-preview__badge">💗 SVG LOADING DEMO</span>
    <h1>5 kiểu loading cho Check-in Love</h1>
    <p class="loading-preview__intro">Tất cả đều là SVG + CSS thuần, nhẹ và tự đổi theo kích thước toast. Đây mới là trang chọn mẫu; loading đang dùng trong app chưa bị thay đổi.</p>
    <section class="loading-preview__grid" aria-label="Năm mẫu loading SVG">
      ${loadingDemos.map((demo, index) => `<article class="loading-demo-card" data-loader-id="${demo.id}"><div class="loading-demo-card__stage">${demo.markup}</div><div><span class="loading-demo-card__number">DEMO ${index + 1}</span><h2>${demo.name}</h2><p>${demo.description}</p></div></article>`).join('')}
    </section>
    <p class="loading-preview__tip">Chọn số hoặc tên mẫu bạn thích, mình sẽ gắn nó thay loading hiện tại.</p>
  </main>`;
  return root;
}
