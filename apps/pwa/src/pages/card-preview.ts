import '../styles/20-pages/secondary.css';
import { triggerHaptic } from '../ui/haptics';
import type { OccasionCardId } from '../utils/anniversary-cards';

interface PreviewItem {
  id: OccasionCardId;
  icon: string;
  title: string;
  date: string;
}

const PREVIEW_ITEMS: readonly PreviewItem[] = [
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

export function renderCardPreviewPage(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'page page-no-nav card-preview-page animate-fade-in';
  root.innerHTML = `
    <main class="card-preview-wrap">
      <span class="card-preview-badge">🎴 PREVIEW LIBRARY</span>
      <h1 class="card-preview-title">Bộ thiệp cào ngày đặc biệt</h1>
      <p class="card-preview-copy">Chạm vào từng dịp để mở và cào thử. Trang này chạy độc lập, không ảnh hưởng dữ liệu kỷ niệm thật của hai đứa.</p>
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
      triggerHaptic('tap');
      if (!window.LoveCheckCards) {
        if (status) status.textContent = 'Đang khởi tạo bộ thiệp, hãy đợi giây lát...';
        void import('../utils/anniversary-cards').then(({ initAnniversaryCards }) => {
          initAnniversaryCards();
          window.LoveCheckCards?.open(id);
          if (status) status.textContent = '';
        });
        return;
      }
      if (status) status.textContent = '';
      window.LoveCheckCards.open(id);
    });
  });

  return root;
}
