import type { OccasionCardId } from '../utils/anniversary-cards';

interface PreviewItem {
  id: OccasionCardId;
  icon: string;
  title: string;
  date: string;
}

const PREVIEW_ITEMS: PreviewItem[] = [
  { id: 'day-100', icon: '💯', title: '100 ngày bên nhau', date: 'Cột mốc tình yêu' },
  { id: 'anniversary', icon: '💍', title: 'Tròn năm bên nhau', date: 'Ngày bắt đầu yêu' },
  { id: 'day-500', icon: '🎀', title: '500 ngày có nhau', date: 'Cột mốc tình yêu' },
  { id: 'day-1000', icon: '✨', title: '1.000 ngày rồi', date: 'Cột mốc tình yêu' },
  { id: 'birthday', icon: '🎂', title: 'Sinh nhật người ấy', date: 'Theo ngày sinh đã lưu' },
  { id: 'valentine', icon: '💌', title: 'Valentine', date: '14 tháng 2' },
  { id: 'womens-day', icon: '🌷', title: 'Quốc tế Phụ nữ', date: '8 tháng 3' },
  { id: 'childrens-day', icon: '🍭', title: 'Quốc tế Thiếu nhi', date: '1 tháng 6' },
  { id: 'vietnamese-womens-day', icon: '🌸', title: 'Phụ nữ Việt Nam', date: '20 tháng 10' },
  { id: 'christmas', icon: '🎄', title: 'Giáng sinh', date: '24 tháng 12' },
  { id: 'new-year', icon: '🎆', title: 'Tết Dương lịch', date: '1 tháng 1' },
];

function ensurePreviewStyles(): void {
  if (document.getElementById('card-preview-page-styles')) return;
  const style = document.createElement('style');
  style.id = 'card-preview-page-styles';
  style.textContent = `
    .card-preview-page{min-height:100dvh;padding:calc(var(--safe-top,0px) + 28px) 16px calc(var(--safe-bottom,0px) + 36px);background:radial-gradient(circle at 85% 0%,rgba(255,89,145,.14),transparent 30%),radial-gradient(circle at 0% 72%,rgba(152,91,218,.12),transparent 34%),var(--bg);color:var(--text-primary)}
    .card-preview-wrap{width:min(720px,100%);margin:0 auto}.card-preview-badge{display:inline-flex;align-items:center;gap:7px;padding:7px 11px;border:1px solid rgba(255,102,155,.22);border-radius:999px;background:rgba(255,102,155,.09);color:var(--accent);font-size:12px;font-weight:800}
    .card-preview-title{margin:17px 0 8px;font-size:clamp(28px,8vw,42px);line-height:1.08;letter-spacing:-.045em}.card-preview-copy{max-width:560px;margin:0;color:var(--text-secondary);font-size:14px;line-height:1.65}.card-preview-note{display:flex;align-items:flex-start;gap:10px;margin:20px 0;padding:13px 14px;border:1px solid var(--border);border-radius:16px;background:var(--surface);font-size:12px;line-height:1.55;color:var(--text-secondary)}
    .card-preview-note strong{display:block;color:var(--text-primary);margin-bottom:2px}.card-preview-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;margin-top:18px}.card-preview-item{display:flex;align-items:center;gap:12px;min-width:0;padding:14px;border:1px solid var(--border);border-radius:19px;background:var(--surface);color:var(--text-primary);text-align:left;cursor:pointer;transition:transform .16s ease,border-color .16s ease,background .16s ease}.card-preview-item:active{transform:scale(.975)}.card-preview-item:hover{border-color:rgba(255,102,155,.42);background:var(--surface-solid)}.card-preview-icon{display:grid;place-items:center;flex:0 0 45px;width:45px;height:45px;border-radius:15px;background:rgba(255,102,155,.1);font-size:24px}.card-preview-label{min-width:0}.card-preview-label strong{display:block;font-size:13px;line-height:1.35}.card-preview-label small{display:block;margin-top:4px;color:var(--text-secondary);font-size:10px;line-height:1.3}.card-preview-arrow{margin-left:auto;color:var(--text-secondary);font-size:17px}.card-preview-status{min-height:20px;margin:15px 2px 0;color:var(--text-secondary);font-size:12px}
    @media(max-width:430px){.card-preview-grid{grid-template-columns:1fr}.card-preview-page{padding-left:14px;padding-right:14px}}
  `;
  document.head.appendChild(style);
}

export function renderCardPreviewPage(): HTMLElement {
  ensurePreviewStyles();
  const root = document.createElement('div');
  root.className = 'page page-no-nav card-preview-page animate-fade-in';
  root.innerHTML = `
    <main class="card-preview-wrap">
      <span class="card-preview-badge">🎴 BRANCH PREVIEW</span>
      <h1 class="card-preview-title">Bộ thiệp cào ngày đặc biệt</h1>
      <p class="card-preview-copy">Chạm vào từng dịp để mở và cào thử. Trang này chạy độc lập, không đăng nhập, không gọi API và không ghi dữ liệu vào MongoDB.</p>
      <div class="card-preview-note">
        <span aria-hidden="true">🧪</span>
        <div><strong>Chế độ kiểm thử an toàn</strong>Đóng thiệp rồi mở lại bao nhiêu lần cũng được. Trạng thái “đã xem” của ứng dụng thật không bị ảnh hưởng.</div>
      </div>
      <section class="card-preview-grid" aria-label="Danh sách thiệp để thử">
        ${PREVIEW_ITEMS.map((item) => `
          <button type="button" class="card-preview-item" data-preview-card="${item.id}">
            <span class="card-preview-icon" aria-hidden="true">${item.icon}</span>
            <span class="card-preview-label"><strong>${item.title}</strong><small>${item.date}</small></span>
            <span class="card-preview-arrow" aria-hidden="true">›</span>
          </button>
        `).join('')}
      </section>
      <p class="card-preview-status" aria-live="polite"></p>
    </main>
  `;

  const status = root.querySelector<HTMLElement>('.card-preview-status');
  root.querySelectorAll<HTMLButtonElement>('[data-preview-card]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.previewCard as OccasionCardId;
      if (!window.LoveCheckCards) {
        if (status) status.textContent = 'Component thiệp chưa sẵn sàng, hãy tải lại trang.';
        return;
      }
      if (status) status.textContent = '';
      window.LoveCheckCards.open(id);
    });
  });

  return root;
}
