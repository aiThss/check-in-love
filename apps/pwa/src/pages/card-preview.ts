import '../styles/20-pages/secondary.css';
import { iconMarkup, type IconName } from '../ui/icons/icons';
import { createBadge } from '../ui/primitives';
import { triggerHaptic } from '../ui/haptics';
import type { OccasionCardId } from '../utils/anniversary-cards';

interface PreviewItem {
  id: OccasionCardId;
  icon: IconName;
  title: string;
  date: string;
}

const PREVIEW_ITEMS: readonly PreviewItem[] = [
  { id: 'day-100', icon: 'heart-burst', title: '100 ngày bên nhau', date: 'Cột mốc tình yêu' },
  { id: 'anniversary', icon: 'anniversary', title: 'Tròn năm bên nhau', date: 'Ngày bắt đầu yêu' },
  { id: 'day-500', icon: 'gift', title: '500 ngày có nhau', date: 'Cột mốc tình yêu' },
  { id: 'day-1000', icon: 'sparkle', title: '1.000 ngày rồi', date: 'Cột mốc tình yêu' },
  { id: 'birthday', icon: 'anniversary', title: 'Sinh nhật người ấy', date: 'Theo ngày sinh đã lưu' },
  { id: 'valentine', icon: 'heart', title: 'Lễ Tình nhân', date: '14 tháng 2' },
  { id: 'womens-day', icon: 'star', title: 'Quốc tế Phụ nữ', date: '8 tháng 3' },
  { id: 'childrens-day', icon: 'sparkle', title: 'Quốc tế Thiếu nhi', date: '1 tháng 6' },
  { id: 'vietnamese-womens-day', icon: 'heart', title: 'Phụ nữ Việt Nam', date: '20 tháng 10' },
  { id: 'christmas', icon: 'gift', title: 'Giáng sinh an lành', date: '24 tháng 12' },
  { id: 'new-year', icon: 'star', title: 'Tết Dương lịch', date: '1 tháng 1' },
];

export function renderCardPreviewPage(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'page page-no-nav card-preview-page p-secondary p-secondary--wide animate-fade-in';

  const topRow = document.createElement('div');
  topRow.appendChild(createBadge('Bộ sưu tập thiệp cào', 'gold'));
  root.appendChild(topRow);

  const intro = document.createElement('header');
  intro.innerHTML = `
    <h1 class="p-sec-header__title" style="font-size:clamp(26px,6vw,36px);">Thiệp cào ngày kỷ niệm</h1>
    <p class="p-sec-header__sub" style="font-size:14px;line-height:1.6;margin-top:6px;">
      Chạm vào từng dịp đặc biệt để mở và cào thử lớp nhũ. Chế độ xem trước chạy độc lập, không ảnh hưởng dữ liệu thật của hai bạn.
    </p>
  `;
  root.appendChild(intro);

  const grid = document.createElement('section');
  grid.className = 'card-preview-grid p-preview-grid';
  grid.setAttribute('aria-label', 'Danh sách thiệp kỷ niệm để thử');

  PREVIEW_ITEMS.forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'card-preview-item p-preview-card-btn';
    btn.dataset.previewCard = item.id;
    btn.innerHTML = `
      <span class="p-preview-card-btn__icon">${iconMarkup(item.icon, { size: 24, variant: 'filled' })}</span>
      <span style="min-width:0;flex:1;">
        <strong style="display:block;font-size:14px;">${item.title}</strong>
        <small class="u-text-secondary" style="font-size:11px;">${item.date}</small>
      </span>
      ${iconMarkup('chevron-right', { size: 16 })}
    `;
    grid.appendChild(btn);
  });
  root.appendChild(grid);

  const status = document.createElement('p');
  status.className = 'card-preview-status u-text-secondary';
  status.style.fontSize = '12px';
  status.setAttribute('aria-live', 'polite');
  root.appendChild(status);

  grid.querySelectorAll<HTMLButtonElement>('[data-preview-card]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.previewCard as OccasionCardId;
      triggerHaptic('tap');
      if (!window.LoveCheckCards) {
        status.textContent = 'Đang khởi tạo bộ thiệp, hãy thử lại sau giây lát...';
        void import('../utils/anniversary-cards').then(({ initAnniversaryCards }) => {
          initAnniversaryCards();
          window.LoveCheckCards?.open(id);
          status.textContent = '';
        });
        return;
      }
      status.textContent = '';
      window.LoveCheckCards.open(id);
    });
  });

  return root;
}
